"use server";

import { after } from "next/server";
import { z } from "zod";
import { formatPrice } from "@/lib/format";
import { looksLikeUrl, normalizeUrl } from "@/lib/normalizeUrl";
import { byPosition, keyBetween, keysAtEndOf, keysAtStart } from "@/lib/positions";
import { PRICE_MAX_CENTS } from "@/lib/price";
import { hitRateLimit } from "@/server/auth/rateLimit";
import { ITEM_COLUMNS, stringArray, toItemInfo } from "@/server/db/mappers";
import { downloadImage } from "@/server/enrich/image";
import { enrichItem, runEnrichment } from "@/server/enrich/run";
import {
  ImageError,
  processImage,
  removeItemImage,
  uploadItemImage,
  type ProcessedImage,
} from "@/server/images";
import type { TablesUpdate } from "@/types/database";
import type { ItemInfo } from "@/types/models";
import { guardItems, guardList, revalidateList, type EditContext } from "./guard";
import { fail, GENERIC_ERROR, ok, type Result } from "./result";

const UNIQUE_VIOLATION = "23505";
const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;
const DUPLICATE_MESSAGE = "Déjà dans la liste";
const RESTORE_CONFLICT = "Un article avec ce lien existe déjà.";
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const FETCH_FAILED = "Les infos n'ont pas pu être lues sur la page.";

const uuid = z.uuid();
const ids = z.array(uuid).min(1).max(500);

function logError(where: string, error: unknown) {
  console.error(where, error instanceof Error ? error.message : error);
}

/**
 * Lecture des liens après la réponse (`after()`), 4 à la fois. Le navigateur reçoit le résultat
 * par le temps réel ; les pages visiteur sont invalidées à la fin.
 */
function enrichLater(itemIds: string[], slug: string) {
  if (!itemIds.length) return;
  after(async () => {
    await runEnrichment(itemIds);
    try {
      revalidateList(slug);
    } catch (error) {
      logError("enrichLater", error);
    }
  });
}

async function readItems(ctx: EditContext, itemIds: string[]): Promise<ItemInfo[]> {
  const { data, error } = await ctx.db.from("items").select(ITEM_COLUMNS).in("id", itemIds);
  if (error) throw new Error(error.message);
  const byId = new Map((data ?? []).map((r) => [r.id, toItemInfo(r)]));
  return itemIds.map((id) => byId.get(id)).filter((i): i is ItemInfo => Boolean(i));
}

async function listPositions(ctx: EditContext) {
  const { data, error } = await ctx.db
    .from("items")
    .select("id, position, category_id")
    .eq("list_id", ctx.list.id)
    .is("deleted_at", null);
  if (error) throw new Error(error.message);
  return (data ?? [])
    .map((r) => ({ id: r.id, position: r.position, categoryId: r.category_id }))
    .sort(byPosition);
}

async function categoryBelongs(ctx: EditContext, categoryId: string): Promise<boolean> {
  const { data } = await ctx.db
    .from("categories")
    .select("id")
    .eq("id", categoryId)
    .eq("list_id", ctx.list.id)
    .maybeSingle();
  return Boolean(data);
}

// ---------------------------------------------------------------------------
// Ajout rapide
// ---------------------------------------------------------------------------

const addInput = z.object({
  listId: uuid,
  lines: z.array(z.string().max(2048)).min(1).max(50),
  categoryId: uuid.nullable().optional(),
});

export type AddResult = { created: ItemInfo[]; duplicates: { line: string; itemRef: string }[] };

/**
 * Un article par ligne non vide : un lien (`https://…` ou `domaine.tld/…`) ou un nom.
 * En tête de « À trier », ou à la fin de la catégorie donnée (« Ajouter ici »).
 * Les liens déjà présents sont renvoyés à part.
 */
