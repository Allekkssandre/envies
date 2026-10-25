import "server-only";
import { cache } from "react";
import { slugify } from "@/lib/text";
import type { Json, Tables } from "@/types/database";
import type { ItemInfo, ListContent, ListInfo, ListSummary } from "@/types/models";
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

function lightBackground(meta: Json): boolean {
  return typeof meta === "object" && meta !== null && !Array.isArray(meta) && meta.lightBackground === true;
}

function stringArray(value: Json | null): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
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
  const [categories, tags, items] = await Promise.all([
    db.from("categories").select("id, ref, name, position").eq("list_id", listId).order("position"),
    db.from("tags").select("id, name, color, position").eq("list_id", listId).order("position"),
    db
      .from("items")
      .select(
        "id, ref, title, url, domain, description, note, price_cents, currency, price_source, price_checked_at, image_path, image_width, image_height, meta, is_favorite, position, created_at, category_id, fetch_status, item_tags(tag_id)",
      )
      .eq("list_id", listId)
      .order("position"),
  ]);
  const failed = categories.error ?? tags.error ?? items.error;
  if (failed) throw new Error(`Lecture du contenu impossible : ${failed.message}`);

  return {
    categories: categories.data ?? [],
    tags: (tags.data ?? []).map((t) => ({ ...t, slug: slugify(t.name) })),
    items: (items.data ?? []).map((r): ItemInfo => ({
      id: r.id,
      ref: r.ref,
      title: r.title,
      url: r.url,
      domain: r.domain,
      description: r.description,
      note: r.note,
      priceCents: r.price_cents,
      currency: r.currency,
      priceSource: r.price_source,
      priceCheckedAt: r.price_checked_at,
      imagePath: r.image_path,
      imageWidth: r.image_width,
      imageHeight: r.image_height,
      lightBackground: lightBackground(r.meta),
      isFavorite: r.is_favorite,
      position: r.position,
      createdAt: r.created_at,
      categoryId: r.category_id,
      tagIds: r.item_tags.map((t) => t.tag_id),
      fetchStatus: r.fetch_status,
    })),
  };
});
