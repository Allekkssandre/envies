import { SortView } from "@/components/sort/SortView";
import { sortCategories } from "@/lib/listFilters";
import { loadListPage } from "@/server/db/listPage";
import type { ItemInfo } from "@/types/models";

export const maxDuration = 60;

/**
 * Tri rapide : tous les articles à trier, du plus ancien au plus récent, ou la sélection
 * `?ids=ref1,ref2` (depuis la feuille « Ajouter »), dans cet ordre.
 */
export default async function SortPage({ params, searchParams }: PageProps<"/l/[slug]/edition/trier">) {
  const { slug } = await params;
  const { ids } = await searchParams;
  const { list, content } = await loadListPage(slug);

  let queue: ItemInfo[];
  if (typeof ids === "string" && ids.trim()) {
    const wanted = [
      ...new Set(
        ids
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      ),
    ];
    queue = wanted
      .map((key) => content.items.find((i) => i.ref === key || i.id === key))
      .filter((i): i is ItemInfo => Boolean(i));
  } else {
    queue = content.items.filter((i) => !i.sortedAt).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  return (
    <SortView list={list} items={queue} categories={sortCategories(content.categories)} tags={content.tags} />
  );
}