export async function addItems(input: z.input<typeof addInput>): Promise<Result<AddResult>> {
  const parsed = addInput.safeParse(input);
  if (!parsed.success) return fail("VALIDATION", GENERIC_ERROR);
  const guard = await guardList(parsed.data.listId);
  if (!guard.ok) return guard.result;
  const { ctx } = guard;
  const categoryId = parsed.data.categoryId ?? null;

  const lines = parsed.data.lines
    .map((l) => l.trim().replace(/\s+/g, " "))
    .filter((l) => l && !CONTROL.test(l));
  if (lines.length === 0) return fail("VALIDATION", GENERIC_ERROR);

  try {
    if (categoryId && !(await categoryBelongs(ctx, categoryId))) return fail("NOT_FOUND", GENERIC_ERROR);

    // Limite : 300 articles par heure et par liste (un essai compté par article).
    const hits = await Promise.all(lines.map(() => hitRateLimit(`add:${ctx.list.id}`, 300, 60 * 60)));
    if (hits.some((h) => !h.allowed)) {
      return fail("RATE_LIMITED", "Beaucoup d'ajouts d'un coup. Réessayez dans quelques minutes.");
    }

    type Draft = {
      line: string;
      title: string | null;
      url: string | null;
      urlKey: string | null;
      domain: string | null;
    };
    const drafts: Draft[] = lines.map((line) => {
      const n = looksLikeUrl(line) ? normalizeUrl(line) : null;
      return n
        ? { line, title: null, url: n.url, urlKey: n.urlKey, domain: n.domain }
        : { line, title: line.slice(0, 200), url: null, urlKey: null, domain: null };
    });

    // Doublons : déjà dans la liste, ou répétés dans le même collage.
    const keys = drafts.map((d) => d.urlKey).filter((k): k is string => Boolean(k));
    const existing = new Map<string, string>();
    if (keys.length) {
      const { data } = await ctx.db
        .from("items")
        .select("ref, url_key")
        .eq("list_id", ctx.list.id)
        .is("deleted_at", null)
        .in("url_key", keys);
      for (const r of data ?? []) if (r.url_key) existing.set(r.url_key, r.ref);
    }
    const duplicates: AddResult["duplicates"] = [];
    const seen = new Set<string>();
    const fresh = drafts.filter((d) => {
      if (!d.urlKey) return true;
      const ref = existing.get(d.urlKey);
      if (ref) {
        duplicates.push({ line: d.line, itemRef: ref });
        return false;
      }
      if (seen.has(d.urlKey)) return false;
      seen.add(d.urlKey);
      return true;
    });
    if (fresh.length === 0) return ok({ created: [], duplicates });

    const positions = await listPositions(ctx);
    const keysForNew = categoryId
      ? keysAtEndOf(positions, categoryId, fresh.length)
      : keysAtStart(positions[0]?.position ?? null, fresh.length);
    const now = new Date().toISOString();

    const { data, error } = await ctx.db
      .from("items")
      .insert(
        fresh.map((d, i) => ({
          list_id: ctx.list.id,
          title: d.title,
          url: d.url,
          url_key: d.urlKey,
          domain: d.domain,
          category_id: categoryId,
          sorted_at: categoryId ? now : null,
          position: keysForNew[i]!,
          fetch_status: d.url ? ("pending" as const) : ("none" as const),
        })),
      )
      .select(ITEM_COLUMNS);
    if (error) {
      if (error.code === UNIQUE_VIOLATION) return fail("DUPLICATE", DUPLICATE_MESSAGE);
      throw new Error(error.message);
    }
    revalidateList(ctx.list.slug);
    const created = (data ?? []).map(toItemInfo).sort(byPosition);
    enrichLater(
      created.filter((i) => i.url).map((i) => i.id),
      ctx.list.slug,
    );
    return ok({ created, duplicates });
  } catch (error) {
    logError("addItems", error);
    return fail("INTERNAL", GENERIC_ERROR);
  }
}

function readFile(form: FormData): File | null {
  const file = form.get("file");
  return file instanceof File && file.size > 0 ? file : null;
}

