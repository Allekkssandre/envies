import { normalizeText } from "@/lib/text";
import type { CategoryInfo, ItemInfo, ListContent, TagInfo } from "@/types/models";

export type SortOrder = "liste" | "recents" | "prix-asc" | "prix-desc";

/** Valeur de `?c=` pour « Non classé ». */
export const UNCATEGORIZED = "non-classe";

export type Filters = {
  /** `ref` de la catégorie, `UNCATEGORIZED`, ou null pour « Tout ». */
  category: string | null;
  /** Slugs des tags (logique OU). */
  tags: string[];
  favorites: boolean;
  order: SortOrder;
  query: string;
};

export const EMPTY_FILTERS: Filters = {
  category: null,
  tags: [],
  favorites: false,
  order: "liste",
  query: "",
};

const ORDERS: SortOrder[] = ["liste", "recents", "prix-asc", "prix-desc"];

export const ORDER_LABELS: Record<SortOrder, string> = {
  liste: "Ordre de la liste",
  recents: "Plus récents",
  "prix-asc": "Prix croissant",
  "prix-desc": "Prix décroissant",
};

export const ORDER_VALUES = ORDERS;

/** Lit l'état des filtres dans l'URL (`?c=…&t=…&fav=1&o=…&q=…`). */
export function parseFilters(params: URLSearchParams): Filters {
  const order = params.get("o");
  return {
    category: params.get("c") || null,
    tags: (params.get("t") ?? "").split(",").filter(Boolean),
    favorites: params.get("fav") === "1",
    order: ORDERS.includes(order as SortOrder) ? (order as SortOrder) : "liste",
    query: params.get("q") ?? "",
  };
}

/** Écrit les filtres en paramètres d'URL, sans les valeurs par défaut. */
export function serializeFilters(filters: Filters): URLSearchParams {
  const p = new URLSearchParams();
  if (filters.category) p.set("c", filters.category);
  if (filters.tags.length) p.set("t", filters.tags.join(","));
  if (filters.favorites) p.set("fav", "1");
  if (filters.order !== "liste") p.set("o", filters.order);
  if (filters.query.trim()) p.set("q", filters.query.trim());
  return p;
}

/** `?c=…` prêt à coller derrière un chemin, ou chaîne vide. */
export function filtersQueryString(filters: Filters): string {
  const s = serializeFilters(filters).toString();
  return s ? `?${s}` : "";
}

export function hasActiveFilters(f: Filters): boolean {
  return Boolean(f.category || f.tags.length || f.favorites || f.query.trim());
}

/** Comparaison binaire, comme la collation "C" des clés de position. */
function comparePosition(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function comparator(order: SortOrder): (a: ItemInfo, b: ItemInfo) => number {
  const byPosition = (a: ItemInfo, b: ItemInfo) => comparePosition(a.position, b.position);
  switch (order) {
    case "recents":
      return (a, b) => b.createdAt.localeCompare(a.createdAt) || byPosition(a, b);
    case "prix-asc":
    case "prix-desc": {
      const dir = order === "prix-asc" ? 1 : -1;
      return (a, b) => {
        if (a.priceCents == null && b.priceCents == null) return byPosition(a, b);
        if (a.priceCents == null) return 1; // sans prix à la fin
        if (b.priceCents == null) return -1;
        return (a.priceCents - b.priceCents) * dir || byPosition(a, b);
      };
    }
    default:
      return byPosition;
  }
}

function matchesQuery(item: ItemInfo, q: string): boolean {
  if (!q) return true;
  const hay = normalizeText([item.title, item.note, item.domain].filter(Boolean).join(" "));
  return q.split(" ").every((word) => hay.includes(word));
}

/**
 * Articles visibles avec ces filtres : catégorie ET (un des tags) ET coup de cœur ET recherche.
 * Triés selon l'ordre demandé.
 */
export function applyFilters(content: ListContent, filters: Filters): ItemInfo[] {
  const categoryId =
    filters.category && filters.category !== UNCATEGORIZED
      ? (content.categories.find((c) => c.ref === filters.category)?.id ?? "__inconnue__")
      : null;
  const tagIds = new Set(content.tags.filter((t) => filters.tags.includes(t.slug)).map((t) => t.id));
  const q = normalizeText(filters.query);

  return content.items
    .filter((item) => {
      if (filters.category === UNCATEGORIZED && item.categoryId !== null) return false;
      if (categoryId && item.categoryId !== categoryId) return false;
      if (tagIds.size && !item.tagIds.some((id) => tagIds.has(id))) return false;
      if (filters.favorites && !item.isFavorite) return false;
      return matchesQuery(item, q);
    })
    .sort(comparator(filters.order));
}

export type Section = {
  /** null = « Non classé ». */
  category: CategoryInfo | null;
  items: ItemInfo[];
};

export function sortCategories(categories: CategoryInfo[]): CategoryInfo[] {
  return [...categories].sort((a, b) => comparePosition(a.position, b.position));
}

/** Regroupe par catégorie, dans l'ordre des catégories ; « Non classé » en dernier, s'il n'est pas vide. */
export function groupIntoSections(items: ItemInfo[], categories: CategoryInfo[]): Section[] {
  const sections: Section[] = sortCategories(categories).map((category) => ({
    category,
    items: items.filter((i) => i.categoryId === category.id),
  }));
  const known = new Set(categories.map((c) => c.id));
  sections.push({ category: null, items: items.filter((i) => !i.categoryId || !known.has(i.categoryId)) });
  return sections.filter((s) => s.items.length > 0);
}

/** Ordre affiché, à plat (sert au précédent / suivant de la fiche). */
export function displayOrder(content: ListContent, filters: Filters): ItemInfo[] {
  return groupIntoSections(applyFilters(content, filters), content.categories).flatMap((s) => s.items);
}

/** Nombre d'articles par catégorie (clé null = « Non classé »). */
export function categoryCounts(items: ItemInfo[]): Map<string | null, number> {
  const counts = new Map<string | null, number>();
  for (const item of items) counts.set(item.categoryId, (counts.get(item.categoryId) ?? 0) + 1);
  return counts;
}

/** Premier tag de l'article, dans l'ordre des tags de la liste. */
export function firstTag(item: ItemInfo, tags: TagInfo[]): TagInfo | null {
  return tags.find((t) => item.tagIds.includes(t.id)) ?? null;
}

export type ListStats = { count: number; favorites: number; totalCents: number; approximate: boolean };

/** Chiffres du héros : le total additionne les prix dans la devise de la liste et ignore les autres. */
export function listStats(items: ItemInfo[], currency: string): ListStats {
  let totalCents = 0;
  let approximate = false;
  for (const item of items) {
    if (item.priceCents == null) approximate = true;
    else if ((item.currency ?? currency) === currency) totalCents += item.priceCents;
    else approximate = true;
  }
  return {
    count: items.length,
    favorites: items.filter((i) => i.isFavorite).length,
    totalCents,
    approximate,
  };
}
