# CLAUDE.md — Envies

Envies est un petit site personnel de listes d'envies (wishlists) : celle de Merin et celles de quelques amis. Pas de compte, pas d'admin, pas d'IA. N'importe qui peut lire toutes les listes et en créer une. Chaque liste est protégée en écriture par un mot de passe simple et un lien secret.

Tu pars de ce dossier pour coder l'application de bout en bout. Le design est figé et validé. Les specs disent quoi faire. Si une spec et une maquette se contredisent, **la spec gagne**. Signale l'écart dans ta PR.

## À lire avant de coder, dans cet ordre

1. `docs/01-produit.md` : principes, périmètre, vocabulaire, règles métier.
2. `docs/02-parcours.md` : parcours visiteur et créateur, pas à pas.
3. `docs/03-ecrans.md` : chaque écran (route, contenu, états, desktop et mobile), avec renvoi vers les maquettes.
4. `docs/04-design-system.md` : tokens, typo, matières, composants, mouvement, accessibilité.
5. `docs/05-donnees.md` + `supabase/migrations/` : schéma, RLS, stockage, temps réel.
6. `docs/06-api-et-securite.md` : actions serveur, routes, jeton d'édition, limites.
7. `docs/07-extraction-liens.md` : remplissage automatique depuis un lien (sans IA).
8. `docs/08-import-export.md` : import Excel avec correspondance des colonnes, export.
9. `docs/09-trouver-ailleurs.md` : liens de recherche vers d'autres boutiques.
10. `docs/10-architecture-deploiement.md` : arborescence, dépendances, variables d'environnement, GitHub → Vercel + Supabase.
11. `docs/11-plan-de-livraison.md` : jalons et critères d'acceptation. **Suis cet ordre.**
12. `docs/12-textes.md` : tous les textes de l'interface. Ne réécris pas les textes, prends-les ici.

Maquettes :

- `docs/screens/*.jpg` : rendus de chaque écran, à la taille réelle (desktop 1440 px, mobile 390 px).
- `design/boards/*.html` : les mêmes maquettes en HTML statique, avec les styles exacts (couleurs, tailles, ombres, flous). Ouvre-les dans un navigateur ou lis le CSS inline pour retrouver une valeur. Ce n'est pas du code à copier tel quel : les maquettes utilisent des styles inline, l'app utilise les tokens et les composants de `docs/04-design-system.md`.
- `public/textures/` : textures finales (feuillage, ambre, ciel doré, grain, fond studio). `scripts/generate-textures.py` les régénère à l'identique.

## Pile technique (décidée)

- **Next.js** (App Router, dernière version stable ≥ 15), **React 19**, **TypeScript** strict.
- **Tailwind CSS v4** (config en CSS via `@theme`), tokens en variables CSS.
- **Supabase** : Postgres, Storage (images), Realtime. **Pas de Supabase Auth.**
- Hébergement **Vercel**, déployé depuis **GitHub** (preview par PR, production sur `main`).
- Paquets : `@supabase/supabase-js`, `zod`, `cheerio`, `sharp`, `fractional-indexing`, `xlsx` (SheetJS, depuis le CDN officiel), `lucide-react`, `@radix-ui/react-dialog`, `@radix-ui/react-popover`, `@radix-ui/react-dropdown-menu`, `vaul` (feuilles mobiles), `sonner` (messages éphémères), `@dnd-kit/core` + `@dnd-kit/sortable`, `nanoid`.
- Tests : **Vitest** (unitaires) et **Playwright** (bout en bout, viewports 1440 et 390).

## Règles non négociables

- **Aucune IA nulle part** : ni appel à un modèle, ni API d'IA, ni « suggestion intelligente ». L'extraction depuis un lien lit uniquement les métadonnées de la page (JSON-LD, OpenGraph, microdonnées). La catégorie proposée vient du fil d'Ariane de la page, comparé aux noms de catégories.
- **Textes sobres, en français.** Pas de phrase marketing, pas d'emoji, pas de point d'exclamation. Une phrase, une action. Les textes sont dans `docs/12-textes.md`.
- **Ajouter d'abord, ranger ensuite.** Ajouter un article ne demande qu'un lien ou un nom. Tout le reste (catégorie, tags, coup de cœur, note) est facultatif et se fait plus tard.
- **Mobile à égalité avec le desktop.** Chaque écran a sa version mobile dessinée. Cibles tactiles de 44 px minimum. Teste chaque jalon à 390 px et à 1440 px.
- **Pas de compte.** L'édition se déverrouille par mot de passe ou lien secret, puis un cookie signé garde l'accès 30 jours sur l'appareil.
- **Aucune écriture depuis le navigateur vers Supabase.** Le client n'a que la clé publique (lecture + temps réel). Toutes les écritures passent par des actions serveur qui vérifient le jeton d'édition, avec la clé service role côté serveur uniquement.
- **Suppression réversible** : tout article supprimé peut être restauré pendant 8 s (bouton « Annuler »). Suppression douce, purge après 30 jours. Seule la suppression d'une liste entière demande une confirmation (taper son nom).
- **Profondeur par la matière.** Fonds texturés (feuillage, ciel doré, ambre), verre dépoli, grain fin, halos de lumière. Jamais d'aplats plats de couleur vive, jamais de texture papier.
- **Accessibilité** : contraste ≥ 4,5:1 pour le texte, focus visible partout, dialogues accessibles (Radix), `prefers-reduced-motion` respecté, raccourcis clavier documentés et désactivés quand un champ a le focus.

## Conventions de code

- Code, identifiants, noms de tables et de colonnes en anglais. Textes d'interface et URL en français (`/nouvelle`, `/l/[slug]/edition`).
- Composants serveur par défaut. `"use client"` seulement quand il faut de l'état, des événements ou le temps réel.
- Mutations = actions serveur dans `src/server/actions/*`, validées avec zod, qui renvoient `{ ok: true, data } | { ok: false, error: { code, message } }`. Pas d'exception jusqu'au client.
- Accès aux données dans `src/server/db/*`. Le client service role est créé dans un module marqué `import 'server-only'`.
- Les montants sont des entiers en centimes (`price_cents`) + `currency` ISO 4217. Format d'affichage `Intl.NumberFormat('fr-FR')`, sans décimales quand le montant est rond (89 €, 199,90 €).
- Ordre manuel = clés `fractional-indexing` (colonne `position`, texte, collation "C").
- Pas de `any`. ESLint + Prettier. Commits courts en français ou en anglais, au choix, mais constants.

## Commandes attendues

```bash
pnpm dev            # serveur local
pnpm build && pnpm start
pnpm lint && pnpm typecheck
pnpm test           # vitest
pnpm test:e2e       # playwright (lance l'app sur une base Supabase locale ou de test)
supabase start      # base locale (Supabase CLI)
supabase db reset   # applique migrations + seed
```

## Définition de « fini » pour chaque jalon

- Les critères d'acceptation du jalon (`docs/11-plan-de-livraison.md`) passent, vérifiés à la main sur desktop et mobile.
- `pnpm lint`, `pnpm typecheck`, `pnpm test` passent. Les parcours e2e du jalon passent.
- L'écran ressemble à la maquette : mêmes textes, même hiérarchie, mêmes matières. Compare côte à côte avec `docs/screens/`.
- Déployé en preview Vercel sans erreur, et testé sur un vrai téléphone si possible.
