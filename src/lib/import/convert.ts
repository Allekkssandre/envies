// Conversion des lignes du fichier en articles (docs/08-import-export.md, « Conversion des valeurs »).

import { normalizeUrl } from "@/lib/normalizeUrl";
import { parsePrice } from "@/lib/parsePrice";
import { normalizeText } from "@/lib/text";
import { CURRENCY_HEADERS, isTruthy, normalizeHeader, type Target } from "./columns";

/** Article prêt à envoyer à `importItems` (déjà converti dans le navigateur). */
export type ImportRow = {
  title: string | null;
  url: string | null;
  priceCents: number | null;
  currency: string | null;
  category: string | null;
  tags: string[];
  isFavorite: boolean;
  note: string | null;
  imageUrl: string | null;
};

export type Conversion = {
  rows: ImportRow[];
  /** Lignes lues (hors ligne de titres). */
  total: number;
  duplicates: number;
  empty: number;
  /** Catégories qui n'existent pas encore, dans l'ordre d'apparition. */
  newCategories: string[];
  newTags: string[];
};

type Options = {
  headerRow: boolean;
  listCurrency: string;
  /** `url_key` des articles déjà dans la liste. */
  existingKeys: Set<string>;
  existingCategories: string[];
  existingTags: string[];
};

const clip = (s: string, max: number) => (s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s);

export function splitTags(value: string): string[] {
  const seen = new Set<string>();
  return value
    .split(/[,;/|]/)
    .map((t) => t.trim().replace(/\s+/g, " ").slice(0, 30))
    .filter((t) => {
      const k = normalizeText(t);
      if (!t || seen.has(k)) return false;
      seen.add(k);
      return true;
    });
}

function imageUrl(value: string): string | null {
  const v = value.trim();
  if (!/^https?:\/\//i.test(v)) return null;
  try {
    return new URL(v).toString();
  } catch {
    return null;
  }
}

/** Lignes du fichier → articles, avec doublons, lignes vides et nouvelles catégories comptés. */
export function convertRows(
  rows: string[][],
  links: (string | null)[][],
  targets: Target[],
  headers: string[],
  options: Options,
): Conversion {
  const body = options.headerRow ? rows.slice(1) : rows;
  const bodyLinks = options.headerRow ? links.slice(1) : links;
  const col = (t: Target) => targets.indexOf(t);
  const at = {
    title: col("title"),
    url: col("url"),
    price: col("price"),
    category: col("category"),
    tags: col("tags"),
    favorite: col("favorite"),
    note: col("note"),
    image: col("image"),
  };
  const currencyCol = options.headerRow
    ? headers.findIndex((h, i) => targets[i] === "skip" && CURRENCY_HEADERS.includes(normalizeHeader(h)))
    : -1;

  const seen = new Set(options.existingKeys);
  const knownCategories = new Set(options.existingCategories.map(normalizeText));
  const knownTags = new Set(options.existingTags.map(normalizeText));
  const newCategories: string[] = [];
  const newTags: string[] = [];
  const out: ImportRow[] = [];
  let duplicates = 0;
  let empty = 0;

  body.forEach((row, r) => {
    const cell = (i: number) => (i >= 0 ? (row[i] ?? "").trim() : "");
    const title = clip(cell(at.title).replace(/\s+/g, " "), 200);
    // Lien : colonne Lien, sinon le lien hypertexte de la cellule Nom.
    const rawUrl = cell(at.url) || (at.url < 0 && at.title >= 0 ? (bodyLinks[r]?.[at.title] ?? "") : "");
    const normalized = rawUrl ? normalizeUrl(rawUrl) : null;
    if (!title && !normalized) {
      empty++;
      return;
    }
    if (normalized) {
      if (seen.has(normalized.urlKey)) {
        duplicates++;
        return;
      }
      seen.add(normalized.urlKey);
    }
    const hint =
      currencyCol >= 0 && /^[A-Z]{3}$/i.test(cell(currencyCol))
        ? cell(currencyCol).toUpperCase()
        : options.listCurrency;
    const price = at.price >= 0 ? parsePrice(cell(at.price), hint) : null;
    const category = cell(at.category).replace(/\s+/g, " ").slice(0, 40) || null;
    if (category && !knownCategories.has(normalizeText(category))) {
      knownCategories.add(normalizeText(category));
      newCategories.push(category);
    }
    const tags = at.tags >= 0 ? splitTags(cell(at.tags)) : [];
    for (const t of tags) {
      if (!knownTags.has(normalizeText(t))) {
        knownTags.add(normalizeText(t));
        newTags.push(t);
      }
    }
    const note = cell(at.note);
    out.push({
      title: title || null,
      url: normalized?.url ?? null,
      priceCents: price?.cents ?? null,
      currency: price ? (price.currency ?? hint) : null,
      category,
      tags,
      isFavorite: at.favorite >= 0 && isTruthy(cell(at.favorite)),
      note: note ? clip(note, 500) : null,
      imageUrl: at.image >= 0 ? imageUrl(cell(at.image)) : null,
    });
  });

  return { rows: out, total: body.length, duplicates, empty, newCategories, newTags };
}
