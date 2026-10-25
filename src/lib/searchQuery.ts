const LEADING_STOP_WORDS = new Set(["le", "la", "les", "l", "un", "une", "des"]);
const MAX_WORDS = 8;

function wordsFromUrl(url: string): string {
  try {
    const { pathname } = new URL(url);
    const segments = decodeURIComponent(pathname)
      .split("/")
      .filter((s) => /[a-z]/i.test(s) && !/^(dp|gp|product|listing|ad|fr|p|item|a\d+)$/i.test(s));
    // Le segment le plus « bavard » (le plus de tirets) porte en général le nom.
    const best = segments.sort((a, b) => b.split(/[-_]/).length - a.split(/[-_]/).length)[0] ?? "";
    return best.replace(/\.[a-z0-9]+$/i, "").replace(/[-_+]+/g, " ");
  } catch {
    return "";
  }
}

/**
 * Mots de recherche pour « Trouver ailleurs » (docs/09-trouver-ailleurs.md).
 * « Lampe champignon en verre soufflé » → « lampe champignon en verre soufflé ».
 */
export function buildSearchQuery(item: { title?: string | null; url?: string | null }): string {
  let text = item.title?.trim() || (item.url ? wordsFromUrl(item.url) : "");
  text = text
    .replace(/\([^)]*\)|\[[^\]]*\]/g, " ") // parenthèses, crochets
    .replace(/\btaille\s+\S+/gi, " ") // mentions de taille
    .replace(/\p{Extended_Pictographic}/gu, " ") // émojis
    .replace(/[^\p{L}\p{N}\s]/gu, " "); // ponctuation

  const words = text
    .split(/\s+/)
    .filter(Boolean)
    // références : 6 caractères et plus mêlant chiffres et lettres, ou longues suites de chiffres
    .filter((w) => !(w.length >= 6 && /\d/.test(w) && (/\p{L}/u.test(w) || w.length >= 8)))
    .map((w) => w.toLocaleLowerCase("fr-FR"));

  while (words.length > 0 && LEADING_STOP_WORDS.has(words[0]!)) words.shift();
  return words.slice(0, MAX_WORDS).join(" ");
}