async function processUpload(file: File): Promise<Awaited<ReturnType<typeof processImage>> | Result<never>> {
  if (file.size > MAX_UPLOAD_BYTES || !file.type.startsWith("image/"))
    return fail("VALIDATION", GENERIC_ERROR);
  try {
    // Type MIME vérifié, puis la signature : sharp doit pouvoir lire l'image.
    return await processImage(Buffer.from(await file.arrayBuffer()));
  } catch (error) {
    if (error instanceof ImageError) return fail("VALIDATION", GENERIC_ERROR);
    throw error;
  }
}

const isResult = (v: unknown): v is Result<never> => typeof v === "object" && v !== null && "ok" in v;

/** Article sans lien à partir d'une photo (nom vide, à compléter). FormData : listId, file, title?, categoryId? */
export async function addItemWithPhoto(form: FormData): Promise<Result<ItemInfo>> {
  const listId = uuid.safeParse(form.get("listId"));
  const file = readFile(form);
  if (!listId.success || !file) return fail("VALIDATION", GENERIC_ERROR);
  const title = String(form.get("title") ?? "")
    .trim()
    .slice(0, 200);
  const rawCategory = form.get("categoryId");
  const categoryId =
    typeof rawCategory === "string" && uuid.safeParse(rawCategory).success ? rawCategory : null;

  const guard = await guardList(listId.data);
  if (!guard.ok) return guard.result;
  const { ctx } = guard;
  try {
    const limit = await hitRateLimit(`upload:${ctx.list.id}`, 60, 60 * 60);
    if (!limit.allowed)
      return fail("RATE_LIMITED", "Beaucoup d'ajouts d'un coup. Réessayez dans quelques minutes.");
    if (categoryId && !(await categoryBelongs(ctx, categoryId))) return fail("NOT_FOUND", GENERIC_ERROR);

    const image = await processUpload(file);
    if (isResult(image)) return image;

    const positions = await listPositions(ctx);
    const [position] = categoryId
      ? keysAtEndOf(positions, categoryId, 1)
      : keysAtStart(positions[0]?.position ?? null, 1);
    const { data: created, error } = await ctx.db
      .from("items")
      .insert({
        list_id: ctx.list.id,
        title,
        position: position!,
        category_id: categoryId,
        sorted_at: categoryId ? new Date().toISOString() : null,
        meta: { lightBackground: image.lightBackground },
      })
      .select("id")
      .single();
    if (error || !created) throw new Error(error?.message ?? "insertion impossible");

    const prefix = await uploadItemImage(ctx.db, ctx.list.id, created.id, image);
    await ctx.db
      .from("items")
      .update({ image_path: prefix, image_width: image.width, image_height: image.height })
      .eq("id", created.id);

    revalidateList(ctx.list.slug);
    const [item] = await readItems(ctx, [created.id]);
    return item ? ok(item) : fail("INTERNAL", GENERIC_ERROR);
  } catch (error) {
    logError("addItemWithPhoto", error);
    return fail("INTERNAL", GENERIC_ERROR);
  }
}

// ---------------------------------------------------------------------------
// Modification
// ---------------------------------------------------------------------------

const patchSchema = z
  .object({
    title: z.string().max(200),
    priceCents: z.number().int().min(0).max(PRICE_MAX_CENTS).nullable(),
    currency: z.string().regex(/^[A-Z]{3}$/),
    url: z.string().max(2048).nullable(),
    note: z.string().max(500),
    categoryId: uuid.nullable(),
    isFavorite: z.boolean(),
    tagIds: z.array(uuid).max(50),
  })
  .partial();

const updateInput = z.object({ itemId: uuid, patch: patchSchema });

export type ItemPatch = z.input<typeof patchSchema>;

/**
 * Modifie un article. Un prix saisi devient « manuel » ; un nouveau lien relance la récupération ;
 * donner une catégorie sort l'article de « À trier ».
 */
