import { SettingsView } from "@/components/settings/SettingsView";
import { getServiceDb } from "@/server/db/client";
import { loadListPage } from "@/server/db/listPage";

/** Réglages de la liste (l'accès d'édition est vérifié par le layout). */
export default async function SettingsPage({ params }: PageProps<"/l/[slug]/edition/reglages">) {
  const { slug } = await params;
  const { list, content } = await loadListPage(slug);
  const { data: secret } = await getServiceDb()
    .from("list_secrets")
    .select("edit_key")
    .eq("list_id", list.id)
    .single();

  const categoryCounts: Record<string, number> = {};
  const tagCounts: Record<string, number> = {};
  let uncategorized = 0;
  for (const item of content.items) {
    if (item.categoryId) categoryCounts[item.categoryId] = (categoryCounts[item.categoryId] ?? 0) + 1;
    else uncategorized++;
    for (const t of item.tagIds) tagCounts[t] = (tagCounts[t] ?? 0) + 1;
  }

  return (
    <SettingsView
      list={list}
      categories={content.categories}
      tags={content.tags}
      categoryCounts={categoryCounts}
      tagCounts={tagCounts}
      uncategorized={uncategorized}
      itemCount={content.items.length}
      editKey={secret?.edit_key ?? ""}
    />
  );
}
