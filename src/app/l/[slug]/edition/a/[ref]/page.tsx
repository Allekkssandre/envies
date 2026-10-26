import { notFound } from "next/navigation";
import { EditPage } from "@/components/edit/EditPage";
import { ItemEditor } from "@/components/edit/ItemEditor";
import { loadListPage } from "@/server/db/listPage";

/** Lien direct vers « Modifier l'article » : l'édition en fond, le panneau ouvert. */
export default async function EditItemPage({ params }: PageProps<"/l/[slug]/edition/a/[ref]">) {
  const { slug, ref } = await params;
  const { list, content } = await loadListPage(slug);
  const item = content.items.find((i) => i.ref === ref);
  if (!item) notFound();
  return (
    <>
      <EditPage list={list} content={content} />
      <ItemEditor
        key={item.id}
        list={list}
        item={item}
        categories={content.categories}
        tags={content.tags}
        mode="page"
      />
    </>
  );
}
