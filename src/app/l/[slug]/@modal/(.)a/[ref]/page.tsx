import { ItemSheet } from "@/components/item/ItemSheet";
import { loadListPage } from "@/server/db/listPage";

/** Fiche ouverte depuis la liste : rendue par-dessus, la liste reste en place. */
export default async function ItemModal({ params }: PageProps<"/l/[slug]/a/[ref]">) {
  const { slug, ref } = await params;
  const { list, content } = await loadListPage(slug);
  if (!content.items.some((i) => i.ref === ref)) return null;
  return <ItemSheet list={list} content={content} itemRef={ref} mode="modal" />;
}
