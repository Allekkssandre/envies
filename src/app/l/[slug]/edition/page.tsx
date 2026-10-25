import type { Metadata } from "next";
import { HashCleaner } from "@/components/access/EditControls";
import { UnlockGate } from "@/components/access/UnlockGate";
import { ListView } from "@/components/list/ListView";
import { hasEditAccess } from "@/server/auth/session";
import { loadListPage } from "@/server/db/listPage";

export async function generateMetadata({ params }: PageProps<"/l/[slug]/edition">): Promise<Metadata> {
  const { slug } = await params;
  const { list } = await loadListPage(slug);
  return { title: `Modifier ${list.title}`, robots: { index: false, follow: false } };
}

/**
 * Mode édition. Sans accès valide : la liste en fond et la demande de mot de passe
 * (ou la lecture du lien secret `#cle=…`, côté navigateur).
 */
export default async function EditionPage({ params }: PageProps<"/l/[slug]/edition">) {
  const { slug } = await params;
  const { list, content } = await loadListPage(slug);
  const unlocked = await hasEditAccess(list.id);

  if (!unlocked) {
    return (
      <>
        <ListView list={list} content={content} />
        <UnlockGate listId={list.id} slug={list.slug} title={list.title} />
      </>
    );
  }
  return (
    <>
      <HashCleaner />
      <ListView list={list} content={content} editing />
    </>
  );
}
