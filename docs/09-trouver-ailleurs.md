# 09 · Trouver ailleurs

Dans la fiche article, des liens de recherche vers d'autres boutiques, pour trouver moins cher, plus disponible, ou d'occasion. Ce sont de simples URL de recherche construites côté client. Rien n'est suivi, rien n'est rémunéré, aucune API appelée.

## Configuration

`src/config/search-sites.ts` :

```ts
export type SearchGroup = 'compare' | 'new' | 'secondhand';

export const SEARCH_GROUPS: { id: SearchGroup; label: string }[] = [
  { id: 'compare', label: 'Comparer' },
  { id: 'new', label: 'Neuf' },
  { id: 'secondhand', label: 'Seconde main' },
];

export const SEARCH_SITES: { id: string; label: string; shortLabel?: string; group: SearchGroup; url: (q: string) => string }[] = [
  { id: 'google-shopping', label: 'Google Shopping', shortLabel: 'Google', group: 'compare', url: q => `https://www.google.fr/search?tbm=shop&q=${q}` },
  { id: 'idealo',      label: 'idealo',      group: 'compare',    url: q => `https://www.idealo.fr/prechcat.html?q=${q}` },
  { id: 'ledenicheur', label: 'Ledenicheur', group: 'compare',    url: q => `https://ledenicheur.fr/search?search=${q}` },
  { id: 'amazon',      label: 'Amazon',      group: 'new',        url: q => `https://www.amazon.fr/s?k=${q}` },
  { id: 'fnac',        label: 'Fnac',        group: 'new',        url: q => `https://www.fnac.com/SearchResult/ResultList.aspx?Search=${q}` },
  { id: 'etsy',        label: 'Etsy',        group: 'new',        url: q => `https://www.etsy.com/fr/search?q=${q}` },
  { id: 'leboncoin',   label: 'leboncoin',   group: 'secondhand', url: q => `https://www.leboncoin.fr/recherche?text=${q}` },
  { id: 'vinted',      label: 'Vinted',      group: 'secondhand', url: q => `https://www.vinted.fr/catalog?search_text=${q}` },
  { id: 'ebay',        label: 'eBay',        group: 'secondhand', url: q => `https://www.ebay.fr/sch/i.html?_nkw=${q}` },
];
```

`q` est déjà encodé (`encodeURIComponent`, espaces en `+` pour la lisibilité). Vérifier chaque URL à la main au jalon 1 (les sites changent parfois leurs paramètres) et ajuster ici seulement.

## Mots de recherche

`buildSearchQuery(item)` :

1. Partir du nom de l'article. Sans nom : les mots du chemin de l'URL (`/listing/123/lampe-champignon-verre` → « lampe champignon verre »).
2. Retirer ce qui est entre parenthèses ou crochets, les références (suites de chiffres et lettres de 6 caractères et plus, ex. `B0C7XQ0000`), les mentions de taille (`taille M`, `taille 38`), les émojis, la ponctuation. Garder les quantités et contenances (`lot de 3`, `750 ml`), utiles à la recherche.
3. Retirer les mots vides en tête (`le`, `la`, `les`, `un`, `une`).
4. Garder 8 mots au plus, en minuscules.
5. Exemple : « Lampe champignon en verre soufflé » → `lampe champignon en verre soufflé`.

Le visiteur peut modifier les mots dans le champ ; les liens se mettent à jour en direct. Le bouton copier copie les mots. La valeur n'est pas enregistrée.

## Affichage

- Desktop : trois rangées (étiquette de groupe en capitales, puis liens soulignés avec ↗).
- Mobile : trois grilles de 3 tuiles de 52 px ; seconde main sur fond olive pâle.
- Liens : `target="_blank" rel="noopener noreferrer nofollow"`.
- Mention sous la liste (mobile et desktop) : « Ces liens ouvrent une simple recherche dans un nouvel onglet. Rien n'est suivi ni rémunéré. »
- Le site d'origine de l'article n'est pas retiré de la liste (on peut vouloir voir les autres annonces du même site).
