# 05 · Données (Supabase)

Schéma complet : `supabase/migrations/20261025154536_init.sql` (+ `…_fk_indexes.sql`) (testé sur Postgres 16 avec le seed, puis appliqué sur le projet Supabase `envies`, Postgres 17 : RLS vérifiée en rôle `anon`, conseiller de sécurité sans alerte hors des deux tables volontairement sans politique). Données de démo : `supabase/seed.sql`.

## Vue d'ensemble

```
lists 1─┬─1 list_secrets          (mot de passe haché, lien secret, version d'accès)
        ├─n list_redirects        (anciens slugs)
        ├─n categories            (ordre manuel)
        ├─n tags                  (couleur, ordre manuel)
        └─n items ─n─n tags       (via item_tags)
              └─0..1 category
rate_limits                       (compteurs de fréquence)
list_summaries (vue)              (accueil : compteurs, total, 3 vignettes)
Storage : bucket public item-images
```

## Tables

### `lists`

| Colonne | Type | Notes |
|---|---|---|
| `id` | uuid | |
| `slug` | text unique | `^[a-z0-9]+(-[a-z0-9]+)*$`, 80 max |
| `title` | text | 1–80 |
| `owner_name` | text | 1–40 (« Merin », « Jo & Sam ») |
| `description` | text | « petit mot », 500 max |
| `ambiance` | enum | `feuillage` · `ciel` · `ambre` |
| `currency` | char(3) | EUR par défaut |
| `search_key` | text | rempli par trigger : titre + prénom normalisés (recherche accueil, index trigramme) |
| `content_updated_at` | timestamptz | mis à jour par trigger à chaque changement d'article (tri « Récentes ») |
| `deleted_at` | timestamptz | suppression douce |

### `list_secrets` (jamais exposée au client)

| Colonne | Notes |
|---|---|
| `password_hash` | `scrypt$N$r$p$sel$hash` (base64url). N=16384, r=8, p=1, sel 16 octets, clé 32 octets. `crypto.scrypt` de Node, comparaison `timingSafeEqual`. |
| `edit_key` | `XXXX-XXXX-XXXX`, alphabet `23456789ABCDEFGHJKMNPQRSTUVWXYZ` (sans 0 O 1 I L). Stockée en clair pour pouvoir la réafficher dans les réglages (choix assumé : peu d'enjeu, table illisible côté client). Comparaison insensible à la casse et aux tirets. |
| `auth_version` | entier inclus dans le jeton d'édition. +1 quand on change le mot de passe ou qu'on régénère la clé : les autres appareils sont déconnectés. |

### `categories` / `tags`

- `name_key` = `normalize_key(name)` (trigger) → unicité insensible à la casse et aux accents par liste.
- `position` : clé `fractional-indexing` (texte, collation "C").
- `categories.ref` : identifiant court pour les URL de filtre (`?c=<ref>`) et les ancres.
- `tags.color` : enum de 8 couleurs (voir design system).

### `items`

| Colonne | Notes |
|---|---|
| `ref` | 10 caractères hexa, unique par liste, utilisé dans `/l/<slug>/a/<ref>` |
| `category_id` | null = « Non classé ». Garde-fou : doit appartenir à la même liste (trigger). |
| `title` | null tant que l'extraction n'a rien donné pour un lien seul. Contrainte : `title` ou `url` non null. |
| `url`, `url_key`, `domain` | `url_key` = URL normalisée (voir `07-extraction-liens.md`), unique par liste parmi les articles non supprimés. `domain` sans `www.`. |
| `description` | texte brut, 1000 max |
| `note` | note du propriétaire pour les visiteurs, 500 max |
| `price_cents`, `currency`, `price_source`, `price_checked_at` | `price_source` ∈ `page` · `manual` · `import` |
| `image_path` | préfixe Storage `items/<list_id>/<item_id>/<hash>`, fichiers `-480.webp` et `-1200.webp` |
| `image_width`, `image_height` | de la version 1200 (pour réserver la place) |
| `image_source_url`, `image_candidates` | image d'origine et jusqu'à 6 candidates trouvées sur la page |
| `is_favorite` | coup de cœur |
| `position` | ordre manuel global dans la liste (les sections filtrent par catégorie, l'ordre reste celui-ci) |
| `sorted_at` | null = « À trier » |
| `suggested_category_id` | catégorie proposée par l'extraction (fil d'Ariane) |
| `fetch_status`, `fetch_error`, `fetch_attempts`, `fetch_started_at`, `fetched_at` | état de l'extraction |
| `meta` | `{ siteName, brand, availability, breadcrumb: string[], lightBackground: boolean }` |
| `deleted_at` | suppression douce |

### `item_tags`

Clé primaire `(item_id, tag_id)`. Trigger : tag et article de la même liste.

### `rate_limits` + fonction `hit_rate_limit(bucket, max, fenêtre_s)`

Renvoie `true` si l'action est permise et compte l'essai. Exécutable seulement par `service_role`. Buckets utilisés : voir `06-api-et-securite.md`. Nettoyage : la tâche quotidienne supprime les lignes dont `reset_at` est passé.

### Vue `list_summaries`

Pour l'accueil : `item_count`, `favorite_count`, `total_cents` (dans la devise de la liste), `missing_prices`, `thumbs` (3 `image_path`, coups de cœur d'abord). `security_invoker` : la RLS des tables s'applique.

