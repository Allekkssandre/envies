# 04 · Design system

Maquette de référence : `docs/screens/FondationsV4.jpg` et `design/boards/FondationsV4.html`.

Direction : **chiné, organique, boisé, naturel, texturé.** La profondeur vient de la lumière et de la matière (flou de feuillage, ciel doré, ambre, verre dépoli, grain fin, halos), jamais d'aplats plats ni de texture papier. Les photos des articles sont le vrai contenu ; l'interface les met en scène.

## 1. Couleurs

À déclarer en variables CSS dans `src/app/globals.css`, puis exposer à Tailwind v4 avec `@theme`.

```css
@theme {
  /* base */
  --color-olive: #57612C;
  --color-olive-deep: #4A5226;
  --color-ochre: #A76A19;
  --color-ochre-deep: #7A4512;

  /* encres et fonds */
  --color-ink: #2B2416;        /* texte principal, boutons pleins */
  --color-ink-soft: #5E523A;   /* texte secondaire fort */
  --color-muted: #6B5A3E;      /* étiquettes, aides (5,6:1 sur crème) */
  --color-honey: #E3D7B8;      /* étiquettes sur fond sombre */
  --color-linen: #F3ECDD;      /* texte et boutons clairs sur image */
  --color-cream: #F3EDE2;      /* fond de page */
  --color-paper: #F6F1E8;      /* panneaux, feuilles, cartes papier */

  /* accents = couleurs de tags */
  --color-rust: #8E3B22;       /* coup de cœur, erreurs, suppression */
  --color-honey-deep: #C99536; /* « miel » */
  --color-plum: #6B3F4A;       /* « prune » */
  --color-slate: #4F5B5E;      /* « ardoise » */
  --color-sage: #7E8C5A;       /* « sauge » */
  --color-sand: #9A8A6A;       /* « sable » */

  /* lignes et champs */
  --color-line: rgb(43 36 22 / 0.12);
  --color-line-strong: rgb(43 36 22 / 0.18);
  --color-field: rgb(255 255 255 / 0.62);

  --font-serif: var(--font-fraunces), Georgia, serif;
  --font-sans: var(--font-instrument), "Helvetica Neue", system-ui, sans-serif;
}
```

Correspondance des couleurs de tag (enum `tag_color`) : `rouille` → rust, `ocre` → ochre, `miel` → honey-deep, `olive` → olive, `sauge` → sage, `ardoise` → slate, `prune` → plum, `sable` → sand.

