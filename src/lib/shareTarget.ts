import { looksLikeUrl } from "@/lib/normalizeUrl";

export type SharedData = { url?: string | null; text?: string | null; title?: string | null };

const URL_IN_TEXT = /https?:\/\/[^\s<>"«»]+/i;

/**
 * Ce qu'un partage Android ajoute : le lien s'il y en a un (souvent glissé dans `text`),
 * sinon le titre ou le texte comme nom. `null` s'il n'y a rien d'utilisable.
 */
export function sharedLine({ url, text, title }: SharedData): string | null {
  for (const value of [url, text, title]) {
    const match = value?.match(URL_IN_TEXT);
    if (match) return match[0].replace(/[).,;:!?»]+$/, "");
  }
  if (url && looksLikeUrl(url)) return url.trim();
  const name = (title?.trim() || text?.trim() || "").replace(/\s+/g, " ");
  return name ? name.slice(0, 200) : null;
}
