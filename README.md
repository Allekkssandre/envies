# Envies

Listes d'envies personnelles, à partager avec les proches. Sans compte.

- On ajoute vite : un lien ou un nom suffit. La photo, la description et le prix se remplissent tout seuls à partir de la page.
- On range plus tard : catégories, tags libres (priorité, avis, taille…), coups de cœur, notes.
- Les visiteurs voient tout, filtrent, et trouvent l'article ailleurs (comparateurs, neuf, seconde main).
- Import depuis Excel avec correspondance des colonnes. Export Excel.
- Chaque liste a un mot de passe simple pour la modifier, et un lien secret de modification.

## Ce dossier

```
CLAUDE.md                     consignes pour Claude Code (à lire en premier)
docs/                         specs produit, écrans, design system, données, API, plan de livraison
docs/screens/                 rendus des maquettes (desktop 1440 px, mobile 390 px)
design/boards/                maquettes en HTML statique (styles exacts)
public/textures/              textures finales à servir telles quelles
scripts/generate-textures.py  régénère les textures (numpy + pillow)
supabase/migrations/          schéma SQL initial
supabase/seed.sql             données de démonstration
.env.example                  variables d'environnement
```

## Démarrage

Prérequis : Node 22 LTS, pnpm, Supabase CLI, un compte Vercel et un dépôt GitHub.

```bash
# 1. Créer l'app (Claude Code le fait au jalon 0, voir docs/11-plan-de-livraison.md).
#    create-next-app refuse un dossier non vide : générer dans un dossier temporaire puis fusionner.
pnpm create next-app@latest /tmp/envies-app --ts --app --src-dir --tailwind --eslint --use-pnpm

# 2. Base locale
supabase init        # si besoin
supabase start
supabase db reset    # applique supabase/migrations + supabase/seed.sql

# 3. Variables
cp .env.example .env.local   # puis remplir avec les valeurs de `supabase status`

# 4. Lancer
pnpm dev
```

Mise en ligne : `docs/10-architecture-deploiement.md`. Le projet Supabase de production (`envies`, Paris) existe déjà, schéma appliqué. Reste à importer le dépôt dans Vercel et à renseigner les variables.