export async function updateItem(input: z.input<typeof updateInput>): Promise<Result<ItemInfo>> {
  const parsed = updateInput.safeParse(input);
  if (!parsed.success) return fail("VALIDATION", GENERIC_ERROR);
  const { itemId, patch } = parsed.data;
  const guard = await guardItems([itemId]);
  if (!guard.ok) return guard.result;
  const { ctx } = guard;

  try {
    const [current] = await readItems(ctx, [itemId]);
    if (!current) return fail("NOT_FOUND", "Cet article n'existe plus.");
    const update: TablesUpdate<"items"> = {};

    if (patch.title !== undefined) {
      const title = patch.title.trim().replace(/\s+/g, " ");
      if (CONTROL.test(title)) return fail("VALIDATION", GENERIC_ERROR, "title");
      update.title = title;
    }
    if (patch.priceCents !== undefined) {
      update.price_cents = patch.priceCents;
      update.price_source = patch.priceCents === null ? null : "manual";
      update.currency =
        patch.priceCents === null ? null : (patch.currency ?? current.currency ?? ctx.list.currency);
    }
    if (patch.note !== undefined) {
      if (CONTROL.test(patch.note)) return fail("VALIDATION", GENERIC_ERROR, "note");
      update.note = patch.note.trim() || null;
    }
    if (patch.isFavorite !== undefined) update.is_favorite = patch.isFavorite;

    if (patch.url !== undefined) {
      const raw = patch.url?.trim() ?? "";
      if (raw === "") {
        const title = update.title ?? current.title;
        update.url = null;
        update.url_key = null;
        update.domain = null;
        update.fetch_status = "none";
        if (title === null) update.title = current.domain ?? "";
      } else {
        const n = normalizeUrl(raw);
        if (!n) return fail("VALIDATION", "Ce lien n'est pas valable.", "url");
        if (n.url !== current.url) {
          const { data: dup } = await ctx.db
            .from("items")
            .select("id")
            .eq("list_id", ctx.list.id)
            .eq("url_key", n.urlKey)
            .is("deleted_at", null)
            .neq("id", itemId)
            .maybeSingle();
          if (dup) return fail("DUPLICATE", DUPLICATE_MESSAGE, "url");
          Object.assign(update, {
            url: n.url,
            url_key: n.urlKey,
            domain: n.domain,
            fetch_status: "pending",
            fetch_error: null,
            fetch_attempts: 0,
            fetch_started_at: null,
            image_candidates: [],
          });
        }
      }
    }

    if (patch.categoryId !== undefined) {
      if (patch.categoryId && !(await categoryBelongs(ctx, patch.categoryId)))
        return fail("NOT_FOUND", GENERIC_ERROR);
      update.category_id = patch.categoryId;
      if (patch.categoryId && !current.sortedAt) update.sorted_at = new Date().toISOString();
    }

    if (Object.keys(update).length) {
      const { error } = await ctx.db.from("items").update(update).eq("id", itemId);
      if (error) {
        if (error.code === UNIQUE_VIOLATION) return fail("DUPLICATE", DUPLICATE_MESSAGE, "url");
        throw new Error(error.message);
      }
    }

    if (patch.tagIds !== undefined) {
      const wanted = new Set(patch.tagIds);
      const remove = current.tagIds.filter((t) => !wanted.has(t));
      const add = [...wanted].filter((t) => !current.tagIds.includes(t));
      if (remove.length) await ctx.db.from("item_tags").delete().eq("item_id", itemId).in("tag_id", remove);
      if (add.length) {
        const { error } = await ctx.db
          .from("item_tags")
          .insert(add.map((tag_id) => ({ item_id: itemId, tag_id })));
        if (error) return fail("NOT_FOUND", GENERIC_ERROR);
      }
    }

    revalidateList(ctx.list.slug);
    if (update.fetch_status === "pending") enrichLater([itemId], ctx.list.slug);
    const [item] = await readItems(ctx, [itemId]);
    return item ? ok(item) : fail("NOT_FOUND", "Cet article n'existe plus.");
  } catch (error) {
    logError("updateItem", error);
    return fail("INTERNAL", GENERIC_ERROR);
  }
}

