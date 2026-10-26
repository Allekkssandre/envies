"use server";

import { randomInt } from "node:crypto";
import { generateKeyBetween } from "fractional-indexing";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { AMBIANCES, createListSchema } from "@/lib/schemas/list";
import { slugify } from "@/lib/text";
import { generateEditKey } from "@/server/auth/editKey";
import { hashPassword } from "@/server/auth/password";
import { clearEditCookie, reissueEditCookie } from "@/server/auth/session";
import type { ListInfo, TagColor } from "@/types/models";
import { guardList, revalidateList, type EditContext } from "./guard";
import { fail, GENERIC_ERROR, ok, type Result } from "./result";

// Réglages de la liste (docs/03-ecrans.md « Réglages », docs/06-api-et-securite.md).

const uuid = z.uuid();
const UNIQUE_VIOLATION = "23505";
const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const TAKEN = "Cette adresse est déjà prise.";
const TAG_COLORS = ["rouille", "ocre", "miel", "olive", "sauge", "ardoise", "prune", "sable"] as const;

function logError(where: string, error: unknown) {
  console.error(where, error instanceof Error ? error.message : error);
}

function revalidateAll(...slugs: string[]) {
  for (const slug of slugs) revalidatePath(`/l/${slug}`, "layout");
  revalidatePath("/");
}

// ---------------------------------------------------------------------------
// La liste
// ---------------------------------------------------------------------------

const listFields = createListSchema
  .pick({ title: true, ownerName: true, description: true, ambiance: true })
  .partial();
const updateListInput = z.object({ listId: uuid, patch: z.record(z.string(), z.unknown()) });

type ListPatch = {
  title?: string;
  ownerName?: string;
  description?: string;
  ambiance?: (typeof AMBIANCES)[number];
};

/** Nom, prénom, petit mot, ambiance : enregistrés champ par champ. */
export async function updateList(input: { listId: string; patch: ListPatch }): Promise<Result<ListInfo>> {
  const outer = updateListInput.safeParse(input);
  if (!outer.success) return fail("VALIDATION", GENERIC_ERROR);
  const parsed = listFields.safeParse(outer.data.patch);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return fail("VALIDATION", issue?.message ?? GENERIC_ERROR, String(issue?.path[0] ?? ""));
  }
  const guard = await guardList(outer.data.listId);
  if (!guard.ok) return guard.result;
  const { ctx } = guard;
  const p = parsed.data;
  const update: {
    title?: string;
    owner_name?: string;
    description?: string | null;
    ambiance?: ListPatch["ambiance"];
  } = {};
  if (p.title !== undefined) update.title = p.title;
  if (p.ownerName !== undefined) update.owner_name = p.ownerName;
  if (p.description !== undefined) update.description = p.description || null;
  if (p.ambiance !== undefined) update.ambiance = p.ambiance;
  const { data, error } = await ctx.db
    .from("lists")
    .update(update)
    .eq("id", ctx.list.id)
    .select("id, slug, title, owner_name, description, ambiance, currency")
    .single();
  if (error || !data) {
    logError("updateList", error);
    return fail("INTERNAL", GENERIC_ERROR);
  }
  revalidateAll(data.slug);
  return ok({
    id: data.id,
    slug: data.slug,
    title: data.title,
    ownerName: data.owner_name,
    description: data.description,
    ambiance: data.ambiance,
    currency: data.currency,
  });
}

/**
 * Nouvelle adresse : slugifiée, unique (listes et anciennes adresses des autres listes).
 * L'ancienne adresse redirige (308) vers la nouvelle.
 */
export async function updateSlug(input: { listId: string; slug: string }): Promise<Result<{ slug: string }>> {
  const parsed = z.object({ listId: uuid, slug: z.string().max(200) }).safeParse(input);
  if (!parsed.success) return fail("VALIDATION", GENERIC_ERROR, "slug");
  const slug = slugify(parsed.data.slug, 80);
  if (!slug || !SLUG.test(slug)) return fail("VALIDATION", GENERIC_ERROR, "slug");
  const guard = await guardList(parsed.data.listId);
  if (!guard.ok) return guard.result;
  const { ctx } = guard;
  const old = ctx.list.slug;
  if (slug === old) return ok({ slug });
  try {
    const [{ data: other }, { data: redirect }] = await Promise.all([
      ctx.db.from("lists").select("id").eq("slug", slug).maybeSingle(),
      ctx.db.from("list_redirects").select("list_id").eq("old_slug", slug).maybeSingle(),
    ]);
    if (other || (redirect && redirect.list_id !== ctx.list.id)) return fail("DUPLICATE", TAKEN, "slug");
    // Retour à une ancienne adresse de cette liste : elle ne redirige plus.
    if (redirect) await ctx.db.from("list_redirects").delete().eq("old_slug", slug);
    const { error } = await ctx.db.from("lists").update({ slug }).eq("id", ctx.list.id);
    if (error) {
      if (error.code === UNIQUE_VIOLATION) return fail("DUPLICATE", TAKEN, "slug");
      throw new Error(error.message);
    }
    await ctx.db.from("list_redirects").upsert({ old_slug: old, list_id: ctx.list.id });
    revalidateAll(old, slug);
    return ok({ slug });
  } catch (error) {
    logError("updateSlug", error);
    return fail("INTERNAL", GENERIC_ERROR);
  }
}

