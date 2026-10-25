# 08 · Import et export Excel

Maquettes : `ImportV4.jpg`, `MImportV4.jpg`. Parcours : `02-parcours.md` § C8.

## Lecture du fichier (navigateur)

- Bibliothèque : SheetJS, installée depuis le CDN officiel (le paquet npm `xlsx` n'est plus mis à jour) :
  `pnpm add https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz`. Import dynamique (`await import('xlsx')`) pour ne pas alourdir les autres pages.
- Formats : `.xlsx`, `.xls`, `.csv` (séparateur `,` ou `;` détecté, UTF-8 ou Windows-1252), `.ods`. 5 Mo et 2 000 lignes max.
- Lecture : `XLSX.read(buffer, { type: 'array', cellDates: true })`, puis `sheet_to_json(ws, { header: 1, raw: false, defval: '' })` → tableau de lignes. Les valeurs de cellule sont lues en texte formaté (`raw: false`), le prix est reparsé par `parsePrice`.
- Liens hypertexte : si une cellule contient un lien (`cell.l.Target`) et que la colonne est « Nom », garder le texte comme nom **et** proposer le lien (colonne virtuelle « Lien de la cellule Nom »).
- Plusieurs feuilles : menu « Feuille « Liste » » ; par défaut la première non vide.
- Lignes entièrement vides ignorées. Colonnes entièrement vides ignorées.

## Correspondance des colonnes (deviner)

Pour chaque colonne : titre normalisé (minuscules, sans accents, sans ponctuation) comparé à ces listes ; sinon, analyse du contenu des 20 premières valeurs.

| Champ | Titres reconnus | Indice de contenu |
|---|---|---|
| Nom | nom, article, produit, objet, titre, intitule, designation, envie, idee, cadeau, item, name, title, product | texte le plus long en moyenne si rien d'autre |
| Lien | lien, url, link, site, adresse, page, web, href | > 60 % des valeurs ressemblent à une URL |
| Prix | prix, price, montant, cout, tarif, budget, euros, eur, € | > 60 % des valeurs passent `parsePrice` |
| Catégorie | categorie, rayon, rubrique, type, famille, section, category, piece, theme | peu de valeurs distinctes (≤ 30 % du nombre de lignes) |
| Tags | tags, tag, etiquettes, mots cles, labels, motscles | valeurs contenant des virgules |
| Coup de cœur | coup de coeur, favori, fav, top, prefere, coeur, ♥, ❤, envie forte, star | valeurs dans {oui, non, x, 1, 0, vrai, faux, ✓, ✔} |
| Note | note, notes, commentaire, remarque, detail, precision, comment, info, taille, couleur | texte libre |
| Photo (lien d'image) | photo, image, img, visuel, picture | URL finissant par .jpg/.jpeg/.png/.webp |
| Ne pas importer | acheté, achete, offert, recu, statut, date, id, # | par défaut si rien ne correspond |

- Une cible ne peut être affectée qu'à une colonne (sauf « Ne pas importer »). En cas de conflit lors de la devinette, garder la colonne avec le meilleur score.
- Badge « deviné » sur les correspondances trouvées automatiquement. Il disparaît si l'utilisateur change la valeur.
- « La première ligne contient les titres » : cochée si la première ligne n'a aucune URL ni prix et que ses valeurs sont toutes différentes. Décochée → colonnes nommées « Colonne A », « Colonne B »…

## Conversion des valeurs

| Champ | Règle |
|---|---|
| Nom | texte, `trim`, 200 max. Vide + lien présent → nom vide (l'extraction le remplira) |
| Lien | `normalizeUrl` ; invalide → ignoré (l'article garde son nom) |
| Prix | `parsePrice(valeur, devise de la liste)` ; illisible → vide |
| Catégorie | rapprochée des catégories existantes par `normalize_key` ; sinon créée (ordre d'apparition dans le fichier) |
| Tags | découpés sur `,` `;` `/` `|`, rapprochés ou créés (couleurs attribuées dans l'ordre de la palette) |
| Coup de cœur | vrai si `oui, o, yes, y, x, 1, vrai, true, ✓, ✔, ♥, ❤, *` (insensible à la casse) |
| Note | texte, 500 max (tronqué avec « … ») |
| Photo | URL d'image : téléchargée et traitée pendant l'extraction (priorité sur les images de la page) |

## Doublons et lignes ignorées

- Doublon = même `url_key` qu'un article existant de la liste, ou qu'une ligne précédente du fichier.
- Ligne ignorée = sans nom **et** sans lien valide.
- Le décompte est affiché avant l'import : « 45 lignes − 2 doublons » ; et dans l'étape 3.

## Options

- **Compléter depuis les liens** (cochée) : les articles avec lien sont créés `pending` et passent par l'extraction (photo, description, prix manquant). Ne remplace pas un prix venant du fichier.
- **Ranger directement** (décochée) : cochée, les articles qui ont une catégorie sont créés avec `sorted_at = now()` ; sinon tout arrive dans « À trier ».

## Envoi au serveur

- Le navigateur envoie les lignes **déjà converties** (JSON) à l'action `importItems`, par lots de 200, avec une barre de progression (« Import… 120 / 430 »).
- Côté serveur : revalidation zod de chaque ligne, création des catégories et tags manquants (dans une transaction ou une fonction RPC), insertion avec positions `generateNKeysBetween` en tête de liste, détection des doublons à nouveau (contrainte unique en dernier recours : `on conflict do nothing`).
- Puis extraction en arrière-plan comme pour `addItems` (40 par passage, le reste relancé par le client).

## Étape 3 · Vérifier

```
43 articles importés
2 doublons ignorés · 1 ligne vide ignorée
2 catégories créées : Jardin, Cuisine · 3 tags créés
Les photos et les prix arrivent depuis les liens, en arrière-plan.
[Voir les articles à trier]  [Trier maintenant]
```

## Export

`GET /api/lists/[id]/export` → `envies-<slug>-<AAAA-MM-JJ>.xlsx`, une feuille « Liste » :

| Nom | Lien | Prix | Devise | Catégorie | Tags | Coup de cœur | Note | Photo | Ajouté le |
|---|---|---|---|---|---|---|---|---|---|
| texte | URL | nombre (format `# ##0,00`) | EUR | texte | séparés par `, ` | oui / vide | texte | URL publique 1200 | date |

- Ordre : catégories dans l'ordre, puis « Non classé », articles par position.
- Les titres de colonnes sont reconnus par l'import : un export modifié puis réimporté dans une autre liste recrée tout (sauf doublons).
- Génération côté serveur avec SheetJS (`XLSX.utils.aoa_to_sheet`, largeurs de colonnes réglées, première ligne en gras et figée).
