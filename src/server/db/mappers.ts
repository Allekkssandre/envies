import type { Json, Tables } from "@/types/database";
import type { ItemInfo } from "@/types/models";

/** Colonnes lues pour un article (visiteur et édition). */
export const ITEM_COLUMNS =
  "id, ref, title, url, domain, description, note, price_cents, currency, price_source, price_checked_at, image_path, image_width, image_height, image_candidates, meta, is_favorite, position, created_at, category_id, fetch_status, sorted_at, item_tags(tag_id)";

type ItemRow = Pick<
  Tables<"items">,
  | "id"
  | "ref"
  | "title"
  | "url"
  | "domain"
  | "description"
  | "note"
  | "price_cents"
  | "currency"
  | "price_source"
  | "price_checked_at"
  | "image_path"
  | "image_width"
  | "image_height"
  | "image_candidates"
  | "meta"
  | "is_favorite"
  | "position"
  | "created_at"
  | "category_id"
  | "fetch_status"
  | "sorted_at"
> & { item_tags: { tag_id: string }[] };

function lightBackground(meta: Json): boolean {
  return typeof meta === "object" && meta !== null && !Array.isArray(meta) && meta.lightBackground === true;
}

export function stringArray(value: Json | null): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
}

export function toItemInfo(r: ItemRow): ItemInfo {
  return {
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
    sortedAt: r.sorted_at,
    imageCandidates: stringArray(r.image_candidates).slice(0, 6),
  };
}
