import "server-only";
import { notFound } from "next/navigation";
import { hasEditAccess, hasReadAccess } from "@/server/auth/session";
import type { ListContent, ListInfo } from "@/types/models";
import { getListBySlug, getListContent } from "./lists";

/**
 * Liste publique, ou liste privée ouverte sur cet appareil : accès en lecture (lien ou mot de
 * passe de lecture) ou accès d'édition (qui ouvre aussi la lecture).
 */
export async function canReadList(list: Pick<ListInfo, "id" | "isPrivate">): Promise<boolean> {
  if (!list.isPrivate) return true;
  const [read, edit] = await Promise.all([hasReadAccess(list.id), hasEditAccess(list.id)]);
  return read || edit;
}

const emptyContent = (): ListContent => ({ categories: [], tags: [], items: [], loadedAt: Date.now() });

/**
 * Liste + contenu pour une page sous /l/[slug] (le layout a déjà géré 404 et redirection).
 * Liste privée sans accès : `locked`, contenu vide et petit mot masqué.
 */
export async function loadListPage(
  slug: string,
): Promise<{ list: ListInfo; content: ListContent; locked: boolean }> {
  const lookup = await getListBySlug(slug);
  if (lookup.kind !== "found") notFound();
  const { list } = lookup;
  if (!(await canReadList(list))) {
    return { list: { ...list, description: null }, content: emptyContent(), locked: true };
  }
  const content = await getListContent(list.id, list.isPrivate);
  return { list, content, locked: false };
}