// ---------------------------------------------------------------------------
// Accès
// ---------------------------------------------------------------------------

async function bumpVersion(ctx: EditContext, patch: { password_hash?: string; edit_key?: string }) {
  const { data: current } = await ctx.db
    .from("list_secrets")
    .select("auth_version")
    .eq("list_id", ctx.list.id)
    .single();
  const version = (current?.auth_version ?? 1) + 1;
  const { error } = await ctx.db
    .from("list_secrets")
    .update({ ...patch, auth_version: version })
    .eq("list_id", ctx.list.id);
  return { version, error };
}

/** Nouveau mot de passe : les autres appareils devront le saisir ; celui-ci reste déverrouillé. */
export async function changePassword(input: { listId: string; newPassword: string }): Promise<Result<null>> {
  const parsed = z.object({ listId: uuid, newPassword: createListSchema.shape.password }).safeParse(input);
  if (!parsed.success) {
    return fail("VALIDATION", parsed.error.issues[0]?.message ?? GENERIC_ERROR, "password");
  }
  const guard = await guardList(parsed.data.listId);
  if (!guard.ok) return guard.result;
  const { ctx } = guard;
  try {
    const { version, error } = await bumpVersion(ctx, {
      password_hash: await hashPassword(parsed.data.newPassword),
    });
    if (error) throw new Error(error.message);
    await reissueEditCookie(ctx.list.id, version);
    return ok(null);
  } catch (error) {
    logError("changePassword", error);
    return fail("INTERNAL", GENERIC_ERROR);
  }
}

/** Nouveau lien secret : l'ancien ne marche plus, les autres appareils sont verrouillés. */
export async function regenerateEditKey(input: { listId: string }): Promise<Result<{ editKey: string }>> {
  const parsed = uuid.safeParse(input?.listId);
  if (!parsed.success) return fail("VALIDATION", GENERIC_ERROR);
  const guard = await guardList(parsed.data);
  if (!guard.ok) return guard.result;
  const { ctx } = guard;
  try {
    for (let attempt = 0; attempt < 5; attempt++) {
      const key = generateEditKey();
      const { version, error } = await bumpVersion(ctx, { edit_key: key });
      if (!error) {
        await reissueEditCookie(ctx.list.id, version);
        return ok({ editKey: key });
      }
      if (error.code !== UNIQUE_VIOLATION) throw new Error(error.message);
    }
    throw new Error("aucune clé libre");
  } catch (error) {
    logError("regenerateEditKey", error);
    return fail("INTERNAL", GENERIC_ERROR);
  }
}

/** Supprimer la liste : le nom tapé doit correspondre exactement. Suppression douce, adresse libérée. */
export async function deleteList(input: { listId: string; confirmTitle: string }): Promise<Result<null>> {
  const parsed = z.object({ listId: uuid, confirmTitle: z.string().max(200) }).safeParse(input);
  if (!parsed.success) return fail("VALIDATION", GENERIC_ERROR);
  const guard = await guardList(parsed.data.listId);
  if (!guard.ok) return guard.result;
  const { ctx } = guard;
  try {
    const { data: list } = await ctx.db.from("lists").select("title").eq("id", ctx.list.id).single();
    if (!list || parsed.data.confirmTitle !== list.title) return fail("VALIDATION", GENERIC_ERROR, "confirm");
    const suffix = Array.from(
      { length: 6 },
      () => "abcdefghijklmnopqrstuvwxyz0123456789"[randomInt(36)],
    ).join("");
    const freed = `${ctx.list.slug.slice(0, 60).replace(/-+$/, "")}-supprimee-${suffix}`;
    const { error } = await ctx.db
      .from("lists")
      .update({ deleted_at: new Date().toISOString(), slug: freed })
      .eq("id", ctx.list.id);
    if (error) throw new Error(error.message);
    await ctx.db.from("list_redirects").delete().eq("list_id", ctx.list.id);
    await clearEditCookie(ctx.list.id);
    revalidateAll(ctx.list.slug);
    return ok(null);
  } catch (error) {
    logError("deleteList", error);
    return fail("INTERNAL", GENERIC_ERROR);
  }
}

