import "server-only";
import { cache } from "react";
import { slugify } from "@/lib/text";
import type { Tables } from "@/types/database";
import type { ListContent, ListInfo, ListSummary } from "@/types/models";
import { ITEM_COLUMNS, stringArray, toItemInfo } from "./mappers";
import { getAnonDb, getServiceDb } from "./client";

// Lectures visiteur : client anon, la RLS masque les lignes supprimées et le contenu des
// listes privées. La liste elle-même, l'accueil et le contenu d'une liste privée sont lus
// avec la clé service role (filtres `deleted_at` à la main) : le petit mot n'est pas lisible
// avec la clé publique, et l'accès à une liste privée est vérifié avant (voir listPage.ts).

export function toListInfo(row: Tables<"lists">): ListInfo {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    ownerName: row.owner_name,
    description: row.description,
    ambiance: row.ambiance,
    currency: row.currency,
    isPrivate: row.is_private,
  };
}

/**
 * Accueil : toutes les listes avec leurs compteurs. Une liste privée n'y montre que son nom,
 * son prénom et son ambiance (ni petit mot, ni nombre d'articles, ni vignettes).
 */
export const getListSummaries = cache(async (): Promise<ListSummary[]> => {
  const { data, error } = await getServiceDb()
    .from("list_summaries")
    .select(
      "id, slug, title, owner_name, description, ambiance, currency, item_count, favorite_count, thumbs, content_updated_at, is_private",
    )
    .order("content_updated_at", { ascending: false });
  if (error) throw new Error(`Lecture des listes impossible : ${error.message}`);
  return (data ?? [])
    .filter((r) => r.id && r.slug && r.title)
    .map((r) => {
      const isPrivate = r.is_private ?? false;
      return {
        id: r.id!,
        slug: r.slug!,
        title: r.title!,
        ownerName: r.owner_name ?? "",
        description: isPrivate ? null : r.description,
        ambiance: r.ambiance ?? "feuillage",
        currency: r.currency ?? "EUR",
        isPrivate,
        itemCount: isPrivate ? 0 : (r.item_count ?? 0),
        favoriteCount: isPrivate ? 0 : (r.favorite_count ?? 0),
        thumbs: isPrivate ? [] : stringArray(r.thumbs),
        contentUpdatedAt: r.content_updated_at ?? new Date(0).toISOString(),
      };
    });
});

export type ListLookup =
  { kind: "found"; list: ListInfo } | { kind: "redirect"; slug: string } | { kind: "missing" };

/** Liste par slug, ou slug ancien à rediriger. Dédupliquée par requête (layout + page). */
export const getListBySlug = cache(async (slug: string): Promise<ListLookup> => {
  const db = getServiceDb();
  const { data, error } = await db
    .from("lists")
    .select("*")
    .eq("slug", slug)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw new Error(`Lecture de la liste impossible : ${error.message}`);
  if (data) return { kind: "found", list: toListInfo(data) };

  const { data: redirect } = await db
    .from("list_redirects")
    .select("list_id, lists!inner(slug, deleted_at)")
    .eq("old_slug", slug)
    .is("lists.deleted_at", null)
    .maybeSingle();
  const target = redirect?.lists?.slug;
  return target ? { kind: "redirect", slug: target } : { kind: "missing" };
});

/**
 * Catégories, tags et articles d'une liste. Liste privée : lecture par le serveur, à appeler
 * seulement après avoir vérifié l'accès (`loadListPage`, `canReadList`).
 */
export const getListContent = cache(async (listId: string, isPrivate: boolean): Promise<ListContent> => {
  const db = isPrivate ? getServiceDb() : getAnonDb();
  const loadedAt = Date.now();
  const [categories, tags, items] = await Promise.all([
    db.from("categories").select("id, ref, name, position").eq("list_id", listId).order("position"),
    db.from("tags").select("id, name, color, position").eq("list_id", listId).order("position"),
    db.from("items").select(ITEM_COLUMNS).eq("list_id", listId).is("deleted_at", null).order("position"),
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
