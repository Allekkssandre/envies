"use server";

import { generateKeyBetween } from "fractional-indexing";
import { z } from "zod";
import { slugify } from "@/lib/text";
import type { CategoryInfo, TagColor, TagInfo } from "@/types/models";
import { guardList, revalidateList, type EditContext } from "./guard";
import { fail, GENERIC_ERROR, ok, type Result } from "./result";

// Catégories et tags créés en ligne (édition, panneau de l'article, sélection).

const uuid = z.uuid();
const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;
const TAG_COLORS: TagColor[] = ["rouille", "ocre", "miel", "olive", "sauge", "ardoise", "prune", "sable"];

const clean = (s: string) => s.trim().replace(/\s+/g, " ");

async function lastPosition(ctx: EditContext, table: "categories" | "tags"): Promise<string | null> {
  const { data } = await ctx.db
    .from(table)
    .select("position")
    .eq("list_id", ctx.list.id)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.position ?? null;
}

/** Clé de nom (insensible à la casse et aux accents), calculée comme `name_key` en base. */
async function nameKey(ctx: EditContext, name: string): Promise<string | null> {
  const { data } = await ctx.db.rpc("normalize_key", { p: name });
  return data ?? null;
}

/** Nom déjà pris : on renvoie l'existant. */
async function findCategoryByName(ctx: EditContext, name: string) {
  const key = await nameKey(ctx, name);
  if (!key) return null;
  const { data } = await ctx.db
    .from("categories")
    .select("id, ref, name, position")
    .eq("list_id", ctx.list.id)
    .eq("name_key", key)
    .maybeSingle();
  return data;
}

async function findTagByName(ctx: EditContext, name: string) {
  const key = await nameKey(ctx, name);
  if (!key) return null;
  const { data } = await ctx.db
    .from("tags")
    .select("id, name, color, position")
    .eq("list_id", ctx.list.id)
    .eq("name_key", key)
    .maybeSingle();
  return data;
}

const categoryInput = z.object({ listId: uuid, name: z.string() });

export type CreatedCategory = { category: CategoryInfo; existed: boolean };

/** Nouvelle catégorie, en dernier. Si le nom existe déjà, renvoie l'existante (l'interface la sélectionne). */
export async function createCategory(input: z.input<typeof categoryInput>): Promise<Result<CreatedCategory>> {
  const parsed = categoryInput.safeParse(input);
  if (!parsed.success) return fail("VALIDATION", GENERIC_ERROR);
  const name = clean(parsed.data.name);
  if (name.length < 1 || name.length > 40 || CONTROL.test(name)) {
    return fail("VALIDATION", "40 caractères au plus.", "name");
  }
  const guard = await guardList(parsed.data.listId);
  if (!guard.ok) return guard.result;
  const { ctx } = guard;
  try {
    const existing = await findCategoryByName(ctx, name);
    if (existing) {
      return ok({
        category: { id: existing.id, ref: existing.ref, name: existing.name, position: existing.position },
        existed: true,
      });
    }
    const position = generateKeyBetween(await lastPosition(ctx, "categories"), null);
    const { data, error } = await ctx.db
      .from("categories")
      .insert({ list_id: ctx.list.id, name, position })
      .select("id, ref, name, position")
      .single();
    if (error || !data) throw new Error(error?.message ?? "insertion impossible");
    revalidateList(ctx.list.slug);
    return ok({ category: data, existed: false });
  } catch (error) {
    console.error("createCategory", error instanceof Error ? error.message : error);
    return fail("INTERNAL", GENERIC_ERROR);
  }
}

const renameInput = z.object({ listId: uuid, categoryId: uuid, name: z.string() });