// ---------------------------------------------------------------------------
// Catégories et tags
// ---------------------------------------------------------------------------

export type DeletedCategory = {
  category: { id: string; ref: string; name: string; position: string };
  itemIds: string[];
};

/** Supprimer une catégorie : ses articles passent dans « Non classé ». Renvoie de quoi « Annuler ». */
export async function deleteCategory(input: {
  listId: string;
  categoryId: string;
}): Promise<Result<DeletedCategory>> {
  const parsed = z.object({ listId: uuid, categoryId: uuid }).safeParse(input);
  if (!parsed.success) return fail("VALIDATION", GENERIC_ERROR);
  const guard = await guardList(parsed.data.listId);
  if (!guard.ok) return guard.result;
  const { ctx } = guard;
  try {
    const { data: category } = await ctx.db
      .from("categories")
      .select("id, ref, name, position")
      .eq("id", parsed.data.categoryId)
      .eq("list_id", ctx.list.id)
      .maybeSingle();
    if (!category) return fail("NOT_FOUND", GENERIC_ERROR);
    const { data: items } = await ctx.db
      .from("items")
      .update({ category_id: null })
      .eq("list_id", ctx.list.id)
      .eq("category_id", category.id)
      .select("id");
    const { error } = await ctx.db.from("categories").delete().eq("id", category.id);
    if (error) throw new Error(error.message);
    revalidateList(ctx.list.slug);
    return ok({ category, itemIds: (items ?? []).map((i) => i.id) });
  } catch (error) {
    logError("deleteCategory", error);
    return fail("INTERNAL", GENERIC_ERROR);
  }
}

/** « Annuler » : la catégorie revient avec le même identifiant, et ses articles avec elle. */
export async function restoreCategory(input: { listId: string } & DeletedCategory): Promise<Result<null>> {
  const parsed = z
    .object({
      listId: uuid,
      category: z.object({
        id: uuid,
        ref: z.string().max(20),
        name: z.string().min(1).max(40),
        position: z.string().max(80),
      }),
      itemIds: z.array(uuid).max(5000),
    })
    .safeParse(input);
  if (!parsed.success) return fail("VALIDATION", GENERIC_ERROR);
  const guard = await guardList(parsed.data.listId);
  if (!guard.ok) return guard.result;
  const { ctx } = guard;
  const { category, itemIds } = parsed.data;
  const { error } = await ctx.db.from("categories").insert({ ...category, list_id: ctx.list.id });
  if (error) {
    if (error.code === UNIQUE_VIOLATION) return fail("CONFLICT", "Ce nom existe déjà.");
    logError("restoreCategory", error);
    return fail("INTERNAL", GENERIC_ERROR);
  }
  if (itemIds.length) {
    await ctx.db
      .from("items")
      .update({ category_id: category.id })
      .eq("list_id", ctx.list.id)
      .in("id", itemIds)
      .is("category_id", null);
  }
  revalidateList(ctx.list.slug);
  return ok(null);
}

const tagInput = z.object({
  listId: uuid,
  tagId: uuid,
  name: z.string().optional(),
  color: z.enum(TAG_COLORS).optional(),
});

/** Renommer un tag ou changer sa couleur. */
export async function updateTag(
  input: z.input<typeof tagInput>,
): Promise<Result<{ name: string; color: TagColor }>> {
  const parsed = tagInput.safeParse(input);
  if (!parsed.success) return fail("VALIDATION", GENERIC_ERROR);
  const guard = await guardList(parsed.data.listId);
  if (!guard.ok) return guard.result;
  const { ctx } = guard;
  const update: { name?: string; color?: TagColor } = {};
  if (parsed.data.name !== undefined) {
    const name = parsed.data.name.trim().replace(/\s+/g, " ");
    if (name.length < 1 || name.length > 30) return fail("VALIDATION", "30 caractères au plus.", "name");
    update.name = name;
  }
  if (parsed.data.color) update.color = parsed.data.color;
  const { data, error } = await ctx.db
    .from("tags")
    .update(update)
    .eq("id", parsed.data.tagId)
    .eq("list_id", ctx.list.id)
    .select("name, color")
    .maybeSingle();
  if (error) {
    if (error.code === UNIQUE_VIOLATION) return fail("DUPLICATE", "Ce nom existe déjà.", "name");
    logError("updateTag", error);
    return fail("INTERNAL", GENERIC_ERROR);
  }
  if (!data) return fail("NOT_FOUND", GENERIC_ERROR);
  revalidateList(ctx.list.slug);
  return ok(data);
}