/**
 * Change la photo ou la retire. FormData : itemId + file (envoi), itemId + candidateUrl
 * (une des photos trouvées sur la page), ou itemId + remove=1.
 */
export async function setItemImage(form: FormData): Promise<Result<ItemInfo>> {
  const itemId = uuid.safeParse(form.get("itemId"));
  if (!itemId.success) return fail("VALIDATION", GENERIC_ERROR);
  const guard = await guardItems([itemId.data]);
  if (!guard.ok) return guard.result;
  const { ctx } = guard;
  try {
    const { data: row } = await ctx.db
      .from("items")
      .select("image_path, meta, image_candidates")
      .eq("id", itemId.data)
      .single();
    const oldPath = row?.image_path ?? null;
    const meta = typeof row?.meta === "object" && row.meta && !Array.isArray(row.meta) ? row.meta : {};

    if (form.get("remove") === "1") {
      await ctx.db
        .from("items")
        .update({
          image_path: null,
          image_width: null,
          image_height: null,
          image_source_url: null,
          meta: { ...meta, lightBackground: false },
        })
        .eq("id", itemId.data);
    } else {
      const candidate = form.get("candidateUrl");
      const file = readFile(form);
      if (!file && typeof candidate !== "string") return fail("VALIDATION", GENERIC_ERROR);
      const limit = await hitRateLimit(`upload:${ctx.list.id}`, 60, 60 * 60);
      if (!limit.allowed)
        return fail("RATE_LIMITED", "Beaucoup d'ajouts d'un coup. Réessayez dans quelques minutes.");

      let image: ProcessedImage;
      let sourceUrl: string | null = null;
      if (typeof candidate === "string") {
        // Seulement une photo trouvée sur la page de l'article.
        if (!stringArray(row?.image_candidates ?? null).includes(candidate))
          return fail("VALIDATION", GENERIC_ERROR);
        const downloaded = await downloadImage(candidate);
        if (!downloaded) return fail("VALIDATION", GENERIC_ERROR);
        image = downloaded;
        sourceUrl = candidate;
      } else {
        const uploaded = await processUpload(file!);
        if (isResult(uploaded)) return uploaded;
        image = uploaded;
      }
      const prefix = await uploadItemImage(ctx.db, ctx.list.id, itemId.data, image);
      await ctx.db
        .from("items")
        .update({
          image_path: prefix,
          image_width: image.width,
          image_height: image.height,
          image_source_url: sourceUrl,
          meta: { ...meta, lightBackground: image.lightBackground },
        })
        .eq("id", itemId.data);
      if (oldPath === prefix) return ok((await readItems(ctx, [itemId.data]))[0]!);
    }
    await removeItemImage(ctx.db, oldPath);
    revalidateList(ctx.list.slug);
    const [item] = await readItems(ctx, [itemId.data]);
    return item ? ok(item) : fail("NOT_FOUND", "Cet article n'existe plus.");
  } catch (error) {
    logError("setItemImage", error);
    return fail("INTERNAL", GENERIC_ERROR);
  }
}

export type RefetchResult = { item: ItemInfo; message: string };

/**
 * « Relire la page du lien » : met à jour le prix s'il est trouvé, les photos candidates et la
 * catégorie proposée. Ne touche ni au nom, ni à la note, ni à la photo choisie, ni au rangement.
 */