Règles :
- Jamais de noir pur ni de blanc pur pour le texte ou les fonds (le blanc n'apparaît que dans les champs, à 62–75 %).
- Texte encre sur crème : 13:1. Sépia `muted` : 5,7:1, plancher pour tout texte courant. Rouille sur papier : 6,7:1.
- Ocre `#A76A19` sur crème : 3,8:1 → réservé aux titres de 24 px et plus (les italiques des titres), jamais pour du texte courant ni des liens. Sur ciel doré, utiliser `ochre-deep` (4,5:1). Lin sur feuillage : vérifier l'ombre portée (`text-shadow: 0 14px 50px rgb(10 12 4 / .45)`) sur les grands titres.
- Sur fond sombre : texte `linen`, étiquettes `honey`, italiques de titres en `honey`/`#E8BE78`. Sur fond clair : italiques de titres en `ochre` (ou `ochre-deep` sur ciel).

## 2. Typographie

Deux familles, chargées avec `next/font/google` :

```ts
import { Fraunces, Instrument_Sans } from 'next/font/google';
export const fraunces = Fraunces({
  subsets: ['latin'], style: ['normal', 'italic'], axes: ['SOFT', 'WONK', 'opsz'],
  variable: '--font-fraunces', display: 'swap',
});
export const instrument = Instrument_Sans({ subsets: ['latin'], variable: '--font-instrument', display: 'swap' });
```

| Rôle | Police | Réglages | Tailles (desktop / mobile) |
|---|---|---|---|
| Titre de liste | Fraunces 400 + italique 300 | `font-variation-settings: 'SOFT' 100, 'WONK' 1, 'opsz' 144` ; interligne 0,9 ; −0,03 em | 172 (liste) · 128 (édition, aperçu) · 220 (« Envies » accueil) / 84 · 58 · 112 |
| Titre de section | Fraunces 400 + italique 300 couleur | idem, −0,02 em | 72 / 42 |
| Titre de panneau | Fraunces 400 | `opsz` 72 | 36–56 / 28–40 |
| Nom d'article (fiche) | Fraunces 400 | `opsz` 72 | 36 / 28 |
| Prix | Fraunces 400 (fiche) / 500 (carte) | `font-variant-numeric: tabular-nums`, insécable | 44 · 21 / 34 · 18 |
| Note, petit mot | Fraunces italique 300 | `'SOFT' 100, 'opsz' 24–36` | 21–24 / 18–20 |
| Texte | Instrument Sans 400–600 | interligne 1,45–1,55 | 16 · 15 · 14 · 13 |
| Étiquette | Instrument Sans 600 | capitales, `letter-spacing: .18em` | 11–13 |

**Règle des titres** : premier mot en romain, le reste en italique (`<i>`), y compris pour les titres de section (« Maison *& déco* »). Composant `SplitTitle` : `const [first, ...rest] = title.split(' ')`. Un seul mot : romain partout sauf « *Envies* » (logo, toujours en italique).

## 3. Matières

Fichiers dans `public/textures/` (générés par `scripts/generate-textures.py`).

| Classe | Fichier(s) | Usage |
|---|---|---|
| `.tex-feuillage` | `bokeh-hero.jpg` (2400×1350), `bokeh-mobile.jpg` (900×1600) | Ambiance par défaut : héros, pied de page, fond du tri rapide, modales de création. |
| `.tex-ambre` | `ambre-hero.jpg`, `ambre-mobile.jpg` | Ambiance ambre : mêmes usages, texte lin. |
| `.tex-ciel` | `sky-golden.jpg` (2400×1100), `sky-golden-mobile.jpg` | Ambiance claire (texte encre), et « lumière » derrière une section sur deux. |
| `.tex-studio` | `photo-backdrop.jpg` | Fond des photos d'articles et des vignettes. |
| `.grain-fine` | `grain-fine.png` (tuile 200 px, alpha 20) | Superposé à toute la page, `position: fixed; inset: 0; pointer-events: none; z-index: 50`. |
| `.grain-overlay` | `grain.png` (tuile 256 px) | Sur les images d'ambiance, `mix-blend-mode: overlay; opacity: .55`. |

```css
.tex-feuillage { background: #2A3014 url(/textures/bokeh-hero.jpg) center / cover no-repeat; }
@media (max-width: 639px) { .tex-feuillage { background-image: url(/textures/bokeh-mobile.jpg); } }
.tex-ambre { background: #3A2414 url(/textures/ambre-hero.jpg) center / cover no-repeat; }
@media (max-width: 639px) { .tex-ambre { background-image: url(/textures/ambre-mobile.jpg); } }
.tex-ciel { background: #E2C08A url(/textures/sky-golden.jpg) center / cover no-repeat; }
@media (max-width: 639px) { .tex-ciel { background-image: url(/textures/sky-golden-mobile.jpg); } }
.tex-studio { background: #EEE6D6 url(/textures/photo-backdrop.jpg) center / cover; }
.section-light { /* une section sur deux */
  position: relative;
}
.section-light::before {
  content: ''; position: absolute; inset: 0; z-index: -1;
  background: #E2C08A url(/textures/sky-golden.jpg) center / cover no-repeat;
  mask-image: linear-gradient(to bottom, transparent 0, #000 160px, #000 calc(100% - 120px), transparent 100%);
}
```

Précharger la texture du héros de la page courante (`<link rel="preload" as="image">` avec `imagesrcset` desktop/mobile). Les textures sont servies avec `Cache-Control: public, max-age=31536000, immutable` (renommer avec un hash si on les régénère).

**Halos** : disques radiaux en fond de page, `radial-gradient(closest-side, rgb(214 160 70 / .22), transparent)` (ocre, 900 px, à droite) et `rgb(87 97 44 / .14–.16)` (olive, à gauche). 2 ou 3 par page, jamais au-dessus du texte.

**Dessin de feuillage** : une tige et 8 feuilles au trait (symbole SVG `leaf` des maquettes, trait lin 1,2 px, opacité .55) sur les héros sombres. À extraire de `design/boards/ListeV4.html` dans un composant `<Foliage />`.

### Ambiance d'une liste

`lists.ambiance` ∈ `feuillage | ciel | ambre`. Elle décide :
- la texture du héros (liste, édition, réglages, import) et de la couverture sur l'accueil ;
- la couleur du texte du héros (lin sur feuillage/ambre, encre sur ciel) ;
- le fond des modales (création, liste créée, tri rapide restent en feuillage quelle que soit l'ambiance ; à réévaluer, ce n'est pas bloquant).

## 4. Verre

```css
.glass-light {   /* barres qui chevauchent les héros, panneaux sur crème */
  background: rgb(243 236 221 / .8);
  border: 1px solid rgb(255 255 255 / .55);
  backdrop-filter: blur(22px) saturate(1.3);
  box-shadow: inset 0 1px 0 rgb(255 255 255 / .7), 0 2px 6px rgb(43 36 22 / .08), 0 30px 60px -24px rgb(43 36 22 / .45);
}
.glass-dark {    /* boutons et panneaux posés sur une image */
  background: rgb(243 236 221 / .14);
  border: 1px solid rgb(243 236 221 / .32);
  backdrop-filter: blur(20px) saturate(1.2);
  box-shadow: inset 0 1px 0 rgb(255 255 255 / .25), 0 30px 60px -30px rgb(0 0 0 / .6);
}
```

Prévoir un repli sans `backdrop-filter` (`@supports not (backdrop-filter: blur(1px))`) : opacité du fond à .95.

## 5. Ombres, rayons, espacements

- Rayons : 14 (petits boutons carrés, cases), 16 (champs, vignettes), 18 (cartes photo), 22–26 (grands panneaux, feuilles), 30–34 (panneaux latéraux, carte de tri), pilule 999.
- Ombre de photo : `inset 0 1px 0 rgb(255 255 255 / .7), 0 1px 2px rgb(43 36 22 / .12), 0 24px 44px -18px rgb(60 40 10 / .45)`.
- Ombre de bouton encre : `0 16px 30px -16px rgb(43 36 22 / .8)`.
- Ombre de panneau : `-40px 0 80px -30px rgb(10 8 2 / .7)` (panneau droit), `0 50px 100px -40px rgb(10 8 2 / .8)` (modale).
- Échelle d'espacement Tailwind par défaut (4 px). Écarts de grille d'articles : 48 × 32 (desktop), 22 × 14 (mobile).
- Cible tactile : 44 × 44 minimum, partout.

## 6. Composants

À créer dans `src/components/ui/` (nom → maquette de référence).

| Composant | Variantes / notes |
|---|---|
| `Button` | `ink` (plein encre), `linen` (plein lin sur image), `glass` (verre sombre), `outline` (blanc 45 % + filet), `ghost`, `rust` (danger), `rust-outline`. Hauteurs 40/44/46/52/56/58. Icône à gauche ou à droite. Toujours en pilule. |
| `IconButton` | Rond, 38–56 px, mêmes variantes, `aria-label` obligatoire. |
| `SplitTitle` | Règle du premier mot romain. Props : `as`, `size`, `restColor`. |
| `Caps` | Étiquette en capitales. |
| `Chip` | Puce de filtre : off, on (encre), on teintée (couleur du tag à 12–14 % + contour), avec coche, compteur, pastille. `aria-pressed`. |
| `KeyChip` | Puce de tri rapide avec touche (`<kbd>`). |
| `Kbd` | Touche clavier, variante claire et sombre. |
| `Field`, `TextArea` | Étiquette en capitales au-dessus, aide en dessous, erreur rouille avec icône. Focus : contour encre + halo `0 0 0 4px rgb(167 106 25 / .2)`. Grand champ (Fraunces 34) pour les titres. |
| `PasswordField` | Avec bouton œil, `autocomplete="current-password"` ou `"new-password"`. |
| `Toggle` | `role="switch"`, 50 × 30, couleur olive ou rouille. |
| `AmbiancePicker` | 3 vignettes radio avec coche. |
| `ItemCard` | Visiteur : photo + cœur + nom/prix + domaine/tag. Édition : cœur interactif, sélection, poignée, barre d'actions au survol. |
| `ItemPhoto` | Gère fond studio, `contain + multiply` pour fonds clairs, sinon `cover`, repli initiale, `srcset` 480/1200, `loading="lazy"`, dimensions fixées. |
| `InboxCard` | États `pending`, `ok`, `partial`, `failed`, `no-link`. |
| `AddBar` | Barre d'ajout desktop (collante) et mobile (bas d'écran). |
| `Sheet` | vaul, poignée, rayon 26. |
| `SidePanel` | Radix Dialog collé à droite, 640 px. |
| `FilterBar`, `FilterSheet` | Catégories, coups de cœur, tags, ordre, recherche. |
| `SearchElsewhere` | Champ de mots + groupes de liens (desktop : liens soulignés ; mobile : tuiles). |
| `LinkBox` | Lien à copier (public / secret). |
| `Toast` | sonner, thème encre, action « Annuler » en `#E8BE78`. |
| `Foliage` | Dessin SVG au trait. |
| `Grain` | Calque de grain fin global (dans le layout racine). |