/** Réordonner les tags (même principe que les catégories). */
export async function moveTag(input: {
  listId: string;
  tagId: string;
  beforeId?: string | null;
  afterId?: string | null;
}): Promise<Result<{ position: string }>> {
  const parsed = z
    .object({
      listId: uuid,
      tagId: uuid,
      beforeId: uuid.nullable().optional(),
      afterId: uuid.nullable().optional(),
    })
    .safeParse(input);
  if (!parsed.success) return fail("VALIDATION", GENERIC_ERROR);
  const guard = await guardList(parsed.data.listId);
  if (!guard.ok) return guard.result;
  const { ctx } = guard;
  const { data: rows } = await ctx.db.from("tags").select("id, position").eq("list_id", ctx.list.id);
  if (!(rows ?? []).some((r) => r.id === parsed.data.tagId)) return fail("NOT_FOUND", GENERIC_ERROR);
  const others = (rows ?? []).filter((r) => r.id !== parsed.data.tagId);
  const before = others.find((r) => r.id === parsed.data.beforeId)?.position ?? null;
  const after = others.find((r) => r.id === parsed.data.afterId)?.position ?? null;
  const position =
    before && after && before >= after ? generateKeyBetween(before, null) : generateKeyBetween(before, after);
  const { error } = await ctx.db.from("tags").update({ position }).eq("id", parsed.data.tagId);
  if (error) return fail("INTERNAL", GENERIC_ERROR);
  revalidateList(ctx.list.slug);
  return ok({ position });
}

export type DeletedTag = {
  tag: { id: string; name: string; color: TagColor; position: string };
  itemIds: string[];
};

/** Supprimer un tag (retiré de ses articles). Renvoie de quoi « Annuler ». */
export async function deleteTag(input: { listId: string; tagId: string }): Promise<Result<DeletedTag>> {
  const parsed = z.object({ listId: uuid, tagId: uuid }).safeParse(input);
  if (!parsed.success) return fail("VALIDATION", GENERIC_ERROR);
  const guard = await guardList(parsed.data.listId);
  if (!guard.ok) return guard.result;
  const { ctx } = guard;
  try {
    const { data: tag } = await ctx.db
      .from("tags")
      .select("id, name, color, position")
      .eq("id", parsed.data.tagId)
      .eq("list_id", ctx.list.id)
      .maybeSingle();
    if (!tag) return fail("NOT_FOUND", GENERIC_ERROR);
    const { data: links } = await ctx.db.from("item_tags").select("item_id").eq("tag_id", tag.id);
    const { error } = await ctx.db.from("tags").delete().eq("id", tag.id);
    if (error) throw new Error(error.message);
    revalidateList(ctx.list.slug);
    return ok({ tag, itemIds: (links ?? []).map((l) => l.item_id) });
  } catch (error) {
    logError("deleteTag", error);
    return fail("INTERNAL", GENERIC_ERROR);
  }
}

/** « Annuler » : le tag revient (même identifiant) sur les mêmes articles. */
export async function restoreTag(input: { listId: string } & DeletedTag): Promise<Result<null>> {
  const parsed = z
    .object({
      listId: uuid,
      tag: z.object({
        id: uuid,
        name: z.string().min(1).max(30),
        color: z.enum(TAG_COLORS),
        position: z.string().max(80),
      }),
      itemIds: z.array(uuid).max(5000),
    })
    .safeParse(input);
  if (!parsed.success) return fail("VALIDATION", GENERIC_ERROR);
  const guard = await guardList(parsed.data.listId);
  if (!guard.ok) return guard.result;
  const { ctx } = guard;
  const { tag, itemIds } = parsed.data;
  const { error } = await ctx.db.from("tags").insert({ ...tag, list_id: ctx.list.id });
  if (error) {
    if (error.code === UNIQUE_VIOLATION) return fail("CONFLICT", "Ce nom existe déjà.");
    logError("restoreTag", error);
    return fail("INTERNAL", GENERIC_ERROR);
  }
  if (itemIds.length) {
    const { data: items } = await ctx.db
      .from("items")
      .select("id")
      .eq("list_id", ctx.list.id)
      .in("id", itemIds);
    const rows = (items ?? []).map((i) => ({ item_id: i.id, tag_id: tag.id }));
    if (rows.length) await ctx.db.from("item_tags").upsert(rows, { ignoreDuplicates: true });
  }
  revalidateList(ctx.list.slug);
  return ok(null);
}