## Sécurité (RLS)

- RLS activée partout.
- Lecture publique (`anon`, `authenticated`) : listes, catégories, tags, articles, liens article–tag, redirections, **seulement pour les lignes non supprimées** d'une liste non supprimée.
- Aucune politique d'écriture et `revoke insert, update, delete` pour `anon`/`authenticated` : le navigateur ne peut rien écrire.
- `list_secrets`, `rate_limits` : RLS sans politique + `revoke select`. Lecture uniquement par le serveur (`service_role`, qui contourne la RLS).
- **Toute nouvelle table** (migrations suivantes) : `enable row level security`, une politique de lecture si elle doit être publique, et `revoke insert, update, delete, truncate … from anon, authenticated` (Supabase accorde ces droits par défaut aux nouvelles tables).

Le serveur utilise deux clients :

```ts
// src/server/db/client.ts
import 'server-only';
import { createClient } from '@supabase/supabase-js';
export const db = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false, autoRefreshToken: false },
});
// lecture publique côté serveur possible avec la même instance (filtrer deleted_at is null à la main),
// ou avec un client anon pour profiter de la RLS dans les pages visiteur.
```

```ts
// src/lib/supabase-browser.ts — temps réel uniquement
import { createClient } from '@supabase/supabase-js';
export const supabaseBrowser = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
```

Avec le client service role, **toujours** filtrer `deleted_at is null` dans les lectures visiteur (la RLS ne s'applique pas). Le plus simple : lire avec le client anon dans les composants serveur visiteur, et réserver le client service role aux actions et à l'édition.

## Stockage

- Bucket public `item-images` (créé par la migration). Taille max 5 Mo, types `image/webp`, `image/jpeg`, `image/png`.
- Chemins : `items/<list_id>/<item_id>/<hash8>-480.webp` et `-1200.webp`. Le hash change quand l'image change (pas de problème de cache, `Cache-Control: public, max-age=31536000, immutable`).
- URL publique : `${SUPABASE_URL}/storage/v1/object/public/item-images/<chemin>`. Construite côté client par une petite fonction `imageUrl(path, size)`.
- Écriture et suppression uniquement par le serveur.
- Quand l'image d'un article change ou que l'article est purgé : supprimer les anciens fichiers (`storage.from('item-images').remove([...])`). Ne jamais supprimer de lignes de `storage.objects` en SQL.

## Temps réel

- La table `items` est dans la publication `supabase_realtime`.
- En mode édition, le client s'abonne :

```ts
supabaseBrowser.channel(`items:${listId}`)
  .on('postgres_changes', { event: '*', schema: 'public', table: 'items', filter: `list_id=eq.${listId}` }, onChange)
  .subscribe();
```

- La RLS s'applique aux événements : un article supprimé (devenu invisible) n'envoie pas sa mise à jour. Ce n'est pas gênant : la suppression vient de ce même client (mise à jour optimiste). Pour simplifier, sur tout événement, recharger l'article concerné (ou faire `router.refresh()` avec un anti-rebond de 500 ms).
- Les pages visiteur ne s'abonnent pas (pas utile).

## Ordre manuel

- `fractional-indexing` : `generateKeyBetween(before, after)`. Ajouter en tête de la zone À trier : clé avant la première. Ajouter « ici » dans une catégorie : clé après le dernier article de cette catégorie.
- Déplacer une carte : nouvelle clé entre ses deux voisins **dans l'ordre global**, en prenant les voisins de la catégorie de destination.
- Ajout en lot (import, collage multiple) : `generateNKeysBetween(a, b, n)`.
- Si une clé dépasse 50 caractères (cas pathologique), renuméroter les positions de la liste dans une transaction (fonction serveur `rebalancePositions(listId)`).

## Suppression et purge

- Article : `deleted_at = now()`. « Annuler » remet `deleted_at = null` (si le lien a été réajouté entre-temps, l'index unique refuse : message « Un article avec ce lien existe déjà. »).
- Liste : `deleted_at = now()` sur la liste ; ses articles restent tels quels mais deviennent invisibles (RLS sur la liste). Le slug est libéré : à la suppression, renommer le slug en `<slug tronqué à 60>-supprimee-<6 caractères a-z0-9>` (le format doit rester valide pour la contrainte `check`), et supprimer ses `list_redirects`.
- Tâche quotidienne `GET /api/cron/daily` (Vercel Cron, protégée par `CRON_SECRET`) :
  1. articles `deleted_at < now() - 30 jours` → supprimer les fichiers Storage, puis les lignes ;
  2. listes `deleted_at < now() - 30 jours` → idem pour tous leurs articles, puis la liste (cascade) ;
  3. articles `pending` depuis plus de 10 minutes → `failed` avec `fetch_error = 'stale'` (ou relancer si `fetch_attempts < 3`) ;
  4. `rate_limits` expirés → supprimer.

## Requêtes types

```sql
-- Page liste (visiteur) : une requête par table, assemblage côté serveur
select * from lists where slug = $1 and deleted_at is null;
select * from categories where list_id = $1 order by position;
select * from tags where list_id = $1 order by position;
select * from items where list_id = $1 and deleted_at is null order by position;
select it.* from item_tags it join items i on i.id = it.item_id where i.list_id = $1 and i.deleted_at is null;
```

Avec supabase-js : `select('*, item_tags(tag_id)')` sur `items` évite la 5e requête.