## 7. Icônes

`lucide-react`, trait 1,6–1,8, tailles 14–24. Icônes utilisées : heart, share, pencil, search, chevron-down/left/right, arrow-left/right/up-right, x, plus, link, copy, image, camera, clipboard-paste, check, circle-check-big, circle-alert, loader-circle, lock, lock-open, key-round, eye, eye-off, settings, file-spreadsheet, folder, tag, trash-2, undo-2, grip-vertical, ellipsis, layers, keyboard, refresh-cw, info, clock. Le cœur des coups de cœur est rempli (`fill="currentColor"`) en rouille.

## 8. Mouvement

- Survols, focus, puces : 180 ms `ease-out`.
- Panneaux, feuilles, modales : 320 ms `cubic-bezier(.2, .8, .2, 1)`.
- Ajout d'une carte : apparition 220 ms (opacité + translation 8 px). Suppression : 180 ms (opacité + échelle .96).
- Reflet de chargement : 1,4 s en boucle.
- Tri rapide : sortie de carte 240 ms.
- `prefers-reduced-motion: reduce` → fondus seulement, pas de reflet, pas de déplacement.

## 9. Accessibilité

- Focus visible : `outline: 2px solid var(--color-ink); outline-offset: 3px` (lin sur fond sombre).
- Tous les boutons icônes ont un `aria-label`. Le cœur décoratif d'une carte visiteur a `role="img" aria-label="Coup de cœur"`.
- Dialogues : titre relié (`aria-labelledby`), focus initial sur le premier champ, `Échap` ferme.
- Les états de chargement d'un article sont annoncés (`aria-live="polite"` sur la zone À trier : « Lampe champignon trouvée »).
- Contenu des images d'ambiance : décoratif (`aria-hidden`). Photos d'articles : `alt` = nom de l'article.
- Langue `lang="fr"`. Formats de nombre et de date français.
