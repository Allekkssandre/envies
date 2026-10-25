# 07 · Extraction depuis un lien (sans IA)

But : à partir d'un lien collé, remplir photo, nom, description, prix, devise, boutique, et proposer une catégorie. Uniquement en lisant ce que la page publie déjà : JSON-LD schema.org, OpenGraph, Twitter Cards, microdonnées, et quelques adaptateurs par site. Aucun modèle, aucune API d'IA, aucun service tiers payant.

Code : `src/server/enrich/` (`normalizeUrl.ts`, `safeFetch.ts`, `extract.ts`, `parsePrice.ts`, `adapters/*.ts`, `image.ts`, `suggestCategory.ts`, `run.ts`). Chaque fonction pure est testée avec Vitest sur des fixtures HTML (`src/server/enrich/__fixtures__/*.html`, à constituer avec de vraies pages enregistrées : Etsy, Fnac, Leboncoin, Vinted, Amazon, IKEA, Decathlon, La Redoute, une boutique Shopify, une boutique WooCommerce).

## 1. Déroulé

```
addItems ─► insert items (fetch_status = 'pending') ─► réponse au client
              │
              └─ after(() => runEnrichment(itemIds, { concurrency: 4 }))
                    pour chaque article :
                    1. normaliser l'URL (déjà fait à l'insertion)
                    2. safeFetch(url) → HTML (8 s, 3 Mo max)
                    3. extract(html, finalUrl) → { title, description, images[], price, currency, siteName, brand, availability, breadcrumb[], canonical }
                    4. adaptateur du domaine s'il existe (complète ou corrige)
                    5. choisir la meilleure image → télécharger → sharp → Storage
                    6. suggestCategory(breadcrumb, catégories de la liste)
                    7. update items (sans écraser les champs saisis à la main)
                    → Realtime notifie le client
```

- `fetch_started_at` est posé au début, `fetch_attempts + 1`.
- Une erreur sur un article n'arrête pas les autres.
- Durée max d'une fonction : `export const maxDuration = 60` sur les routes concernées. Si le lot est trop gros (import de 200 liens), traiter au plus 40 articles dans `after()`, le reste reste `pending` et sera relancé par le client (`POST /api/lists/[id]/enrich`, toutes les 30 s tant que la page d'édition est ouverte) et par la tâche quotidienne.

## 2. Normaliser l'URL

`normalizeUrl(input)` → `{ url, urlKey, domain }` :

1. Ajouter `https://` si absent (`etsy.com/listing/…`).
2. `new URL()` ; refuser autre chose que `http:`/`https:`.
3. Hôte en minuscules, retirer `www.` et `m.` pour `domain` et `urlKey` (garder l'URL d'origine pour la visite).
4. Retirer le fragment et les paramètres de suivi : `utm_*`, `gclid`, `fbclid`, `msclkid`, `mc_cid`, `mc_eid`, `igshid`, `ref`, `ref_`, `tag` (Amazon), `psc`, `pd_rd_*`, `pf_rd_*`, `_branch_match_id`, `srsltid`, `spm`, `scm`, `ga_*`.
5. Amazon : réduire à `/dp/<ASIN>` (motifs `/dp/`, `/gp/product/`, `/gp/aw/d/`).
6. Trier les paramètres restants, retirer la barre finale.
7. `urlKey` = `domain + pathname + search` normalisés, en minuscules.

## 3. Récupérer la page : `safeFetch`

- **SSRF** : résoudre le nom (`dns.lookup`, `all: true`) et refuser si une adresse est privée, de bouclage, lien-local, multicast ou réservée (127/8, 10/8, 172.16/12, 192.168/16, 169.254/16, 100.64/10, 0/8, ::1, fc00::/7, fe80::/10, ::ffff:mappées). Ports 80 et 443 seulement. Redirections suivies **à la main** (5 max), avec la même vérification à chaque saut.
- En-têtes : `User-Agent` de navigateur de bureau récent, `Accept: text/html,application/xhtml+xml`, `Accept-Language: fr-FR,fr;q=0.9,en;q=0.6`.
- Délai 8 s (AbortController), corps limité à 3 Mo (lecture en flux, arrêt au-delà), décodage selon `Content-Type` charset ou `<meta charset>`.
- Résultats : `{ ok: true, html, finalUrl }` ou `{ ok: false, error }` avec `error` ∈ `timeout`, `blocked` (403, 429, 503, page de captcha détectée : titre contenant « Robot Check », « captcha », « Access Denied »), `not_html`, `too_large`, `http_4xx`, `http_5xx`, `ssrf`, `dns`.

## 4. Extraire : `extract(html, baseUrl)`

