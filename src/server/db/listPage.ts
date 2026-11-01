import "server-only";
import { notFound } from "next/navigation";
import { hasEditAccess } from "@/server/auth/session";
import type { ListContent, ListInfo } from "@/types/models";
import { getListBySlug, getListContent } from "./lists";

/** Liste publique, ou liste privée déverrouillée sur cet appareil (même jeton que l'édition). */
export async function canReadList(list: Pick<ListInfo, "id" | "isPrivate">): Promise<boolean> {
  return !list.isPrivate || hasEditAccess(list.id);
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
