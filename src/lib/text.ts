/** Minuscules, sans accents ni espaces superflus : base des recherches insensibles aux accents. */
export function normalizeText(input: string): string {
  return input.normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase("fr-FR").replace(/\s+/g, " ").trim();
}

/** Slug d'URL : minuscules, sans accents, mots séparés par des tirets. */
export function slugify(input: string, maxLength = 80): string {
  return normalizeText(input)
    .replace(/&/g, " et ")
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, maxLength)
    .replace(/-+$/g, "");
}

const nf = new Intl.NumberFormat("fr-FR");

/** « 1 article », « 24 articles » (nombre au format français). */
export function plural(n: number, singular: string, pluralForm: string): string {
  return `${nf.format(n)} ${n === 1 || n === 0 ? singular : pluralForm}`;
}

export function formatNumber(n: number): string {
  return nf.format(n);
}