Charger avec `cheerio`. Ordre de priorité par champ (premier non vide gagne) :

| Champ | Sources, dans l'ordre |
|---|---|
| title | JSON-LD Product `name` → `og:title` → `twitter:title` → `[itemprop=name]` → `<h1>` (si un seul) → `<title>` |
| description | JSON-LD `description` → `og:description` → `meta[name=description]` → `twitter:description` |
| images | JSON-LD `image` (chaîne, tableau, `ImageObject.url`/`contentUrl`) → `og:image:secure_url`, `og:image` (plusieurs possibles) → `twitter:image` → `link[rel=image_src]` → `[itemprop=image]` → `<img>` dont `width`/`height` déclarés ≥ 300 dans le contenu principal |
| price | JSON-LD `offers` (`Offer.price`, `AggregateOffer.lowPrice`, tableau → le plus bas en stock) → `product:price:amount` / `og:price:amount` → `[itemprop=price]` (`content` sinon texte) → adaptateur |
| currency | JSON-LD `priceCurrency` → `product:price:currency` / `og:price:currency` → `[itemprop=priceCurrency]` → symbole trouvé dans le texte du prix → devise de la liste |
| siteName | `og:site_name` → JSON-LD `Organization.name` → domaine |
| brand | JSON-LD `brand.name` ou `brand` |
| availability | JSON-LD `offers.availability` (`InStock`, `OutOfStock`…) |
| breadcrumb | JSON-LD `BreadcrumbList.itemListElement[].name` (trié par `position`) → `nav[aria-label*=readcrumb] a`, `.breadcrumb a`, `[itemtype*=BreadcrumbList] [itemprop=name]` |
| canonical | `link[rel=canonical]` |