export async function refetchItem(input: { itemId: string }): Promise<Result<RefetchResult>> {
  const itemId = uuid.safeParse(input?.itemId);
  if (!itemId.success) return fail("VALIDATION", GENERIC_ERROR);
  const guard = await guardItems([itemId.data]);
  if (!guard.ok) return guard.result;
  const { ctx } = guard;
  try {
    const limit = await hitRateLimit(`enrich:${ctx.list.id}`, 30, 60);
    if (!limit.allowed)
      return fail("RATE_LIMITED", "Beaucoup d'ajouts d'un coup. Réessayez dans quelques minutes.");
    const [current] = await readItems(ctx, [itemId.data]);
    if (!current?.url) return fail("VALIDATION", GENERIC_ERROR);

    const outcome = await enrichItem(itemId.data, "refetch", { db: ctx.db });
    let message = "Rien de nouveau sur la page.";
    if (outcome.error && outcome.error !== "empty") {
      message = FETCH_FAILED;
    } else if (outcome.priceAfter != null && outcome.priceAfter !== outcome.priceBefore) {
      const currency = outcome.currency ?? ctx.list.currency;
      const before =
        outcome.priceBefore != null ? formatPrice(outcome.priceBefore, currency) : "prix inconnu";
      message = `Prix mis à jour : ${formatPrice(outcome.priceAfter, currency)} (avant ${before})`;
    }
    revalidateList(ctx.list.slug);
    const [item] = await readItems(ctx, [itemId.data]);
    return item ? ok({ item, message }) : fail("NOT_FOUND", "Cet article n'existe plus.");
  } catch (error) {
    logError("refetchItem", error);
    return fail("INTERNAL", GENERIC_ERROR);
  }
}

// ---------------------------------------------------------------------------
// Suppression, ordre, actions groupées
// ---------------------------------------------------------------------------

/** Suppression douce (annulable 8 s ; purge après 30 jours). */
export async function deleteItems(input: { itemIds: string[] }): Promise<Result<{ itemIds: string[] }>> {
  const parsed = ids.safeParse(input.itemIds);
  if (!parsed.success) return fail("VALIDATION", GENERIC_ERROR);
  const guard = await guardItems(parsed.data);
  if (!guard.ok) return guard.result;
  const { ctx } = guard;
  const { error } = await ctx.db
    .from("items")
    .update({ deleted_at: new Date().toISOString() })
    .in("id", parsed.data);
  if (error) {
    logError("deleteItems", error);
    return fail("INTERNAL", GENERIC_ERROR);
  }
  revalidateList(ctx.list.slug);
  return ok({ itemIds: parsed.data });
}

/** « Annuler » : restaure à la même place. `CONFLICT` si un lien a été réajouté entre-temps. */
export async function restoreItems(input: { itemIds: string[] }): Promise<Result<{ restored: string[] }>> {
  const parsed = ids.safeParse(input.itemIds);
  if (!parsed.success) return fail("VALIDATION", GENERIC_ERROR);
  const guard = await guardItems(parsed.data, { withDeleted: true });
  if (!guard.ok) return guard.result;
  const { ctx } = guard;
  const restored: string[] = [];
  let conflict = false;
  for (const id of parsed.data) {
    const { error } = await ctx.db.from("items").update({ deleted_at: null }).eq("id", id);
    if (!error) restored.push(id);
    else if (error.code === UNIQUE_VIOLATION) conflict = true;
    else logError("restoreItems", error);
  }
  revalidateList(ctx.list.slug);
  if (conflict && restored.length === 0) return fail("CONFLICT", RESTORE_CONFLICT);
  return ok({ restored });
}

const moveInput = z.object({
  itemId: uuid,
  categoryId: uuid.nullable(),
  beforeId: uuid.nullable().optional(),
  afterId: uuid.nullable().optional(),
});

