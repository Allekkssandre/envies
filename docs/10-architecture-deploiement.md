# 10 · Architecture et déploiement

## Arborescence cible

```
envies/
├─ CLAUDE.md, README.md, docs/, design/          (ce dossier, conservé dans le dépôt)
├─ public/
│  ├─ textures/                                   (fournies)
│  ├─ icon.svg, apple-touch-icon.png, manifest.webmanifest
├─ scripts/generate-textures.py                   (fourni)
├─ supabase/
│  ├─ config.toml                                 (supabase init)
│  ├─ migrations/20261025154536_init.sql         (fourni, déjà appliqué)
│  ├─ migrations/20261025154627_fk_indexes.sql   (fourni, déjà appliqué)
│  └─ seed.sql                                    (fourni)
├─ src/
│  ├─ app/
│  │  ├─ layout.tsx                               polices, <Grain />, Toaster, lang="fr"
│  │  ├─ globals.css                              @theme, textures, verre
│  │  ├─ page.tsx                                 accueil
│  │  ├─ nouvelle/page.tsx                        création + « C'est prêt. »
│  │  ├─ l/[slug]/
│  │  │  ├─ layout.tsx                            charge la liste (ou redirection / 404)
│  │  │  ├─ page.tsx                              liste visiteur
│  │  │  ├─ a/[ref]/page.tsx                      fiche en page (lien direct)
│  │  │  ├─ @modal/(.)a/[ref]/page.tsx            fiche en panneau / feuille
│  │  │  ├─ @modal/default.tsx
│  │  │  ├─ opengraph-image.tsx                   (jalon 8)
│  │  │  └─ edition/
│  │  │     ├─ layout.tsx                         requireEdit → sinon modale de déverrouillage
│  │  │     ├─ page.tsx                           mode édition
│  │  │     ├─ a/[ref]/page.tsx + @modal/(.)a/[ref]/page.tsx   modifier un article
│  │  │     ├─ trier/page.tsx
│  │  │     ├─ importer/page.tsx
│  │  │     └─ reglages/page.tsx
│  │  ├─ api/
│  │  │  ├─ lists/[id]/enrich/route.ts
│  │  │  ├─ lists/[id]/export/route.ts
│  │  │  └─ cron/daily/route.ts
│  │  ├─ not-found.tsx
│  │  └─ partage/page.tsx                         (jalon 8, cible de partage PWA)
│  ├─ components/
│  │  ├─ ui/                                      Button, Chip, Field, Sheet, SidePanel…
│  │  ├─ list/                                    Hero, FilterBar, FilterSheet, Section, ItemCard…
│  │  ├─ item/                                    ItemSheet, SearchElsewhere, ItemEditForm…
│  │  ├─ edit/                                    AddBar, AddSheet, Inbox, SelectionBar, SortableGrid…
│  │  ├─ sort/                                    SortDeck, KeyChip…
│  │  └─ import/                                  Dropzone, MappingTable, ImportPreview…
│  ├─ config/search-sites.ts
│  ├─ lib/                                        format (prix, dates), slugify, splitTitle, imageUrl, supabase-browser, keyboard-layout
│  └─ server/
│     ├─ db/                                      client service role, client anon, requêtes
│     ├─ auth/                                    scrypt, editKey, token (HMAC), requireEdit, rateLimit
│     ├─ actions/                                 lists.ts, items.ts, categories.ts, tags.ts, import.ts
│     └─ enrich/                                  voir 07-extraction-liens.md
├─ tests/e2e/                                     Playwright
├─ .env.example
├─ vercel.json
└─ .github/ci.yml                                 (fourni, à déplacer dans .github/workflows/ au jalon 0)
```

## Dépendances

```bash
pnpm add @supabase/supabase-js zod cheerio sharp fractional-indexing nanoid lucide-react \
  @radix-ui/react-dialog @radix-ui/react-popover @radix-ui/react-dropdown-menu \
  vaul sonner @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities server-only \
  https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz
pnpm add -D vitest @vitest/coverage-v8 @playwright/test @types/node prettier prettier-plugin-tailwindcss
```

Les routes qui utilisent `sharp`, `dns` ou `crypto` tournent sur le runtime Node (`export const runtime = 'nodejs'`, valeur par défaut). Pas d'Edge pour elles.

Images : pas d'optimisation `next/image` pour les photos d'articles (elles sont déjà en WebP 480/1200). Utiliser `<img>` avec `srcSet`, ou `next/image` avec `unoptimized`. Les textures peuvent passer par `next/image` ou CSS.

## Variables d'environnement

`.env.example` (fourni) :