JSON-LD : lire tous les `script[type="application/ld+json"]`, `JSON.parse` tolérant (retirer les commentaires et virgules finales, ignorer en cas d'échec), aplatir `@graph` et les tableaux, reconnaître `@type` égal ou contenant `Product`, `ProductGroup` (prendre la première variante `hasVariant` pour le prix), `Offer`, `BreadcrumbList`.

Nettoyage :
- `title` : décoder les entités, espaces normalisés, retirer les suffixes de site (` | Etsy`, ` - Amazon.fr`, ` – Fnac`, ` : Amazon.fr : Cuisine & Maison`, et tout suffixe égal à `siteName` après un séparateur `|`, `-`, `–`, `—`, `:`), 200 caractères max.
- `description` : texte brut, sans HTML, espaces normalisés, 1000 caractères max (l'affichage coupe à 4 lignes).
- `images` : URL absolues (`new URL(src, base)`), dédoublonnées, sans `data:`, sans SVG, 6 max.

## 5. Prix : `parsePrice(text | number, hintCurrency?)`

Renvoie `{ cents, currency } | null`. Cas à couvrir par les tests :

| Entrée | Résultat |
|---|---|
| `89` / `"89"` / `89.0` | 8900 |
| `"89,90 €"` / `"89,90 EUR"` / `"€89.90"` | 8990 EUR |
| `"1 299,99 €"` (espace fine insécable U+202F) / `"1 299,99"` (U+00A0) | 129999 |
| `"1.299,99"` | 129999 |
| `"1,299.99"` / `"$1,299.99"` | 129999 USD |
| `"199,-"` | 19900 |
| `"À partir de 24,90 €"` | 2490 |
| `"Gratuit"`, `""`, `"0"` | null (0 n'est pas un prix d'envie) |
| `"£45"` / `"45 CHF"` | GBP / CHF |

Règle séparateurs : le dernier `,` ou `.` suivi d'exactement 1 ou 2 chiffres en fin de nombre est décimal ; les autres sont des milliers.

## 6. Adaptateurs par site

Petits modules `adapters/<domaine>.ts` avec `match(domain)` et `extract($, url, base)` qui complètent le résultat générique. À écrire pour :

- **leboncoin.fr** : lire `script#__NEXT_DATA__` → `props.pageProps.ad` (`subject`, `body`, `price[0]`, `images.urls_large`, `category_name`).
- **amazon.fr** : souvent bloqué (captcha) → `failed: blocked` sans insister. Si la page passe : `#productTitle`, `#landingImage[data-old-hires]` ou `data-a-dynamic-image` (plus grande clé), `.a-price .a-offscreen`, fil `#wayfinding-breadcrumbs_feature_div a`.
- **vinted.fr** : JSON-LD Product en général ; sinon `script[data-js-react-on-rails-store]`.
- **ikea.com** : JSON-LD ; prix dans `.pip-temp-price__integral` + `__decimal` en secours.
- Shopify (détection : `window.Shopify` ou `cdn.shopify.com` dans la page) : appeler `<url>.js` (JSON produit public) si l'extraction générique n'a pas de prix.

Les adaptateurs ne font jamais plus d'une requête supplémentaire.

## 7. Image

1. Candidates dans l'ordre d'extraction. Ignorer les images < 200 px de côté une fois téléchargées, les logos (`logo` dans l'URL), les GIF animés.
2. Télécharger la première valide (`safeFetch` en mode binaire : 10 Mo max, `image/*` exigé, 8 s).
3. `sharp(buffer).rotate()` puis :
   - `-1200.webp` : `resize({ width: 1200, height: 1200, fit: 'inside', withoutEnlargement: true }).webp({ quality: 80 })`
   - `-480.webp` : même chose en 480, qualité 76.
4. **Fond clair** : lire la bordure (5 % sur chaque côté) de la version 480 ; si la luminance moyenne > 0,9 et l'écart-type faible (< 0,06) → `meta.lightBackground = true` (affichage `contain` + `multiply` sur le fond studio).
5. Envoyer dans Storage (`upsert: false`, `contentType: 'image/webp'`, `cacheControl: '31536000'`), enregistrer `image_path`, `image_width`, `image_height`, `image_source_url`, `image_candidates` (les URL d'origine, 6 max).
6. Échec de toutes les candidates → pas d'image, statut `partial` si on a au moins un titre.

## 8. Catégorie proposée : `suggestCategory(breadcrumb, categories)`

Sans IA : comparaison de mots.

1. Normaliser (minuscules, sans accents, sans ponctuation), découper en mots, retirer les mots vides (`de, des, du, la, le, les, et, en, pour, a, au, aux, the, and, for, accueil, home, tous, toutes, produits, categories, boutique, shop`) et le pluriel simple (`s`/`x` final).
2. Mots du fil d'Ariane (+ `meta.brand` exclu) contre mots de chaque catégorie de la liste. Score = nombre de mots communs ; bonus +1 si correspondance sur le dernier élément du fil (le plus précis).
3. Une petite table de synonymes statiques, éditable dans `suggestCategory.ts` : `{ deco: ['decoration', 'maison', 'luminaire', 'lampe', 'interieur'], livre: ['livres', 'lecture', 'bd', 'roman', 'librairie'], musique: ['vinyle', 'cd', 'audio', 'instrument'], sport: ['fitness', 'velo', 'running', 'randonnee', 'outdoor'], cuisine: ['ustensile', 'vaisselle', 'cuisson'], jardin: ['plante', 'exterieur'], mode: ['vetement', 'chaussure', 'sac', 'bijou'], enfant: ['jouet', 'bebe', 'jeu'] }`. Un mot du fil qui est synonyme d'un mot de catégorie compte pour 1.
4. Meilleur score ≥ 1 → `suggested_category_id`. Égalité → aucune proposition.
5. La proposition n'est **jamais** appliquée seule : elle est présélectionnée dans le tri rapide et affichée « proposée d'après la page : Maison › Luminaires ».

## 9. Écriture du résultat

- Ne remplir que les champs **vides** : `title`, `description`, `price_cents` (+ `currency`, `price_source = 'page'`, `price_checked_at`), image.
- Toujours mettre à jour : `domain`, `meta`, `image_candidates`, `suggested_category_id` (si l'article n'est pas encore rangé), `fetched_at`.
- `canonical` différent et sur le même domaine → mettre à jour `url_key` si cela ne crée pas de doublon.
- Statut : `ok` si titre **et** image ; `partial` si l'un des deux ; `failed` sinon (avec `fetch_error`).

## 10. Relecture (« Relire la page du lien »)

`refetchItem(itemId)` : même déroulé, mais **écrase le prix** (et `price_checked_at`) si un prix est trouvé, remplace `image_candidates`, recalcule la proposition de catégorie. Ne touche pas au titre, à la note, à la photo choisie, à la catégorie ni aux tags. Message : « Prix mis à jour : 79 € (avant 89 €) » ou « Rien de nouveau sur la page. ».

## 11. Ce que voit l'utilisateur

| Statut | Carte « À trier » | Fiche |
|---|---|---|
| `pending` | « Récupération… », reflet animé | nom = domaine |
| `ok` | photo, nom, prix | normal |
| `partial` | ce qui a été trouvé, « prix inconnu » si besoin | normal |
| `failed` | « Rien trouvé · compléter » | « Les infos n'ont pas pu être lues sur la page. Complétez à la main. » |
| `none` (sans lien) | initiale, « sans lien » | normal |
