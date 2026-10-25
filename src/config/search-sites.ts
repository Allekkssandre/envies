export type SearchGroup = "compare" | "new" | "secondhand";

export const SEARCH_GROUPS: { id: SearchGroup; label: string; mobileLabel: string }[] = [
  { id: "compare", label: "Comparer", mobileLabel: "Comparer les prix" },
  { id: "new", label: "Neuf", mobileLabel: "Neuf" },
  { id: "secondhand", label: "Seconde main", mobileLabel: "Seconde main" },
];

export type SearchSite = {
  id: string;
  label: string;
  shortLabel?: string;
  group: SearchGroup;
  /** `q` est déjà encodé (espaces en `+`). */
  url: (q: string) => string;
};

/**
 * URL vérifiées au jalon 1 (octobre 2026). Google, Amazon et Vinted répondent ; Ledenicheur
 * attend `q` (et non `search` : page 404). Les autres sites bloquent les navigateurs
 * automatisés : à contrôler dans un vrai navigateur. Ajuster ici seulement.
 */
export const SEARCH_SITES: SearchSite[] = [
  {
    id: "google-shopping",
    label: "Google Shopping",
    shortLabel: "Google",
    group: "compare",
    url: (q) => `https://www.google.fr/search?tbm=shop&q=${q}`,
  },
  {
    id: "idealo",
    label: "idealo",
    group: "compare",
    url: (q) => `https://www.idealo.fr/prechcat.html?q=${q}`,
  },
  {
    id: "ledenicheur",
    label: "Ledenicheur",
    group: "compare",
    url: (q) => `https://ledenicheur.fr/search?q=${q}`,
  },
  { id: "amazon", label: "Amazon", group: "new", url: (q) => `https://www.amazon.fr/s?k=${q}` },
  {
    id: "fnac",
    label: "Fnac",
    group: "new",
    url: (q) => `https://www.fnac.com/SearchResult/ResultList.aspx?Search=${q}`,
  },
  { id: "etsy", label: "Etsy", group: "new", url: (q) => `https://www.etsy.com/fr/search?q=${q}` },
  {
    id: "leboncoin",
    label: "leboncoin",
    group: "secondhand",
    url: (q) => `https://www.leboncoin.fr/recherche?text=${q}`,
  },
  {
    id: "vinted",
    label: "Vinted",
    group: "secondhand",
    url: (q) => `https://www.vinted.fr/catalog?search_text=${q}`,
  },
  { id: "ebay", label: "eBay", group: "secondhand", url: (q) => `https://www.ebay.fr/sch/i.html?_nkw=${q}` },
];

/** Encode les mots pour une URL de recherche : espaces en `+`, le reste en `%XX`. */
export function encodeQuery(words: string): string {
  return words.trim().split(/\s+/).filter(Boolean).map(encodeURIComponent).join("+");
}
