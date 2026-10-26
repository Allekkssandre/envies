// Catégorie proposée d'après le fil d'Ariane de la page (docs/07-extraction-liens.md § 8).
// Sans IA : mots communs entre le fil et les noms de catégories, plus une petite table de synonymes.

const STOP_WORDS = new Set(
  "de des du la le les et en pour a au aux the and for accueil home tous toutes produits categories boutique shop"
    .split(" ")
    .map(stem),
);

/** Synonymes statiques, éditables ici. Un mot du fil synonyme d'un mot de catégorie compte pour 1. */
export const SYNONYMS: Record<string, string[]> = {
  deco: ["decoration", "maison", "luminaire", "lampe", "interieur"],
  livre: ["livres", "lecture", "bd", "roman", "librairie"],
  musique: ["vinyle", "cd", "audio", "instrument"],
  sport: ["fitness", "velo", "running", "randonnee", "outdoor"],
  cuisine: ["ustensile", "vaisselle", "cuisson"],
  jardin: ["plante", "exterieur"],
  mode: ["vetement", "chaussure", "sac", "bijou"],
  enfant: ["jouet", "bebe", "jeu"],
};

/** Pluriel simple retiré (`s` / `x` final). */
function stem(word: string): string {
  return word.length > 3 && /[sx]$/.test(word) ? word.slice(0, -1) : word;
}

/** Minuscules, sans accents ni ponctuation, mots vides et pluriels retirés. */
export function words(text: string): string[] {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .map(stem)
    .filter((w) => !STOP_WORDS.has(w));
}

const GROUPS: Set<string>[] = Object.entries(SYNONYMS).map(
  ([key, list]) => new Set([key, ...list].map(stem)),
);

function related(a: string, b: string): boolean {
  return a === b || GROUPS.some((g) => g.has(a) && g.has(b));
}

/**
 * Meilleur score ≥ 1 → id de la catégorie ; égalité ou aucun mot commun → null.
 * Score = mots de la catégorie retrouvés dans le fil ; +1 si l'un vient du dernier élément (le plus précis).
 */
export function suggestCategory(
  breadcrumb: string[],
  categories: { id: string; name: string }[],
  brand?: string | null,
): string | null {
  if (!breadcrumb.length || !categories.length) return null;
  const brandWords = new Set(brand ? words(brand) : []);
  const crumbs = breadcrumb.map((c) => words(c).filter((w) => !brandWords.has(w)));
  const all = crumbs.flat();
  const last = crumbs.at(-1) ?? [];

  let best: string | null = null;
  let bestScore = 0;
  let tie = false;
  for (const category of categories) {
    const cw = [...new Set(words(category.name))];
    let score = cw.filter((w) => all.some((x) => related(w, x))).length;
    if (score > 0 && cw.some((w) => last.some((x) => related(w, x)))) score += 1;
    if (score > bestScore) {
      best = category.id;
      bestScore = score;
      tie = false;
    } else if (score === bestScore && score > 0) {
      tie = true;
    }
  }
  return bestScore >= 1 && !tie ? best : null;
}
