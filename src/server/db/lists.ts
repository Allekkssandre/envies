import "server-only";
import { cache } from "react";
import { slugify } from "@/lib/text";
import type { Tables } from "@/types/database";
import type { ListContent, ListInfo, ListSummary } from "@/types/models";
import { ITEM_COLUMNS, stringArray, toItemInfo } from "./mappers";
import { getAnonDb } from "./client";

// Lectures visiteur : client anon, la RLS masque les lignes supprimées.

function toListInfo(row: Tables<"lists">): ListInfo {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    ownerName: row.owner_name,
    description: row.description,
    ambiance: row.ambiance,
    currency: row.currency,
  };
}

/** Accueil : toutes les listes avec leurs compteurs. */
export const getListSummaries = cache(async (): Promise<ListSummary[]> => {
  const { data, error } = await getAnonDb()
    .from("list_summaries")
    .select(
      "id, slug, title, owner_name, description, ambiance, currency, item_count, favorite_count, thumbs, content_updated_at",
    )
    .order("content_updated_at", { ascending: false });
  if (error) throw new Error(`Lecture des listes impossible : ${error.message}`);
  return (data ?? [])
    .filter((r) => r.id && r.slug && r.title)
    .map((r) => ({
      id: r.id!,
      slug: r.slug!,
      title: r.title!,
      ownerName: r.owner_name ?? "",
      description: r.description,
      ambiance: r.ambiance ?? "feuillage",
      currency: r.currency ?? "EUR",
      itemCount: r.item_count ?? 0,
      favoriteCount: r.favorite_count ?? 0,
      thumbs: stringArray(r.thumbs),
      contentUpdatedAt: r.content_updated_at ?? new Date(0).toISOString(),
    }));
});

export type ListLookup =
  { kind: "found"; list: ListInfo } | { kind: "redirect"; slug: string } | { kind: "missing" };

/** Liste par slug, ou slug ancien à rediriger. Dédupliquée par requête (layout + page). */
export const getListBySlug = cache(async (slug: string): Promise<ListLookup> => {
  const db = getAnonDb();
  const { data, error } = await db.from("lists").select("*").eq("slug", slug).maybeSingle();
  if (error) throw new Error(`Lecture de la liste impossible : ${error.message}`);
  if (data) return { kind: "found", list: toListInfo(data) };

  const { data: redirect } = await db
    .from("list_redirects")
    .select("list_id, lists(slug)")
    .eq("old_slug", slug)
    .maybeSingle();
  const target = redirect?.lists?.slug;
  return target ? { kind: "redirect", slug: target } : { kind: "missing" };
});

/** Catégories, tags et articles d'une liste. */
export const getListContent = cache(async (listId: string): Promise<ListContent> => {
  const db = getAnonDb();
  const loadedAt = Date.now();
  const [categories, tags, items] = await Promise.all([
    db.from("categories").select("id, ref, name, position").eq("list_id", listId).order("position"),
    db.from("tags").select("id, name, color, position").eq("list_id", listId).order("position"),
    db.from("items").select(ITEM_COLUMNS).eq("list_id", listId).order("position"),
  ]);
  const failed = categories.error ?? tags.error ?? items.error;
  if (failed) throw new Error(`Lecture du contenu impossible : ${failed.message}`);

  return {
    loadedAt,
    categories: categories.data ?? [],
    tags: (tags.data ?? []).map((t) => ({ ...t, slug: slugify(t.name) })),
    items: (items.data ?? []).map(toItemInfo),
  };
});
