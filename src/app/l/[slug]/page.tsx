import { ListView } from "@/components/list/ListView";
import { loadListPage } from "@/server/db/listPage";

export default async function ListPage({ params }: PageProps<"/l/[slug]">) {
  const { slug } = await params;
  const { list, content } = await loadListPage(slug);
  return <ListView list={list} content={content} />;
}
