# 06 · API et sécurité

Enjeu de sécurité faible (listes de cadeaux publiques), mais on fait les choses proprement : pas d'écriture depuis le navigateur, secrets hachés ou illisibles, jeton signé, limites de fréquence, protection SSRF pour l'extraction.

## Accès en écriture : le jeton d'édition

### Format

Cookie `envies_edit_<listId>` (un par liste déverrouillée), `HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/`.

```
valeur = base64url(JSON {"l": listId, "v": authVersion, "e": expiresAtUnix}) + "." + base64url(HMAC-SHA256(payload, EDIT_TOKEN_SECRET))
```

- « Rester déverrouillé » coché : `e` = maintenant + 30 jours, `Max-Age` 30 jours.
- Décoché : `e` = maintenant + 12 h, cookie de session (sans `Max-Age`).
- Vérification (`requireEdit(listId)`) : signature (comparaison à temps constant), `e` non dépassé, `v === list_secrets.auth_version`. Sinon → erreur `EDIT_LOCKED`.
- Glissant : si le jeton expire dans moins de 7 jours et que la case était cochée, le renouveler à la prochaine action.

### Obtenir le jeton

| Action | Entrée | Effet |
|---|---|---|
| `createList` | titre, prénom, mot de passe, petit mot, ambiance, `website` (piège) | crée liste + secret, pose le cookie (30 jours), renvoie `{ slug, editKey }` |
| `unlockWithPassword` | `listId`, `password`, `remember` | limite `unlock:<listId>:<ipHash>` 10 / 15 min ; scrypt ; pose le cookie |
| `unlockWithKey` | `listId`, `key` | même limite ; compare la clé normalisée (majuscules, sans tirets) ; pose le cookie (30 jours) |
| `lockDevice` | `listId` | supprime le cookie |

`ipHash` = SHA-256(`x-forwarded-for` premier élément + `RATE_LIMIT_SALT`), 16 premiers caractères.

## Actions serveur (mutations)

Toutes dans `src/server/actions/`, avec `'use server'`. Schéma commun :

```ts
type Result<T> = { ok: true; data: T } | { ok: false; error: { code: ErrorCode; message: string; field?: string } };
type ErrorCode = 'VALIDATION' | 'EDIT_LOCKED' | 'RATE_LIMITED' | 'NOT_FOUND' | 'DUPLICATE' | 'CONFLICT' | 'INTERNAL';
```

Chaque action : 1) valide l'entrée avec zod ; 2) `await requireEdit(listId)` (sauf création et déverrouillage) ; 3) écrit avec le client service role ; 4) `revalidatePath('/l/' + slug)` et `revalidatePath('/')` si l'accueil change ; 5) renvoie un `Result`.

### Liste

| Action | Entrée | Notes |
|---|---|---|
| `updateList` | `listId`, `{ title?, ownerName?, description?, ambiance? }` | |
| `updateSlug` | `listId`, `slug` | slugifié, unique ; ajoute l'ancien dans `list_redirects` ; `DUPLICATE` si pris |
| `changePassword` | `listId`, `newPassword` (≥ 4) | `auth_version + 1`, nouveau cookie pour l'appareil courant |
| `regenerateEditKey` | `listId` | nouvelle clé, `auth_version + 1`, nouveau cookie ; renvoie la clé |
| `getEditKey` | `listId` | pour l'afficher dans les réglages |
| `deleteList` | `listId`, `confirmTitle` | `confirmTitle === title` exactement ; suppression douce ; supprime le cookie |

### Catégories et tags

| Action | Notes |
|---|---|
| `createCategory(listId, name, { after? })` | `DUPLICATE` si le nom existe (insensible casse/accents) → l'UI sélectionne l'existante |
| `renameCategory(categoryId, name)` | |
| `moveCategory(categoryId, beforeId?, afterId?)` | nouvelle clé de position |
| `deleteCategory(categoryId)` | les articles passent à `category_id = null` ; renvoie leurs ids pour « Annuler » (`restoreCategory` recrée la catégorie avec le même id et réaffecte les articles) |
| `createTag(listId, name, color?)` | couleur par défaut : première non utilisée |
| `updateTag(tagId, { name?, color? })` | |
| `moveTag`, `deleteTag` (+ `restoreTag`) | même principe |

### Articles

