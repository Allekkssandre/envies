import { ListView } from "@/components/list/ListView";
import { PrivateListView } from "@/components/list/PrivateListView";
import { hasEditAccess } from "@/server/auth/session";
import { getServiceDb } from "@/server/db/client";
import { loadListPage } from "@/server/db/listPage";

/** Liste privée ouverte par son auteur : « Partager » donne le lien de lecture. */
async function readSharePath(listId: string, slug: string): Promise<string | undefined> {
  if (!(await hasEditAccess(listId))) return undefined;
  const { data } = await getServiceDb()
    .from("list_secrets")
    .select("read_key")
    .eq("list_id", listId)
    .single();
  return data ? `/l/${slug}#acces=${data.read_key}` : undefined;
}

export default async function ListPage({ params }: PageProps<"/l/[slug]">) {
  const { slug } = await params;
  const { list, content, locked } = await loadListPage(slug);
  if (locked) return <PrivateListView list={list} />;
  const sharePath = list.isPrivate ? await readSharePath(list.id, list.slug) : undefined;
  return <ListView list={list} content={content} sharePath={sharePath} />;
}
