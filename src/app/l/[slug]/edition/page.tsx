import { EditPage } from "@/components/edit/EditPage";
import { loadListPage } from "@/server/db/listPage";

// Les actions d'ajout lancent la lecture des liens après la réponse (`after()`).
export const maxDuration = 60;

export default async function EditionPage({ params }: PageProps<"/l/[slug]/edition">) {
  const { slug } = await params;
  const { list, content } = await loadListPage(slug);
  return <EditPage list={list} content={content} />;
}
