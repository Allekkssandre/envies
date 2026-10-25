import "server-only";
import { notFound } from "next/navigation";
import { getListBySlug, getListContent } from "./lists";

/** Liste + contenu pour une page sous /l/[slug] (le layout a déjà géré 404 et redirection). */
export async function loadListPage(slug: string) {
  const lookup = await getListBySlug(slug);
  if (lookup.kind !== "found") notFound();
  const content = await getListContent(lookup.list.id);
  return { list: lookup.list, content };
}
