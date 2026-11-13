// Nom de secours lu dans l'adresse d'un lien, quand la page ne se lit pas (boutique qui bloque
// les robots) ou pendant qu'elle se lit. Beaucoup de boutiques mettent le nom du produit dans
// l'adresse : « /a21102889/Big-Thief-Capacity-Vinyle », « /produits/lampe-champignon-123.html ».
// Pure, sans IA : on découpe l'adresse et on garde le morceau qui ressemble le plus à un nom.

/** Morceaux d'adresse qui ne sont jamais un nom de produit. */
const NOISE = new Set([
  "p",
  "dp",
  "gp",
  "product",
  "products",
  "produit",
  "produits",
  "item",
  "items",
  "listing",
  "ad",
  "ads",
  "annonce",
  "catalog",
  "catalogue",
  "shop",
  "boutique",
  "store",
  "fr",
  "en",
  "de",
  "es",
  "it",
  "fr-fr",
  "en-us",
  "en-gb",
  "fr-be",
  "fr-ch",
  "fr_fr",
  "www",
  "index",
  "html",
]);

const ID_ONLY = /^(?:[a-z]{0,3}\d[\d_-]*|[0-9a-f]{8}-[0-9a-f-]{20,}|[A-Z0-9]{10})$/i;

function decode(segment: string): string {
  try {
    return decodeURIComponent(segment.replace(/\+/g, " "));
  } catch {
    return segment;
  }
}

/** Mots d'un morceau d'adresse, sans extension, identifiants ni suffixes techniques. */
function wordsOf(segment: string): string[] {
  const clean = decode(segment)
    .replace(/\.(s?html?|php|aspx?|jsp)$/i, "")
    // Suffixes d'identifiant : « -88993658 », « -g-601101326811619 », « _p123 », « -R-p-301881 ».
    .replace(/[-_](?:[a-z]{1,2}[-_])?[a-z]?\d{4,}[a-z0-9]*$/i, "")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return clean.split(" ").filter((w) => w && !/^\d{5,}$/.test(w) && !/^[a-z]?\d{6,}$/i.test(w));
}

/** Un mot avec au moins deux lettres (pas un code ni une taille seule). */
const isWordy = (w: string) => /\p{L}.*\p{L}/u.test(w);

/**
 * Nom probable d'après l'adresse, ou `null` si rien ne ressemble à un nom (« /ad/123 »,
 * « /dp/B0DYFBHJ5H »). Deux mots au moins, 120 caractères au plus, première lettre en capitale.
 */
export function titleFromUrl(input: string): string | null {
  let url: URL;
  try {
    url = new URL(/^[a-z][a-z0-9+.-]*:/i.test(input.trim()) ? input.trim() : `https://${input.trim()}`);
  } catch {
    return null;
  }
  const segments = url.pathname.split("/").filter(Boolean);
  let best: string[] = [];
  for (const segment of segments) {
    const lower = decode(segment).toLowerCase();
    if (NOISE.has(lower) || ID_ONLY.test(segment)) continue;
    const words = wordsOf(segment);
    const wordy = words.filter(isWordy).length;
    if (wordy < 2) continue;
    // Le morceau le plus long gagne : c'est le nom du produit plutôt qu'une catégorie.
    if (words.join(" ").length > best.join(" ").length) best = words;
  }
  if (!best.length) return null;
  let title = best.join(" ");
  if (title.length > 120) title = title.slice(0, 120).replace(/\s+\S*$/, "");
  // Tout en minuscules : première lettre en capitale. Casse d'origine sinon (« Big Thief »).
  if (title === title.toLowerCase()) title = title.charAt(0).toUpperCase() + title.slice(1);
  return title;
}

/**
 * Lien glissé dans un texte (« Regarde ça : https://… », partage depuis une appli) :
 * le lien et le texte qui l'accompagne, nettoyé. `null` s'il n'y a pas de lien.
 */
export function splitLinkAndText(line: string): { url: string; text: string | null } | null {
  const match = /https?:\/\/[^\s<>"«»]+/i.exec(line);
  if (!match) return null;
  const url = match[0].replace(/[).,;:!?»]+$/, "");
  const text = (line.slice(0, match.index) + " " + line.slice(match.index + match[0].length))
    .replace(/\s+/g, " ")
    .replace(/^[\s\-–—:|·,"«»]+|[\s\-–—:|·,"«»]+$/g, "")
    .trim();
  return { url, text: text.length >= 3 ? text.slice(0, 200) : null };
}