| Variable | Où | Rôle |
|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | client + serveur | URL publique (`https://envies-merin.vercel.app`), pour les liens copiés et OpenGraph |
| `NEXT_PUBLIC_SUPABASE_URL` | client | URL du projet Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | client | clé publique (lecture + temps réel). Sur les nouveaux projets Supabase : clé « publishable » `sb_publishable_…`, même usage |
| `SUPABASE_URL` | serveur | même URL |
| `SUPABASE_SERVICE_ROLE_KEY` | serveur | clé service role (ou clé « secret » `sb_secret_…`). **Jamais** préfixée `NEXT_PUBLIC_` |
| `EDIT_TOKEN_SECRET` | serveur | 32 octets aléatoires (base64), signe les cookies d'édition |
| `RATE_LIMIT_SALT` | serveur | sel du hachage des IP |
| `CRON_SECRET` | serveur | protège `/api/cron/daily` (Vercel l'envoie en `Authorization: Bearer`) |

Générer les secrets : `openssl rand -base64 32`.

## Mise en place

### 1. GitHub

1. Dépôt public `envies` contenant ce dossier. Au jalon 0, `create-next-app` refuse un dossier non vide : générer l'app dans un dossier temporaire et déplacer ses fichiers à la racine (sans écraser `README.md`, `public/textures`, `supabase/`, `.gitignore` : fusionner).
2. Branche `main` protégée : merge via PR, CI verte exigée.

### 2. Supabase (déjà fait)

Le projet existe et le schéma est appliqué :

| | |
|---|---|
| Projet | `envies`, organisation « Capture », offre gratuite |
| Référence | `nanhxhrbgftqhqivwfvt` |
| Région | `eu-west-3` (Paris), Postgres 17 |
| URL | `https://nanhxhrbgftqhqivwfvt.supabase.co` |
| Clé publique | `sb_publishable_DyPqV0_sM339aqwbYu25BQ_v8pyImgT` (publiable, lecture seule grâce à la RLS) |
| Migrations appliquées | `20261025154536_init`, `20261025154627_fk_indexes` |
| Données | aucune (le seed n'est **pas** appliqué en production) |

La clé secrète (service role ou `sb_secret_…`) n'est pas dans ce dépôt : la récupérer dans le tableau de bord Supabase (Project Settings → API Keys) et la mettre seulement dans les variables Vercel et dans `.env.local`.

L'offre gratuite limite l'organisation à 2 projets actifs, déjà atteints : **un seul projet** sert à la production et aux previews Vercel. Conséquences :

- Développement et tests e2e sur la base **locale** (`supabase start` + `supabase db reset`, qui applique migrations et seed).
- Les previews Vercel écrivent dans la base de production : créer les listes de test avec un titre qui commence par « Test » et les supprimer ensuite. Ne jamais lancer le seed sur ce projet.
- Si un second projet devient possible plus tard, le brancher sur l'environnement Preview de Vercel.

Lier le dépôt au projet pour les migrations suivantes :

```bash
supabase login
supabase link --project-ref nanhxhrbgftqhqivwfvt
supabase migration list     # doit montrer les 2 migrations, locales et distantes, alignées
supabase db push            # pour les migrations suivantes
supabase gen types typescript --project-id nanhxhrbgftqhqivwfvt > src/types/database.ts
```

Vérifié : bucket `item-images` public (5 Mo), table `items` dans la publication Realtime, RLS activée partout, aucun droit d'écriture pour `anon`, `list_secrets` et `rate_limits` illisibles.

### 3. Vercel

1. Importer le dépôt GitHub (framework Next.js détecté, gestionnaire pnpm).
2. Variables : les mêmes pour Production et Preview (un seul projet Supabase, voir plus haut). Development : base locale.
3. `vercel.json` (fourni) :

```json
{
  "crons": [{ "path": "/api/cron/daily", "schedule": "17 4 * * *" }]
}
```

Le plan Hobby n'autorise qu'une tâche planifiée par jour : c'est suffisant (purge, nettoyage). La relance des extractions en attente est faite par le client pendant l'édition.

4. Domaine : `envies-merin.vercel.app` par défaut, domaine personnalisé possible plus tard (mettre à jour `NEXT_PUBLIC_SITE_URL`).

### 4. CI (GitHub Actions)

`.github/ci.yml` (fourni hors de `workflows/` pour ne pas tourner avant que l'app existe ; le déplacer dans `.github/workflows/` au jalon 0) : sur chaque PR, `pnpm install --frozen-lockfile`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`. Les e2e Playwright tournent contre la preview Vercel (`deployment_status`) ou une Supabase locale (`supabase start` dans le job) : au choix, la seconde est plus fiable.

### 5. Migrations suivantes

Une migration = un fichier `supabase/migrations/<horodatage>_<nom>.sql` (`supabase migration new <nom>`). Appliquée sur dev à la PR, sur prod au merge (`supabase db push` à la main ou par un job GitHub avec `SUPABASE_ACCESS_TOKEN`). Ne jamais modifier une migration déjà appliquée en production.

## Sauvegardes

Le plan gratuit Supabase n'a pas de sauvegarde à la demande récupérable longtemps. Ajouter au jalon 8 un export hebdomadaire simple : la tâche quotidienne, le dimanche, écrit un JSON de toutes les listes (sans secrets) dans le bucket privé `backups` (à créer), en gardant les 8 derniers. Les images sont déjà dans Storage.

## Performance attendue

- Page liste (24 articles) : < 150 Ko de JS, LCP < 2,5 s en 4G (texture du héros préchargée, ~200 Ko en mobile).
- Photos d'articles chargées en différé, 480 px sur mobile et dans les grilles, 1200 px dans la fiche.
- Polices auto-hébergées par `next/font`, sous-ensemble latin.
