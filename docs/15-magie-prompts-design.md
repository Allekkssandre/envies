# 15. La Magie de Noël : prompts pour Claude Design

Quatre demandes, à coller une par une. Chacune précise le format de retour, pour que le résultat se branche sans retouche. Les textes des cartes sont ceux de `src/lib/magic/texts.ts` : ne pas les réécrire.

## Contexte à coller en tête de chaque prompt

```
Site « Envies » : listes d'envies et Secret Santa entre proches. Ton sobre, chaleureux, jamais criard.
Matières : fonds texturés (feuillage sombre, ambre, ciel doré), papier crème, verre dépoli, grain fin, halos de lumière.
Pas d'aplat de couleur vive, pas de texture papier froissé, pas de style cartoon, pas d'emoji.
Couleurs : encre #2B2416, lin #F7F1E6, papier #F3EBDD, ocre #A76A19, miel #D9A441, rouille #8E3B22, olive #5E6B2E.
Typographie : Fraunces (titres, italique léger pour l'accent), Instrument Sans (texte).
Jeu « La Magie de Noël » : deux camps, les Pères Noël (défendent la Magie) et les Grinchs (veulent la faire tomber à 0), plus un infiltré dans chaque camp. Chaque joueur a une carte de pouvoir secrète.
Textes en français, courts, sans tiret long ni point d'exclamation.
```

## Prompt 1 : les cartes de pouvoir

```
Dessine un jeu de 12 cartes à jouer verticales (ratio 5:7), plus un dos commun.
Chaque carte : une illustration centrale, le nom du pouvoir en Fraunces, un bandeau de camp, une zone de texte vide en bas (le texte sera posé par le site).
Deux familles reconnaissables au premier regard, sans se fier à la seule couleur :
- Pères Noël (ambre, miel, lumière chaude) : Facteur (une sacoche de lettres), Lanterne, Pare-feu (un âtre protégé par un écran), Bouclier (une étoile en bouclier), Fée du sapin.
- Grinchs (vert sombre, givre, ombre) : CyberGrinch (un écran fissuré), Brouilleur (des ondes brouillées), Siphon (une fiole qui aspire la lumière), Corrupteur (une pièce noircie), Givré (un flocon acéré).
- Deux cartes « Espion » : une version Père Noël infiltré, une version Grinch infiltré. Même composition (un masque), teintes de l'autre camp.
Le dos : motif discret de feuillage et d'étoiles, identique pour toutes.
Style : gravure douce, grain fin, lumière en halo. Lisible à 160 px de large sur mobile.
Rends : une page de planche avec les 13 visuels, puis chaque carte en SVG ou en image 750 x 1050 px, fond compris, sans texte de description.
Noms de fichiers : facteur, lanterne, parefeu, bouclier, fee, cyber, brouilleur, siphon, corrupteur, givre, espion-pn, espion-gr, dos.
```

Branchement : images dans `public/magie/cartes/<nom>.webp`, affichées dans la carte « Mon rôle » et dans le tableau de révélation.

## Prompt 2 : la gazette

```
Dessine le gabarit de « La Gazette du Pôle Nord », le bilan d'une manche, en HTML et CSS autonomes (pas de script, pas d'image externe).
Il s'affiche dans un tchat, largeur 320 à 640 px. Il doit se lire en cinq secondes.
Contenu, dans cet ordre, avec ces emplacements nommés :
{{manche}} (« Manche 3 »), {{pouvoir}} (« Pouvoir joué : celui de Flocon. »), {{attaque}} (« Attaque magique : −2. »),
{{defense}} (« Défense : +1. »), {{jauge_avant}} et {{jauge_apres}} (deux nombres, avec une jauge dessinée en segments),
{{indice}} (facultatif, « Indice : le prénom d'un Grinch compte 6 lettres. »), {{fin}} (facultatif, « La Magie a tenu. Les Pères Noël ont gagné. »).
Deux variantes de teinte : tchat des Pères Noël (ambre) et tchat des Grinchs (vert sombre). Même structure.
Un bandeau de titre façon journal, sobre. Contraste du texte d'au moins 4,5:1.
Rends un seul fichier HTML avec les deux variantes l'une sous l'autre, classes CSS préfixées « gazette- », couleurs en variables CSS.
```

Branchement : le composant `Message` de `MagicGame.tsx` remplace son bloc gazette par ce gabarit.

## Prompt 3 : la jauge et l'en-tête du jeu

```
Dessine l'en-tête de la page du jeu, en HTML et CSS autonomes, mobile (390 px) et desktop (1080 px).
Éléments : le titre « La Magie de Noël », une ligne d'état (« Manche 2 sur 5. Vote jusqu'au mardi 3 décembre, 20:00. »),
et la jauge de Magie : un nombre de 0 à 8, très lisible, accompagné d'une rangée de segments ou d'étoiles allumés et éteints.
Prévois trois états de la jauge : sereine (4 et plus), fragile (2 ou 3), critique (1), et l'état final à 0.
La différence entre états ne doit pas reposer sur la seule couleur.
Pas d'animation obligatoire. Si tu en proposes une, elle doit s'arrêter avec prefers-reduced-motion.
Rends un fichier HTML avec les quatre états, classes préfixées « jauge- », couleurs en variables CSS.
```

## Prompt 4 : la carte de rôle et la révélation

```
Dessine deux écrans de la page du jeu, en HTML et CSS autonomes, mobile et desktop.
1. « Mon rôle » : la carte de pouvoir (image 5:7 à gauche ou en haut), le rôle (« Grinch infiltré »), le pseudonyme (« Chocolat Chaud »),
une phrase de mission, le nom du pouvoir et son texte, et la mention « Vous seul voyez cette carte. »
Quatre variantes : Père Noël, Grinch, Père Noël infiltré, Grinch infiltré.
2. « Rôles et classement », affiché à la fin : 12 lignes avec nom, rôle, pseudonyme, pouvoir (petite carte), points.
Le premier du classement est mis en avant sans trophée clinquant. Lisible sur 390 px sans défilement horizontal.
Rends un fichier HTML par écran, classes préfixées « role- » et « classement- », couleurs en variables CSS.
```

## Pour me les renvoyer

Dépose les fichiers dans `design/magie/` (ou donne-moi le lien de chaque création). Je branche chaque élément dans les composants existants sans changer les règles ni les textes.
