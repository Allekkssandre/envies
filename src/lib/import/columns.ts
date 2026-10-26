// Correspondance des colonnes (docs/08-import-export.md) : d'après le titre, sinon d'après le contenu.

import { looksLikeUrl } from "@/lib/normalizeUrl";
import { parsePrice } from "@/lib/parsePrice";

export type Target = "title" | "url" | "price" | "category" | "tags" | "favorite" | "note" | "image" | "skip";

export const TARGETS: { value: Target; label: string }[] = [
  { value: "title", label: "Nom" },
  { value: "url", label: "Lien" },
  { value: "price", label: "Prix" },
  { value: "category", label: "Catégorie" },
  { value: "tags", label: "Tags" },
  { value: "favorite", label: "Coup de cœur" },
  { value: "note", label: "Note" },
  { value: "image", label: "Photo (lien d'image)" },
  { value: "skip", label: "Ne pas importer" },
];

/** Minuscules, sans accents ni ponctuation (les symboles ♥ ❤ € gardés). */
export function normalizeHeader(input: string): string {
  return input
    .replace(/œ/gi, "oe")
    .replace(/æ/gi, "ae")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9€♥❤ ]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const HEADERS: Record<Exclude<Target, "skip">, string[]> = {
  title: [
    "nom",
    "article",
    "produit",
    "objet",
    "titre",
    "intitule",
    "designation",
    "envie",
    "idee",
    "cadeau",
    "item",
    "name",
    "title",
    "product",
  ],
  url: ["lien", "url", "link", "site", "adresse", "page", "web", "href"],
  price: ["prix", "price", "montant", "cout", "tarif", "budget", "euros", "eur", "€"],
  category: ["categorie", "rayon", "rubrique", "type", "famille", "section", "category", "piece", "theme"],
  tags: ["tags", "tag", "etiquettes", "mots cles", "labels", "motscles"],
  favorite: ["coup de coeur", "favori", "fav", "top", "prefere", "coeur", "♥", "❤", "envie forte", "star"],
  note: [
    "note",
    "notes",
    "commentaire",
    "remarque",
    "detail",
    "precision",
    "comment",
    "info",
    "taille",
    "couleur",
  ],
  image: ["photo", "image", "img", "visuel", "picture"],
};
/** Titres à ne pas importer (« Ajouté le », « Devise » : colonnes de l'export). */
const SKIP = [
  "achete",
  "offert",
  "recu",
  "statut",
  "date",
  "id",
  "#",
  "ajoute le",
  "ajoute",
  "devise",
  "currency",
];
/** Colonne de devise : sert à lire le prix, n'est pas importée. */
export const CURRENCY_HEADERS = ["devise", "currency", "monnaie"];

function headerMatches(header: string, keyword: string): boolean {
  if (!header) return false;
  if (header === keyword) return true;
  if (keyword.length === 1) return header.includes(keyword);
  const words = header.split(" ");
  if (!keyword.includes(" ")) return words.includes(keyword);
  return ` ${header} `.includes(` ${keyword} `);
}

const FAVORITE_VALUES = new Set([
  "oui",
  "non",
  "x",
  "1",
  "0",
  "vrai",
  "faux",
  "✓",
  "✔",
  "o",
  "n",
  "yes",
  "no",
  "y",
  "true",
  "false",
  "♥",
  "❤",
  "*",
]);
const TRUTHY = new Set(["oui", "o", "yes", "y", "x", "1", "vrai", "true", "✓", "✔", "♥", "❤", "*"]);

/** « oui, x, 1, ✓ comptent comme oui ». */
export function isTruthy(value: string): boolean {
  return TRUTHY.has(value.trim().toLowerCase());
}

const looksLikeImage = (v: string) => /^https?:\/\/\S+\.(jpe?g|png|webp|gif|avif)(\?\S*)?$/i.test(v.trim());

