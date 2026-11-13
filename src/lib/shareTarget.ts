import { looksLikeUrl } from "@/lib/normalizeUrl";

export type SharedData = { url?: string | null; text?: string | null; title?: string | null };

const URL_IN_TEXT = /https?:\/\/[^\s<>"«»]+/i;

/** Nom partagé, sans le lien ni un préfixe de site (« Amazon.fr : … »). */
function cleanName(value: string | null | undefined): string {
  return (value ?? "")
    .replace(new RegExp(URL_IN_TEXT.source, "gi"), " ")
    .replace(/^\s*(?:[a-z0-9-]+\.)+[a-z]{2,}\s*[:|–—-]\s*/i, "")
    .replace(/\s+/g, " ")
    .replace(/^[\s\-–—:|·,"«»]+|[\s\-–—:|·,"«»]+$/g, "")
    .trim();
}

/**
 * Ce qu'un partage ajoute : le lien s'il y en a un (souvent glissé dans `text`), précédé du
 * nom partagé (titre, sinon le texte autour du lien) qui sert de nom provisoire. Sans lien,
 * le titre ou le texte comme nom. `null` s'il n'y a rien d'utilisable.
 */
export function sharedLine({ url, text, title }: SharedData): string | null {
  let link: string | null = null;
  for (const value of [url, text, title]) {
    const match = value?.match(URL_IN_TEXT);
    if (match) {
      link = match[0].replace(/[).,;:!?»]+$/, "");
      break;
    }
  }
  if (!link && url && looksLikeUrl(url)) link = url.trim();
  if (link) {
    const name = (cleanName(title) || cleanName(text)).slice(0, 200);
    return name.length >= 3 && !looksLikeUrl(name) ? `${name} ${link}` : link;
  }
  const name = (title?.trim() || text?.trim() || "").replace(/\s+/g, " ");
  return name ? name.slice(0, 200) : null;
}
