import { ItemEditor } from "@/components/edit/ItemEditor";
import { loadListPage } from "@/server/db/listPage";

/** « Modifier l'article » ouvert depuis l'édition : par-dessus, l'édition reste en place. */
export default async function EditItemPanel({ params }: PageProps<"/l/[slug]/edition/a/[ref]">) {
  const { slug, ref } = await params;
  const { list, content } = await loadListPage(slug);
  const item = content.items.find((i) => i.ref === ref);
  if (!item) return null;
  return (
    <ItemEditor
      key={item.id}
      list={list}
      item={item}
      categories={content.categories}
      tags={content.tags}
      mode="modal"
    />
  );
}
