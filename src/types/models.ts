import type { Enums } from "./database";

export type Ambiance = Enums<"ambiance">;
export type TagColor = Enums<"tag_color">;

/** Liste telle qu'affichée (camelCase, sérialisable vers le client). */
export type ListInfo = {
  id: string;
  slug: string;
  title: string;
  ownerName: string;
  description: string | null;
  ambiance: Ambiance;
  currency: string;
};

export type ListSummary = ListInfo & {
  itemCount: number;
  favoriteCount: number;
  thumbs: string[];
  contentUpdatedAt: string;
};

export type CategoryInfo = { id: string; ref: string; name: string; position: string };

export type TagInfo = { id: string; name: string; color: TagColor; position: string; slug: string };

export type ItemInfo = {
  id: string;
  ref: string;
  title: string | null;
  url: string | null;
  domain: string | null;
  description: string | null;
  note: string | null;
  priceCents: number | null;
  currency: string | null;
  priceSource: Enums<"price_source"> | null;
  priceCheckedAt: string | null;
  imagePath: string | null;
  imageWidth: number | null;
  imageHeight: number | null;
  lightBackground: boolean;
  isFavorite: boolean;
  position: string;
  createdAt: string;
  categoryId: string | null;
  tagIds: string[];
  fetchStatus: Enums<"fetch_status">;
  /** null = « À trier ». */
  sortedAt: string | null;
  /** Photos trouvées sur la page (6 max), pour « Changer la photo ». */
  imageCandidates: string[];
  /** Image d'origine de la photo actuelle, quand elle vient de la page. */
  imageSourceUrl: string | null;
  /** Catégorie proposée d'après le fil d'Ariane de la page (jamais appliquée seule). */
  suggestedCategoryId: string | null;
  /** Fil d'Ariane lu sur la page. */
  breadcrumb: string[];
};

export type ListContent = {
  categories: CategoryInfo[];
  tags: TagInfo[];
  items: ItemInfo[];
  /** Heure du serveur (ms) juste avant la lecture : tout ce qui a été écrit avant est inclus. */
  loadedAt: number;
};

/** Nom affiché : le titre, sinon le domaine tant que l'extraction n'a rien donné. */
export function itemName(item: Pick<ItemInfo, "title" | "domain">): string {
  return item.title?.trim() || item.domain || "Sans nom";
}