/** Score de chaque cible d'après le contenu (20 premières valeurs non vides). */
function contentScores(values: string[]): Partial<Record<Target, number>> {
  const sample = values
    .map((v) => v.trim())
    .filter(Boolean)
    .slice(0, 20);
  if (!sample.length) return {};
  const share = (test: (v: string) => boolean) => sample.filter(test).length / sample.length;
  const scores: Partial<Record<Target, number>> = {};
  if (share(looksLikeImage) > 0.6) scores.image = 5;
  else if (share(looksLikeUrl) > 0.6) scores.url = 5;
  if (
    share((v) => parsePrice(v) !== null) > 0.6 &&
    share((v) => /[a-z]{3,}/i.test(v.replace(/eur|usd|chf/gi, ""))) < 0.2
  )
    scores.price = 4;
  if (sample.every((v) => FAVORITE_VALUES.has(v.toLowerCase()))) scores.favorite = 4;
  if (share((v) => v.includes(",")) > 0.3 && !scores.price) scores.tags = 2;
  const distinct = new Set(sample.map((v) => v.toLowerCase())).size;
  if (sample.length >= 3 && distinct <= Math.max(1, sample.length * 0.3) && !scores.favorite)
    scores.category = 2;
  return scores;
}

export type Guess = { targets: Target[]; guessed: boolean[] };

/**
 * Devine la cible de chaque colonne. Une cible ne va qu'à une colonne : en cas de conflit, la
 * colonne au meilleur score la garde, les autres passent à « Ne pas importer ».
 */
export function guessColumns(headers: string[], columns: string[][]): Guess {
  const n = headers.length;
  const candidates: { col: number; target: Target; score: number }[] = [];
  const skipped = new Set<number>();
  headers.forEach((raw, col) => {
    const h = normalizeHeader(raw);
    if (SKIP.some((k) => headerMatches(h, k)) || CURRENCY_HEADERS.some((k) => headerMatches(h, k))) {
      skipped.add(col);
      return;
    }
    for (const [target, keywords] of Object.entries(HEADERS) as [Target, string[]][]) {
      if (keywords.some((k) => headerMatches(h, k)))
        candidates.push({ col, target, score: 10 + (h === keywords[0] ? 1 : 0) });
    }
    for (const [target, score] of Object.entries(contentScores(columns[col] ?? [])) as [Target, number][]) {
      candidates.push({ col, target, score });
    }
  });

  const targets: Target[] = Array.from({ length: n }, () => "skip");
  const guessed: boolean[] = Array.from({ length: n }, () => false);
  const taken = new Set<Target>();
  for (const c of candidates.sort((a, b) => b.score - a.score || a.col - b.col)) {
    if (skipped.has(c.col) || taken.has(c.target) || guessed[c.col]) continue;
    targets[c.col] = c.target;
    guessed[c.col] = true;
    taken.add(c.target);
  }

  // Rien pour le nom : la colonne de texte la plus longue en moyenne.
  if (!taken.has("title")) {
    let best = -1;
    let bestLength = 0;
    targets.forEach((t, col) => {
      if (t !== "skip" || skipped.has(col)) return;
      const values = (columns[col] ?? []).filter(Boolean);
      const avg = values.reduce((s, v) => s + v.length, 0) / Math.max(1, values.length);
      if (avg > bestLength) {
        best = col;
        bestLength = avg;
      }
    });
    if (best >= 0) {
      targets[best] = "title";
      guessed[best] = true;
    }
  }
  return { targets, guessed };
}

/**
 * « La première ligne contient les titres » : aucune URL ni prix dans la première ligne,
 * et des valeurs toutes différentes.
 */
export function detectHeader(firstRow: string[]): boolean {
  const values = firstRow.map((v) => v.trim()).filter(Boolean);
  if (!values.length) return false;
  if (values.some((v) => looksLikeUrl(v) || parsePrice(v) !== null)) return false;
  return new Set(values.map((v) => v.toLowerCase())).size === values.length;
}

/** Choisir une cible déjà prise remet l'autre colonne sur « Ne pas importer ». */
export function assignTarget(guess: Guess, col: number, target: Target): Guess {
  const targets = [...guess.targets];
  const guessed = [...guess.guessed];
  if (target !== "skip") {
    targets.forEach((t, i) => {
      if (i !== col && t === target) {
        targets[i] = "skip";
        guessed[i] = false;
      }
    });
  }
  targets[col] = target;
  guessed[col] = false;
  return { targets, guessed };
}
