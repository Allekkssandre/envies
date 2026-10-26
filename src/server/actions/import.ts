"use server";

import { generateNKeysBetween } from "fractional-indexing";
import { z } from "zod";
import { normalizeUrl } from "@/lib/normalizeUrl";
import { byPosition, keysAtStart } from "@/lib/positions";
import { PRICE_MAX_CENTS } from "@/lib/price";
import { normalizeText } from "@/lib/text";
import { hitRateLimit } from "@/server/auth/rateLimit";
import { enrichLater } from "@/server/enrich/later";
import type { TablesInsert } from "@/types/database";
import type { TagColor } from "@/types/models";
import { guardList, revalidateList, type EditContext } from "./guard";
import { fail, GENERIC_ERROR, ok, type Result } from "./result";

// Import d'un fichier (docs/08-import-export.md) : le navigateur envoie les lignes déjà converties,
// par lots de 200. Ici : revalidation, catégories et tags manquants, doublons, insertion en tête.

const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;
const TAG_COLORS: TagColor[] = ["rouille", "ocre", "miel", "olive", "sauge", "ardoise", "prune", "sable"];
const text = (max: number) =>
  z
    .string()
    .transform((s) => s.trim().replace(/\s+/g, " "))
    .refine((s) => s.length <= max && !CONTROL.test(s));

const rowSchema = z.object({
  title: text(200).nullable(),
  url: z.string().max(2048).nullable(),
  priceCents: z.number().int().min(1).max(PRICE_MAX_CENTS).nullable(),
  currency: z
    .string()
    .regex(/^[A-Z]{3}$/)
    .nullable(),
  category: text(40).nullable(),
  tags: z.array(text(30)).max(20),
  isFavorite: z.boolean(),
  note: z
    .string()
    .max(500)
    .refine((s) => !CONTROL.test(s.replace(/[\n\r\t]/g, " ")))
    .nullable(),
  imageUrl: z.string().url().max(2048).nullable(),
});

const importInput = z.object({
  listId: z.uuid(),
  rows: z.array(rowSchema).min(1).max(200),
  enrich: z.boolean(),
  sorted: z.boolean(),
});

export type ImportBatchResult = {
  created: number;
  duplicates: number;
  ignored: number;
  categoriesCreated: string[];
  tagsCreated: string[];
};

/** Catégories (ou tags) de la liste, retrouvées par leur nom normalisé ; les manquants sont créés à la fin. */
async function ensureNames(
  ctx: EditContext,
  table: "categories" | "tags",
  names: string[],
): Promise<{ ids: Map<string, string>; created: string[] }> {
  const { data: existing } = await ctx.db.from(table).select("id, name, position").eq("list_id", ctx.list.id);
  const ids = new Map((existing ?? []).map((r) => [normalizeText(r.name), r.id]));
  const missing: string[] = [];
  for (const name of names) {
    const key = normalizeText(name);
    if (!key || ids.has(key) || missing.some((m) => normalizeText(m) === key)) continue;
    missing.push(name);
  }
  if (!missing.length) return { ids, created: [] };

  const last = [...(existing ?? [])].sort(byPosition)[(existing?.length ?? 0) - 1]?.position ?? null;
  const positions = generateNKeysBetween(last, null, missing.length);
  if (table === "categories") {
    await ctx.db.from("categories").upsert(
      missing.map((name, i) => ({ list_id: ctx.list.id, name, position: positions[i]! })),
      { onConflict: "list_id,name_key", ignoreDuplicates: true },
    );
  } else {
    const used = new Set((existing ?? []).length ? await usedColors(ctx) : []);
    const free = TAG_COLORS.filter((c) => !used.has(c));
    const palette = free.length ? [...free, ...TAG_COLORS] : TAG_COLORS;
    await ctx.db.from("tags").upsert(
      missing.map((name, i) => ({
        list_id: ctx.list.id,
        name,
        position: positions[i]!,
        color: palette[i % palette.length]!,
      })),
      { onConflict: "list_id,name_key", ignoreDuplicates: true },
    );
  }
  const { data: after } = await ctx.db.from(table).select("id, name").eq("list_id", ctx.list.id);
  const known = new Set(ids.keys());
  const all = new Map((after ?? []).map((r) => [normalizeText(r.name), r.id]));
  return {
    ids: all,
    created: missing.filter((m) => !known.has(normalizeText(m)) && all.has(normalizeText(m))),
  };
}

async function usedColors(ctx: EditContext): Promise<TagColor[]> {
  const { data } = await ctx.db.from("tags").select("color").eq("list_id", ctx.list.id);
  return (data ?? []).map((t) => t.color);
}

/**
 * Un lot de lignes : insérées en tête de liste (le navigateur envoie les lots du dernier au premier,
 * l'ordre du fichier est donc gardé), doublons ignorés, puis lecture des liens en arrière-plan.
 */