/** Glisser-déposer ou « Déplacer » : nouvelle catégorie et place entre deux voisins de destination. */
export async function moveItem(
  input: z.input<typeof moveInput>,
): Promise<Result<{ position: string; categoryId: string | null }>> {
  const parsed = moveInput.safeParse(input);
  if (!parsed.success) return fail("VALIDATION", GENERIC_ERROR);
  const { itemId, categoryId, beforeId, afterId } = parsed.data;
  const guard = await guardItems([itemId]);
  if (!guard.ok) return guard.result;
  const { ctx } = guard;
  try {
    if (categoryId && !(await categoryBelongs(ctx, categoryId))) return fail("NOT_FOUND", GENERIC_ERROR);
    const all = await listPositions(ctx);
    const others = all.filter((i) => i.id !== itemId);
    const before = beforeId ? others.find((i) => i.id === beforeId) : null;
    const after = afterId ? others.find((i) => i.id === afterId) : null;
    let position: string;
    if (!before && !after) {
      // Catégorie vide ou sans voisin indiqué : à la fin de la catégorie.
      [position] = keysAtEndOf(others, categoryId, 1) as [string];
    } else {
      position = keyBetween(others, before, after);
    }
    const [current] = await readItems(ctx, [itemId]);
    const update: TablesUpdate<"items"> = { position, category_id: categoryId };
    if (categoryId && !current?.sortedAt) update.sorted_at = new Date().toISOString();
    const { error } = await ctx.db.from("items").update(update).eq("id", itemId);
    if (error) throw new Error(error.message);
    revalidateList(ctx.list.slug);
    return ok({ position, categoryId });
  } catch (error) {
    logError("moveItem", error);
    return fail("INTERNAL", GENERIC_ERROR);
  }
}

const bulkInput = z.object({
  itemIds: ids,
  categoryId: uuid.nullable().optional(),
  addTagIds: z.array(uuid).optional(),
  removeTagIds: z.array(uuid).optional(),
  isFavorite: z.boolean().optional(),
});

/** Sélection multiple : catégorie (range les articles), tags ajoutés / retirés, coup de cœur. */
export async function bulkUpdate(input: z.input<typeof bulkInput>): Promise<Result<{ items: ItemInfo[] }>> {
  const parsed = bulkInput.safeParse(input);
  if (!parsed.success) return fail("VALIDATION", GENERIC_ERROR);
  const { itemIds, categoryId, addTagIds, removeTagIds, isFavorite } = parsed.data;
  const guard = await guardItems(itemIds);
  if (!guard.ok) return guard.result;
  const { ctx } = guard;
  try {
    if (categoryId && !(await categoryBelongs(ctx, categoryId))) return fail("NOT_FOUND", GENERIC_ERROR);
    if (categoryId !== undefined) {
      await ctx.db.from("items").update({ category_id: categoryId }).in("id", itemIds);
      if (categoryId) {
        await ctx.db
          .from("items")
          .update({ sorted_at: new Date().toISOString() })
          .in("id", itemIds)
          .is("sorted_at", null);
      }
    }
    if (isFavorite !== undefined)
      await ctx.db.from("items").update({ is_favorite: isFavorite }).in("id", itemIds);
    if (removeTagIds?.length)
      await ctx.db.from("item_tags").delete().in("item_id", itemIds).in("tag_id", removeTagIds);
    if (addTagIds?.length) {
      const rows = itemIds.flatMap((item_id) => addTagIds.map((tag_id) => ({ item_id, tag_id })));
      const { error } = await ctx.db.from("item_tags").upsert(rows, { ignoreDuplicates: true });
      if (error) return fail("NOT_FOUND", GENERIC_ERROR);
    }
    revalidateList(ctx.list.slug);
    return ok({ items: await readItems(ctx, itemIds) });
  } catch (error) {
    logError("bulkUpdate", error);
    return fail("INTERNAL", GENERIC_ERROR);
  }
}

const sortInput = z.object({
  itemId: uuid,
  categoryId: uuid.nullable(),
  tagIds: z.array(uuid).max(50),
  isFavorite: z.boolean(),
  title: z.string().max(200).optional(),
  priceCents: z.number().int().min(0).max(PRICE_MAX_CENTS).nullable().optional(),
});

