import { ImportView } from "@/components/import/ImportView";
import { normalizeUrl } from "@/lib/normalizeUrl";
import { loadListPage } from "@/server/db/listPage";

export const maxDuration = 60;

/** Import d'un fichier Excel, CSV ou ODS : fichier, colonnes, vérification. */
export default async function ImportPage({ params }: PageProps<"/l/[slug]/edition/importer">) {
  const { slug } = await params;
  const { list, content } = await loadListPage(slug);
  const existingKeys = content.items
    .map((i) => (i.url ? normalizeUrl(i.url)?.urlKey : null))
    .filter((k): k is string => Boolean(k));
  return (
    <ImportView
      list={list}
      existingKeys={existingKeys}
      categories={content.categories.map((c) => c.name)}
      tags={content.tags.map((t) => t.name)}
    />
  );
}