/** Renommer en ligne. `DUPLICATE` si une autre catégorie porte déjà ce nom. */
export async function renameCategory(input: z.input<typeof renameInput>): Promise<Result<CategoryInfo>> {
  const parsed = renameInput.safeParse(input);
  if (!parsed.success) return fail("VALIDATION", GENERIC_ERROR);
  const name = clean(parsed.data.name);
  if (name.length < 1 || name.length > 40 || CONTROL.test(name)) {
    return fail("VALIDATION", "40 caractères au plus.", "name");
  }
  const guard = await guardList(parsed.data.listId);
  if (!guard.ok) return guard.result;
  const { ctx } = guard;
  const existing = await findCategoryByName(ctx, name);
  if (existing && existing.id !== parsed.data.categoryId)
    return fail("DUPLICATE", "Ce nom existe déjà.", "name");
  const { data, error } = await ctx.db
    .from("categories")
    .update({ name })
    .eq("id", parsed.data.categoryId)
    .eq("list_id", ctx.list.id)
    .select("id, ref, name, position")
    .maybeSingle();
  if (error || !data) return fail("NOT_FOUND", GENERIC_ERROR);
  revalidateList(ctx.list.slug);
  return ok(data);
}

const moveInput = z.object({
  listId: uuid,
  categoryId: uuid,
  beforeId: uuid.nullable().optional(),
  afterId: uuid.nullable().optional(),
});

/** Réordonner les sections : nouvelle clé entre la catégorie qui précède et celle qui suit. */
export async function moveCategory(input: z.input<typeof moveInput>): Promise<Result<{ position: string }>> {
  const parsed = moveInput.safeParse(input);
  if (!parsed.success) return fail("VALIDATION", GENERIC_ERROR);
  const guard = await guardList(parsed.data.listId);
  if (!guard.ok) return guard.result;
  const { ctx } = guard;
  const { data: rows } = await ctx.db.from("categories").select("id, position").eq("list_id", ctx.list.id);
  const all = (rows ?? []).filter((r) => r.id !== parsed.data.categoryId);
  const before = all.find((r) => r.id === parsed.data.beforeId)?.position ?? null;
  const after = all.find((r) => r.id === parsed.data.afterId)?.position ?? null;
  if (!(rows ?? []).some((r) => r.id === parsed.data.categoryId)) return fail("NOT_FOUND", GENERIC_ERROR);
  const position =
    before && after && before >= after ? generateKeyBetween(before, null) : generateKeyBetween(before, after);
  const { error } = await ctx.db.from("categories").update({ position }).eq("id", parsed.data.categoryId);
  if (error) return fail("INTERNAL", GENERIC_ERROR);
  revalidateList(ctx.list.slug);
  return ok({ position });
}

const tagInput = z.object({ listId: uuid, name: z.string() });

export type CreatedTag = { tag: TagInfo; existed: boolean };

/** Nouveau tag : prend la première couleur pas encore utilisée. Nom existant → tag existant. */
export async function createTag(input: z.input<typeof tagInput>): Promise<Result<CreatedTag>> {
  const parsed = tagInput.safeParse(input);
  if (!parsed.success) return fail("VALIDATION", GENERIC_ERROR);
  const name = clean(parsed.data.name);
  if (name.length < 1 || name.length > 30 || CONTROL.test(name)) {
    return fail("VALIDATION", "30 caractères au plus.", "name");
  }
  const guard = await guardList(parsed.data.listId);
  if (!guard.ok) return guard.result;
  const { ctx } = guard;
  try {
    const existing = await findTagByName(ctx, name);
    const toInfo = (t: { id: string; name: string; color: TagColor; position: string }): TagInfo => ({
      id: t.id,
      name: t.name,
      color: t.color,
      position: t.position,
      slug: slugify(t.name),
    });
    if (existing) return ok({ tag: toInfo(existing), existed: true });
    const { data: used } = await ctx.db.from("tags").select("color").eq("list_id", ctx.list.id);
    const usedColors = new Set((used ?? []).map((t) => t.color));
    const color =
      TAG_COLORS.find((c) => !usedColors.has(c)) ?? TAG_COLORS[(used?.length ?? 0) % TAG_COLORS.length]!;
    const position = generateKeyBetween(await lastPosition(ctx, "tags"), null);
    const { data, error } = await ctx.db
      .from("tags")
      .insert({ list_id: ctx.list.id, name, color, position })
      .select("id, name, color, position")
      .single();
    if (error || !data) throw new Error(error?.message ?? "insertion impossible");
    revalidateList(ctx.list.slug);
    return ok({ tag: toInfo(data), existed: false });
  } catch (error) {
    console.error("createTag", error instanceof Error ? error.message : error);
    return fail("INTERNAL", GENERIC_ERROR);
  }
}