/**
 * Tri rapide : « Valider » enregistre catégorie, tags et coup de cœur (et le nom ou le prix
 * corrigés en ligne), puis sort l'article de « À trier » (`sorted_at = now()`).
 */
export async function sortItem(input: z.input<typeof sortInput>): Promise<Result<ItemInfo>> {
  const parsed = sortInput.safeParse(input);
  if (!parsed.success) return fail("VALIDATION", GENERIC_ERROR);
  const { itemId, categoryId, tagIds, isFavorite, title, priceCents } = parsed.data;
  const guard = await guardItems([itemId]);
  if (!guard.ok) return guard.result;
  const { ctx } = guard;
  try {
    if (categoryId && !(await categoryBelongs(ctx, categoryId))) return fail("NOT_FOUND", GENERIC_ERROR);
    const [current] = await readItems(ctx, [itemId]);
    if (!current) return fail("NOT_FOUND", "Cet article n'existe plus.");
    if (tagIds.length) {
      const { count } = await ctx.db
        .from("tags")
        .select("id", { count: "exact", head: true })
        .eq("list_id", ctx.list.id)
        .in("id", tagIds);
      if (count !== new Set(tagIds).size) return fail("NOT_FOUND", GENERIC_ERROR);
    }

    const update: TablesUpdate<"items"> = {
      category_id: categoryId,
      is_favorite: isFavorite,
      sorted_at: new Date().toISOString(),
    };
    if (title !== undefined) {
      const clean = title.trim().replace(/\s+/g, " ");
      if (CONTROL.test(clean)) return fail("VALIDATION", GENERIC_ERROR, "title");
      if (clean !== (current.title ?? "")) update.title = clean;
    }
    if (priceCents !== undefined && priceCents !== current.priceCents) {
      update.price_cents = priceCents;
      update.price_source = priceCents === null ? null : "manual";
      update.currency = priceCents === null ? null : (current.currency ?? ctx.list.currency);
    }
    const { error } = await ctx.db.from("items").update(update).eq("id", itemId);
    if (error) throw new Error(error.message);

    const wanted = new Set(tagIds);
    const remove = current.tagIds.filter((t) => !wanted.has(t));
    const add = [...wanted].filter((t) => !current.tagIds.includes(t));
    if (remove.length) await ctx.db.from("item_tags").delete().eq("item_id", itemId).in("tag_id", remove);
    if (add.length) await ctx.db.from("item_tags").insert(add.map((tag_id) => ({ item_id: itemId, tag_id })));

    revalidateList(ctx.list.slug);
    const [item] = await readItems(ctx, [itemId]);
    return item ? ok(item) : fail("NOT_FOUND", "Cet article n'existe plus.");
  } catch (error) {
    logError("sortItem", error);
    return fail("INTERNAL", GENERIC_ERROR);
  }
}

const sortAllInput = z.object({ listId: uuid, categoryId: uuid });

/** « Tout ranger dans… » : tous les articles à trier reçoivent cette catégorie. */
export async function sortAllInbox(input: z.input<typeof sortAllInput>): Promise<Result<{ count: number }>> {
  const parsed = sortAllInput.safeParse(input);
  if (!parsed.success) return fail("VALIDATION", GENERIC_ERROR);
  const guard = await guardList(parsed.data.listId);
  if (!guard.ok) return guard.result;
  const { ctx } = guard;
  if (!(await categoryBelongs(ctx, parsed.data.categoryId))) return fail("NOT_FOUND", GENERIC_ERROR);
  const { data, error } = await ctx.db
    .from("items")
    .update({ category_id: parsed.data.categoryId, sorted_at: new Date().toISOString() })
    .eq("list_id", ctx.list.id)
    .is("sorted_at", null)
    .is("deleted_at", null)
    .select("id");
  if (error) {
    logError("sortAllInbox", error);
    return fail("INTERNAL", GENERIC_ERROR);
  }
  revalidateList(ctx.list.slug);
  return ok({ count: data?.length ?? 0 });
}