| Action | Entrée | Notes |
|---|---|---|
| `addItems` | `listId`, `lines: string[]` (1–50), `categoryId?` | chaque ligne : lien (détecté si `^https?://` ou ressemble à un domaine, ex. `etsy.com/…`) ou nom. Normalise l'URL, ignore les doublons (renvoyés à part), crée les articles en tête de « À trier » avec `fetch_status = 'pending'` pour les liens, puis lance l'extraction **après la réponse** (`after()` de `next/server`). Limite `add:<listId>` 300 / heure. Renvoie `{ created: Item[], duplicates: { line, itemRef }[] }`. |
| `addItemWithPhoto` | `listId`, `FormData` (fichier image ≤ 10 Mo, titre ?) | traite l'image (sharp), crée l'article sans lien |
| `updateItem` | `itemId`, patch `{ title?, priceCents?, currency?, url?, note?, categoryId?, isFavorite?, tagIds? }` | un champ saisi devient « manuel » (`price_source = 'manual'`) ; changer `url` → nouvelle extraction ; donner une catégorie → `sorted_at = now()` si null |
| `setItemImage` | `itemId`, `{ candidateUrl } \| FormData \| { remove: true }` | télécharge et traite la candidate, ou l'envoi, ou retire |
| `refetchItem` | `itemId` | relecture du lien (voir `07`) |
| `sortItem` | `itemId`, `{ categoryId, tagIds, isFavorite, title?, priceCents? }` | utilisée par le tri rapide ; met `sorted_at = now()` |
| `moveItem` | `itemId`, `{ categoryId, beforeId?, afterId? }` | glisser-déposer |
| `bulkUpdate` | `itemIds[]`, `{ categoryId? , addTagIds?, removeTagIds?, isFavorite? }` | sélection multiple ; donner une catégorie range les articles |
| `sortAllInbox` | `listId`, `categoryId` | « Tout ranger dans… » |
| `deleteItems` | `itemIds[]` | suppression douce ; renvoie les ids |
| `restoreItems` | `itemIds[]` | « Annuler » ; `CONFLICT` si un lien a été réajouté |
| `importItems` | `listId`, lignes déjà mappées (voir `08`) | par lots de 200 ; crée catégories et tags manquants |

## Routes HTTP (Route Handlers)

| Route | Méthode | Usage |
|---|---|---|
| `/api/lists/[id]/enrich` | POST | Relance l'extraction des articles `pending` depuis plus de 30 s (5 max par appel). Jeton d'édition requis. Limite 30 / min. Appelée par le client en mode édition (filet de sécurité). `maxDuration = 60`. |
| `/api/lists/[id]/export` | GET | Fichier .xlsx (voir `08`). Public (les données sont publiques). |
| `/api/cron/daily` | GET | Purge et nettoyage (voir `05`). En-tête `Authorization: Bearer ${CRON_SECRET}` exigé. |
| `/l/[slug]/opengraph-image` | GET | Image de partage générée (`next/og`), jalon 8. |

## Pages et données

- Pages visiteur (`/`, `/l/[slug]`, `/l/[slug]/a/[ref]`) : composants serveur, lecture avec le client anon (RLS). Rendu dynamique (pas d'ISR), c'est assez rapide pour ce volume. Les actions appellent `revalidatePath` pour invalider le cache du routeur.
- Pages d'édition : `requireEdit` au rendu ; sans jeton, rendre la page visiteur avec la modale de déverrouillage.
- `slug` inconnu : chercher dans `list_redirects` → `permanentRedirect('/l/' + nouveauSlug)` ; sinon `notFound()`.

## Validation (zod)

- Chaînes : `trim()`, longueurs de `01-produit.md`, refus des caractères de contrôle.
- URL : `http`/`https` seulement, 2048 caractères max, pas d'identifiants dans l'URL (`user:pass@`).
- Prix saisi : accepte `89`, `89,9`, `89.90`, `1 299,99`, `1299.99 €` → centimes ; refuse négatif et > 10 000 000.
- Fichiers : type MIME vérifié **et** signature (sharp lit l'image ; s'il échoue → `VALIDATION`).

## Limites de fréquence

| Bucket | Max | Fenêtre |
|---|---|---|
| `create:<ipHash>` | 10 | 1 h |
| `unlock:<listId>:<ipHash>` | 10 | 15 min |
| `add:<listId>` | 300 articles | 1 h |
| `enrich:<listId>` | 30 appels | 1 min |
| `upload:<listId>` | 60 | 1 h |

Dépassement → `RATE_LIMITED` avec un message de `12-textes.md`.

## Autres protections

- Les actions serveur Next vérifient l'origine (CSRF). Ne pas exposer d'autres routes d'écriture.
- En-têtes (dans `next.config` ou `middleware`) : `Content-Security-Policy` (images : `self`, `data:`, `blob:`, domaine Supabase ; connect : Supabase https + wss), `Referrer-Policy: strict-origin-when-cross-origin`, `X-Content-Type-Options: nosniff`, `Permissions-Policy: camera=(self), clipboard-read=(self)`.
- Le lien secret est dans le **fragment** (`#cle=`), jamais envoyé au serveur ni dans le `Referer`. Après usage, l'effacer de la barre d'adresse.
- Liens sortants : `target="_blank" rel="noopener noreferrer nofollow"`.
- Aucune donnée personnelle collectée en dehors de ce que les gens écrivent. Pas d'analytics tiers (Vercel Analytics possible, sans cookie).
- Journaux : ne jamais logger un mot de passe, une clé d'édition ou un cookie.