export async function importItems(input: z.input<typeof importInput>): Promise<Result<ImportBatchResult>> {
  const parsed = importInput.safeParse(input);
  if (!parsed.success) return fail("VALIDATION", GENERIC_ERROR);
  const { listId, rows, enrich, sorted } = parsed.data;
  const guard = await guardList(listId);
  if (!guard.ok) return guard.result;
  const { ctx } = guard;
  try {
    const limit = await hitRateLimit(`import:${ctx.list.id}`, 30, 60 * 60);
    if (!limit.allowed)
      return fail("RATE_LIMITED", "Beaucoup d'ajouts d'un coup. Réessayez dans quelques minutes.");

    // Liens : normalisés à nouveau, doublons avec la liste et dans le lot.
    const { data: existing } = await ctx.db
      .from("items")
      .select("url_key, position")
      .eq("list_id", ctx.list.id)
      .is("deleted_at", null);
    const seen = new Set((existing ?? []).map((r) => r.url_key).filter((k): k is string => Boolean(k)));
    let duplicates = 0;
    let ignored = 0;
    const fresh: (z.output<typeof rowSchema> & { link: ReturnType<typeof normalizeUrl> })[] = [];
    for (const row of rows) {
      const link = row.url ? normalizeUrl(row.url) : null;
      if (!row.title && !link) {
        ignored++;
        continue;
      }
      if (link) {
        if (seen.has(link.urlKey)) {
          duplicates++;
          continue;
        }
        seen.add(link.urlKey);
      }
      fresh.push({ ...row, link });
    }
    if (!fresh.length) return ok({ created: 0, duplicates, ignored, categoriesCreated: [], tagsCreated: [] });

    const categories = await ensureNames(
      ctx,
      "categories",
      fresh.map((r) => r.category).filter((c): c is string => Boolean(c)),
    );
    const tags = await ensureNames(
      ctx,
      "tags",
      fresh.flatMap((r) => r.tags),
    );

    const first = [...(existing ?? [])].sort(byPosition)[0]?.position ?? null;
    const positions = keysAtStart(first, fresh.length);
    const now = new Date().toISOString();
    const records: TablesInsert<"items">[] = fresh.map((r, i) => {
      const categoryId = r.category ? (categories.ids.get(normalizeText(r.category)) ?? null) : null;
      return {
        list_id: ctx.list.id,
        title: r.title,
        url: r.link?.url ?? null,
        url_key: r.link?.urlKey ?? null,
        domain: r.link?.domain ?? null,
        price_cents: r.priceCents,
        currency: r.priceCents ? (r.currency ?? ctx.list.currency) : null,
        price_source: r.priceCents ? "manual" : null,
        category_id: categoryId,
        sorted_at: sorted && categoryId ? now : null,
        is_favorite: r.isFavorite,
        note: r.note?.trim() || null,
        position: positions[i]!,
        fetch_status: r.link && enrich ? "pending" : "none",
        meta: r.imageUrl ? { importImageUrl: r.imageUrl } : {},
      };
    });

    let inserted: { id: string; url: string | null; meta: unknown }[] = [];
    const { data, error } = await ctx.db.from("items").insert(records).select("id, url, meta");
    if (error) {
      // Un lien ajouté entre-temps : on insère un par un, les doublons sont ignorés.
      for (const record of records) {
        const one = await ctx.db.from("items").insert(record).select("id, url, meta").maybeSingle();
        if (one.data) inserted.push(one.data);
        else duplicates++;
      }
    } else {
      inserted = data ?? [];
    }

    const byKey = new Map(records.map((r, i) => [r.position, fresh[i]!]));
    const { data: rowsWithPos } = await ctx.db
      .from("items")
      .select("id, position")
      .in(
        "id",
        inserted.map((r) => r.id),
      );
    const links = (rowsWithPos ?? []).flatMap((r) => {
      const source = byKey.get(r.position);
      return (source?.tags ?? [])
        .map((t) => tags.ids.get(normalizeText(t)))
        .filter((id): id is string => Boolean(id))
        .map((tag_id) => ({ item_id: r.id, tag_id }));
    });
    if (links.length) await ctx.db.from("item_tags").upsert(links, { ignoreDuplicates: true });

    // Lecture des liens (si demandée) et photos données dans le fichier.
    const toEnrich = inserted
      .filter(
        (r) =>
          (enrich && r.url) || (typeof r.meta === "object" && r.meta !== null && "importImageUrl" in r.meta),
      )
      .map((r) => r.id);
    enrichLater(toEnrich, ctx.list.slug);
    revalidateList(ctx.list.slug);
    return ok({
      created: inserted.length,
      duplicates,
      ignored,
      categoriesCreated: categories.created,
      tagsCreated: tags.created,
    });
  } catch (error) {
    console.error("importItems", error instanceof Error ? error.message : error);
    return fail("INTERNAL", GENERIC_ERROR);
  }
}
