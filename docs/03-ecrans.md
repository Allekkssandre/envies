# 03 · Écrans

Pour chaque écran : route, maquettes, structure, contenus, états, interactions. Les valeurs de style (tailles, ombres, flous) sont dans `04-design-system.md` et dans `design/boards/<Nom>.html`. Les textes exacts sont dans `12-textes.md`.

Points de rupture : **mobile < 640 px**, **tablette 640–1023 px** (mise en page mobile élargie, grille 2–3 colonnes), **desktop ≥ 1024 px**, **large ≥ 1280 px** (la largeur max de 1320 px est atteinte, seules les marges grandissent). Les maquettes sont à 390 px et 1440 px. Largeur de contenu max 1320 px, gouttières 48 px (desktop) et 16 px (mobile).

| Écran | Route | Desktop | Mobile |
|---|---|---|---|
| Accueil | `/` | AccueilV4 | MAccueilV4 |
| Liste (visiteur) | `/l/[slug]` | ListeV4 | MListeV4, MFiltresV4 |
| Fiche article | `/l/[slug]/a/[ref]` | ArticleV4 | MArticleV4, MArticleSuiteV4 |
| Nouvelle liste | `/nouvelle` | CreationV4 | MCreationV4 |
| Liste créée | `/nouvelle` (état après envoi) | CreeeV4 | MCreeeV4 |
| Déverrouiller | `/l/[slug]/edition` sans cookie | DeverrouillerV4 | MDeverrouillerV4 |
| Mode édition | `/l/[slug]/edition` | EditionV4 | MEditionV4, MAjoutV4 |
| Modifier un article | `/l/[slug]/edition/a/[ref]` | ArticleEditV4 | MQualifierV4 |
| Tri rapide | `/l/[slug]/edition/trier` | TriV4 | MTriV4 |
| Import | `/l/[slug]/edition/importer` | ImportV4 | MImportV4 |
| Réglages | `/l/[slug]/edition/reglages` | ReglagesV4 | MReglagesV4 |
| États (vides, erreurs) | — | EtatsV4 | mêmes contenus en pleine largeur |
| Système visuel | — | FondationsV4 | — |

Les fiches (`/a/[ref]`) et le panneau de modification (`/edition/a/[ref]`) utilisent les **routes interceptées** de Next (`@modal/(.)a/[ref]`) : ouvertes depuis la liste, elles s'affichent en panneau ou feuille par-dessus la liste ; ouvertes directement (lien partagé, rechargement), elles rendent la liste en fond avec le panneau ouvert. `ref` = identifiant court de l'article (10 caractères), voir `05-donnees.md`.

---

## Accueil — `/`

Maquettes : `AccueilV4.jpg`, `MAccueilV4.jpg`.

**Desktop**

- Héros 640 px, texture feuillage + grain en surimpression (`mix-blend-mode: overlay`) + dessin de feuillage au trait (SVG, miroir) à gauche. En haut à droite : bouton lin « Nouvelle liste ». Au centre : petite étiquette « Listes d'envies », titre « *Envies* » (Fraunces italique 300, 220 px), « 7 listes ».
- Barre de recherche en verre clair qui chevauche le bas du héros (−36 px) : icône loupe, champ « Une liste, un prénom », menu « Récentes ▾ » (Récentes, A → Z, Plus d'articles).
- Grille de cartes (`minmax(360px, 1fr)`, écart 40/32 px) :
  - Première carte « Nouvelle liste » : fond sombre feuillage à 45 %, icône +, lien vers `/nouvelle`.
  - Cartes de liste : couverture 300 px avec la texture de l'ambiance, titre selon la règle (premier mot romain, suite italique ; texte lin sur feuillage/ambre, encre sur ciel), pastille « 24 articles ». Sous la couverture, 3 vignettes de 72 px qui se chevauchent et débordent de −34 px sur la couverture (photos des coups de cœur d'abord, puis les premiers articles ; si aucune photo, pas de vignettes). Puis « Merin · modifiée il y a 2 jours ».
- Pied de page feuillage sombre (« Envies » en italique 72 px).

**Mobile**

- Héros 330 px, « *Envies* » 112 px, « 7 listes ». Recherche en verre qui chevauche (−26 px).
- Rangées : vignette d'ambiance 68 px, titre Fraunces 26 px, « Merin · 24 articles », chevron. Séparateurs fins.
- Barre collante en bas en verre : bouton encre « Nouvelle liste » pleine largeur.

**États** : aucune liste (EtatsV4, « Aucune liste pour l'instant. » + bouton) ; recherche sans résultat (« Aucune liste ne correspond. ») ; chargement : squelettes des cartes (couverture et lignes en crème plus foncé, sans animation si `prefers-reduced-motion`).

**Données** : vue `list_summaries` (titre, prénom, ambiance, compte, vignettes, `content_updated_at`).

---

## Liste (visiteur) — `/l/[slug]`

Maquettes : `ListeV4.jpg`, `MListeV4.jpg`, `MFiltresV4.jpg`.

**Desktop**

- Héros 780 px dans l'ambiance de la liste. Barre du haut : « Envies » (lien accueil) ; à droite « Partager » (verre sombre) et « Modifier » (lin, ouvre `/l/[slug]/edition`).
- Bas du héros : étiquette « La liste de Merin », titre 172 px. À droite, panneau en verre sombre (340 px) : petit mot en italique, puis 3 chiffres (articles, coups de cœur, total « 1 240 € » arrondi à l'euro, précédé de « ≈ » s'il manque des prix).
- Barre de filtres en verre clair qui chevauche le héros (−44 px) : onglets de catégories avec compteur (souligné ocre sur l'onglet actif), bouton « Coups de cœur » (rouille, bascule), « Tags ▾ » (popover avec cases à cocher et pastilles de couleur), « Ordre de la liste ▾ » (popover radio), bouton loupe (déplie un champ de recherche dans la barre). La barre devient collante en haut au défilement (fond verre, ombre réduite).
- Sections par catégorie, dans l'ordre des catégories, « Non classé » en dernier :
  - Titre de section 72 px (premier mot romain, suite italique ocre), compteur « 8 articles » à droite, filet dessous.
  - Grille `auto-fill minmax(260px, 1fr)`, écart 48/32 px.
  - Carte : photo 340 px (rayon 18), cœur rouille en haut à droite si coup de cœur, puis nom (16 px, 2 lignes max) et prix (Fraunces 21, insécable) sur la même ligne, puis domaine + premier tag (pastille de couleur + nom).
- Halos radiaux ocre (droite) et olive (gauche) en fond. Les sections alternent fond crème et « lumière de ciel » (texture ciel doré masquée en fondu 160 px en haut / 120 px en bas) : une section sur deux, à partir de la deuxième.
- Pied de page feuillage + voile sombre 45 % : « Envies », lien « Toutes les listes ».
- Grain fin sur toute la page.

**Mobile**

- Héros 470 px : boutons ronds en verre (retour accueil, partager) et bouton lin crayon (modifier). Titre 84 px sur deux lignes (« Mes » / « *30 ans* »), ligne « 24 articles · 6 coups de cœur · ≈ 1 240 € ». Le petit mot apparaît sous la barre de filtres, en italique 18 px (absent de la maquette faute de place, à ajouter).
- Barre en verre qui chevauche (−30 px) : catégories défilantes horizontalement + bouton encre « Filtres ».
- Grille 2 colonnes (écart 22/14), photo 210 px, nom 14 px, prix Fraunces 18.
- **Feuille de filtres** (MFiltresV4) : poignée, « Filtres », « Tout effacer » ; « Seulement les coups de cœur » (interrupteur rouille + compteur) ; Catégorie (puces, choix unique, compteurs) ; Tags (puces multiples, coche + teinte de la couleur du tag quand actif) ; Ordre (4 boutons radio en grille 2×2). Bouton du bas « Voir N articles » (N recalculé en direct). Les filtres s'appliquent à la fermeture.

**Carte sans photo** : fond dégradé lin (radial #F4EBDB → #E2D1B3) + initiale du nom en Fraunces italique 300, ocre à 55 %, centrée.

**Photo d'article** : affichée sur le fond studio (`photo-backdrop.jpg`). Si l'image a un fond clair (détecté à l'extraction, `meta.lightBackground = true`), elle est en `object-fit: contain` avec 8 % de marge et `mix-blend-mode: multiply`, pour que le blanc se fonde dans le fond studio. Sinon `object-fit: cover`.

**États** : liste vide (« Cette liste est encore vide. ») ; filtres sans résultat (« Rien avec ces filtres. » + « Tout effacer ») ; liste introuvable → 404 (EtatsV4) ; slug ancien → redirection 308 vers le nouveau.

**Interactions** : clic carte → fiche ; « Partager » ; « Modifier » ; filtres synchronisés dans l'URL (`router.replace`, sans scroll) ; ancre `#c-<categorieRef>` par section.

---

## Fiche article — `/l/[slug]/a/[ref]`

Maquettes : `ArticleV4.jpg`, `MArticleV4.jpg`, `MArticleSuiteV4.jpg`.

**Desktop** : panneau de 640 px collé à droite (rayon 30 px côté gauche), sur la liste floutée (voile `rgba(24,20,10,.5)` + flou 6 px). Entrée : glissement depuis la droite 320 ms.

- En-tête : ← « 1 sur 24 » → (article précédent / suivant dans l'ordre affiché, flèches du clavier aussi), bouton lien (copier le lien de l'article), bouton encre ✕.
- Photo 420 px, rayon 22, pastille « Coup de cœur » en verre si besoin. Plusieurs photos : non (v1 = une photo).
- Catégorie (capitales) + tags (pastilles). Nom (Fraunces 36). Prix (Fraunces 44) + « relevé sur etsy.com le 12 octobre » (date de `price_checked_at`, ou « saisi à la main »).
- Encart olive « Note de Merin » (si note) : texte en italique 24 px.
- Bouton encre pleine largeur « Voir sur etsy.com ↗ » (si lien).
- Description (si présente) : 15 px, 4 lignes puis « Lire la suite ». (Absente de la maquette, à placer entre le prix et la note.)
- Section « Trouver *ailleurs* » : champ prérempli avec les mots de recherche (modifiable, bouton copier), puis 3 groupes de liens : Comparer (Google Shopping, idealo, Ledenicheur), Neuf (Amazon, Fnac, Etsy), Seconde main (leboncoin, Vinted, eBay). Voir `09-trouver-ailleurs.md`.

**Mobile** : feuille depuis le bas, haut à 40 px (on voit la liste rétrécie derrière, échelle 0,94). Poignée ; glisser vers le bas ferme.

- Photo 330 px avec cœur, bouton lien et ✕ en surimpression, points de pagination si on balaie vers l'article suivant / précédent (balayage horizontal sur la photo).
- Catégorie, tag, nom 28, prix 34, relevé, note.
- Lien « Trouver ailleurs ⌄ » qui fait défiler jusqu'à la section. Au défilement, un en-tête compact apparaît (vignette 44 px, nom tronqué, prix, ✕) : MArticleSuiteV4.
- Liens de recherche en grilles de 3 tuiles (52 px de haut), seconde main sur fond olive pâle. Mention : « Ces liens ouvrent une simple recherche dans un nouvel onglet. Rien n'est suivi ni rémunéré. »
- Bouton collant en bas « Voir sur etsy.com ».

**Sans lien** : pas de bouton boutique ; « Trouver ailleurs » reste (recherche sur le nom).
**Sans prix** : pas de ligne prix.

---

## Nouvelle liste — `/nouvelle`

Maquettes : `CreationV4.jpg`, `MCreationV4.jpg`.

**Desktop** : deux colonnes de 720 px.

- Gauche (papier + grain + halo olive) : « ← Toutes les listes », « Envies ». Titre « Nouvelle *liste* » 76 px, phrase « Pas de compte. Un nom, un mot de passe simple, et c'est parti. »
- Formulaire : « Nom de la liste » (grand champ Fraunces 34), « Votre prénom » + « Mot de passe pour modifier » côte à côte (aides sous les champs), « Un petit mot (facultatif) » (zone de texte en italique), « Ambiance » (3 vignettes radio 104 px avec coche), bouton « Créer la liste » + mention « Toutes les listes sont visibles depuis l'accueil. Le mot de passe protège seulement la modification. »
- Droite : aperçu du héros dans l'ambiance choisie (rayon 30, inset 24 px), pastille « Aperçu », prénom, titre 128 px, petit mot. Se met à jour à chaque frappe. Titre vide → « Ma liste » en gris.

**Mobile** : aperçu en haut (250 px, ✕ pour annuler), formulaire en feuille qui chevauche (−18 px). Ordre : nom, prénom, ambiance (vignettes 64 px), mot de passe, « + Ajouter un petit mot » (déplie la zone). Bouton collant « Créer la liste ».

**Validation** : à l'envoi et à la sortie de chaque champ. Messages sous le champ en rouille. Champ piège invisible (`website`) contre les robots : s'il est rempli, faire comme si tout allait bien et ne rien créer.

## Liste créée

Maquettes : `CreeeV4.jpg`, `MCreeeV4.jpg`. Même route, état après succès (pas de nouvelle page : remplacer le formulaire, le cookie d'édition est déjà posé).

- Desktop : carte en verre papier 620 px centrée sur fond feuillage. Coche olive, « C'est *prêt.* », « « Noël 2026 » est en ligne. Gardez ces deux liens quelque part. »
- Bloc « Lien à partager » : URL complète, bouton encre « Copier », aide « Pour vos proches. Lecture seule. »
- Bloc « Lien secret de modification » : fond ocre pâle, icône clé, URL avec `#cle=…`, bouton « Copier », aide « Ouvre la modification sans mot de passe, sur n'importe quel appareil. À ne pas partager. Il reste visible dans les réglages. »
- Boutons « Ajouter les premières envies → » (vers l'édition) et « Voir la liste ».
- Mobile : feuille papier sous un bandeau feuillage, mêmes blocs, boutons collants en bas.

---

## Déverrouiller

Maquettes : `DeverrouillerV4.jpg`, `MDeverrouillerV4.jpg` (état erreur).

- Desktop : modale 520 px centrée sur la liste floutée. Icône cadenas, « Modifier *Mes 30 ans* », « Le mot de passe a été choisi à la création de la liste. », champ mot de passe avec œil, case « Rester déverrouillé sur cet appareil (30 jours) », bouton « Déverrouiller », aide « Oublié ? Ouvrez le lien secret de modification reçu à la création, ou demandez-le à la personne qui a créé la liste. » ✕ ramène à la page visiteur.
- Mobile : feuille collée au clavier (utiliser `visualViewport` pour la garder au-dessus), champ focalisé à l'ouverture, `enterkeyhint="go"`.
- Erreur : bordure rouille + halo, message avec icône. Trop d'essais : message horloge, bouton désactivé (EtatsV4).

---

## Mode édition — `/l/[slug]/edition`

Maquettes : `EditionV4.jpg`, `MEditionV4.jpg`, `MAjoutV4.jpg`.

**Desktop**

- Héros réduit à 440 px. Barre du haut : « Envies », pastille centrale « Mode édition » (cadenas ouvert, fond ocre translucide), à droite « Importer », « Réglages » (verre) et « Terminer » (lin, coche).
- Titre 128 px, « 24 articles · 5 à trier » à droite.
- **Barre d'ajout** (chevauche le héros de −64 px, devient collante en haut au défilement) : carte de verre clair, champ blanc 76 px avec contour encre 2 px et halo ocre au focus, icône +, saisie en Fraunces 28 « Collez un lien, ou écrivez un nom », bouton « Photo » (fantôme), bouton encre « Ajouter ». Ligne d'aide : `Entrée` ajoute et vide le champ · `⌘ V` plusieurs liens collés : un article par ligne · glissez une image ou un fichier Excel n'importe où. Le champ est multiligne en interne : un collage de plusieurs lignes crée plusieurs articles, `Maj+Entrée` insère une ligne.
- **À trier** (si ≥ 1 article) : panneau dégradé ciel/ocre (texture ciel à 35 %), titre « À *trier* », « 5 nouveaux, pas encore rangés. Visibles dans « Non classé ». » (adapter : visibles dans leur catégorie s'ils en ont une), boutons « Tout ranger dans… ▾ » et « Trier maintenant » (icône clavier). Rangée de 5 cartes (170 px), les plus récentes d'abord, puis « Voir les 12 » si plus. États de carte :
  - **Récupération…** : fond studio + reflet qui passe (animation 1,4 s, désactivée si mouvement réduit), pastille « Récupération… » avec icône qui tourne, ligne grise à la place du nom, domaine.
  - **Trouvé** : photo, nom, prix (ou « prix inconnu »), domaine.
  - **Rien trouvé** : cadre pointillé rouille, « Pas de photo trouvée », nom = lien raccourci, « Rien trouvé · compléter » (ouvre le panneau de modification).
  - **Sans lien** : vignette initiale, « sans lien ».
- **Sections** : comme la page visiteur, plus : poignée de section, bouton crayon (renommer en ligne), « Ajouter ici » (pré-remplit la catégorie de la barre d'ajout : une puce « dans Maison & déco ✕ » apparaît dans le champ).
- **Carte en édition** : cœur toujours visible (contour encre si non coup de cœur, cliquable), au survol : case de sélection en haut à gauche, poignée à gauche, barre en verre en bas de la photo (« Modifier », « Déplacer », corbeille). Sélectionnée : contour encre 3 px décalé de 4 px.
- **Barre de sélection** flottante en bas au centre (encre 92 %, verre) : « 2 sélectionnés », Catégorie ▾, Tags ▾, Coup de cœur, Supprimer (rouille), ✕.
- **Suppression** : la carte disparaît (fondu + réduction 180 ms), message « Article supprimé · Annuler » 8 s.

**Mobile**

- Héros 236 px : bouton réglages (verre), pastille « Mode édition », bouton lin « Terminer ». Titre 58 px.
- Panneau « À *trier* » en verre ocre qui chevauche le héros, compteur, bouton « Trier ». Cartes de 118 px en défilement horizontal.
- Sections en 2 colonnes, cœur cliquable en haut à droite, bouton ⋯ en bas à droite (menu : Modifier, Déplacer, Coup de cœur, Supprimer). Toucher la carte = modifier.
- Barre d'ajout collante en bas (fond verre) : faux champ « Coller un lien, écrire un nom », icône appareil photo, bouton encre +. Ouvre la feuille Ajouter.
- Message « Article supprimé · Annuler » au-dessus de la barre.

**Feuille Ajouter (mobile)** : voir parcours C3. Champ multiligne avec contour encre et halo, boutons Coller / Photo / Ajouter. Aide : « Ajoutez en rafale : la fiche se complète toute seule (photo, prix, description). Vous rangerez plus tard. » Liste « Ajoutés à l'instant » (vignette 52 px, titre, sous-titre d'état, icône ✓ olive ou bouton « Compléter »). Bouton bas « Trier les N maintenant ».

**Liste vide en édition** : la barre d'ajout seule, puis l'encart EtatsV4 « Collez un premier lien, *ou écrivez un nom.* » + « Importer un fichier Excel ».

---

## Modifier un article — `/l/[slug]/edition/a/[ref]`

Maquettes : `ArticleEditV4.jpg`, `MQualifierV4.jpg` (défilement complet).

- Desktop : panneau 640 px à droite. En-tête « Modifier l'article · enregistré automatiquement », corbeille, ✕. Enregistrement à la sortie de chaque champ (et `⌘ Entrée`), indicateur discret.
- Mobile : feuille plein écran, « Annuler » / « Modifier l'article » / « Enregistrer » (enregistre tout d'un coup). Fermer avec des modifications non enregistrées → « Abandonner les modifications ? » avec « Abandonner » / « Continuer ».
- Contenu :
  - Photo (300 px desktop, 220 mobile), bouton « Changer la photo » (menu : Choisir un fichier, Prendre une photo sur mobile, Retirer la photo).
  - « Trouvées sur la page » : jusqu'à 6 vignettes de 56 px issues de `image_candidates`, la courante entourée. Toucher une autre → traitement de cette image en arrière-plan.
  - Nom ; Prix (+ « € » ou devise ; virgule ou point acceptés) ; Lien (bouton ↻ « Relire la page du lien »).
  - Catégorie : puces à choix unique + « + Nouvelle » (champ en ligne, Entrée crée et sélectionne).
  - Tags : puces multiples + « + Nouveau tag ».
  - « Coup de cœur » (interrupteur rouille).
  - « Note pour les visiteurs » (500 caractères).
  - « Supprimer l'article » (rouille, en bas).
- Changer la catégorie ici sort l'article de « À trier ».

---

## Tri rapide — `/l/[slug]/edition/trier`

Maquettes : `TriV4.jpg`, `MTriV4.jpg`.

Paramètre facultatif `?ids=a,b,c` pour trier une sélection (depuis la feuille Ajouter) ; sinon tous les articles à trier, du plus ancien au plus récent.

**Desktop** : plein écran sur feuillage assombri (radial), grain.

- En-tête : « *Tri rapide* » + « Mes 30 ans · à trier », progression « 3 sur 5 » avec segments (olive = faits, miel = courant), « Quitter ».
- Pile : deux cartes fantômes décalées derrière la carte courante (1080 × 560, papier, rayon 34).
- Carte : photo 440 × 500 à gauche ; à droite domaine · « ajouté il y a 2 min », nom modifiable (Fraunces 36, souligné pointillé, crayon), prix ; « Catégorie » + badge olive « proposée d'après la page : Maison › Luminaires » si suggestion ; puces de catégories numérotées `1`…`9` + `N` « Nouvelle catégorie… » ; « Tags » avec puces lettrées ; en bas « C Coup de cœur », « Passer → », « Valider et suivant ».
- Légende en verre sombre en bas : ← précédent · → passer · Entrée valider et suivant · 1–9 catégorie · A Z E R… tags · C coup de cœur · Suppr supprimer · Échap quitter.
- Raccourcis : utiliser `KeyboardEvent.code` (position physique). Tags = `KeyQ KeyW KeyE KeyR KeyT KeyY KeyU KeyI KeyO KeyP` (10 premiers tags dans l'ordre des tags). Afficher la lettre réelle de la touche via `navigator.keyboard.getLayoutMap()` quand c'est disponible ; sinon AZERTY si `navigator.language` commence par `fr`, QWERTY sinon. Au-delà de 9 catégories ou 10 tags : pas de raccourci, clic uniquement.
- Animation : la carte validée part vers le haut à droite (240 ms), la suivante avance. Mouvement réduit : fondu simple.

**Mobile** : fond feuillage, ✕ et progression en haut. Carte inclinée de −1,2° (photo 150 × 260 à gauche, domaine, nom, prix, « ← glisser pour passer »). Feuille papier en bas : « Ranger dans » (puces), « Tags » (puces), puis barre : cœur rond, « Passer », « Valider → ». Glisser la carte : gauche = passer, droite = valider (seuil 30 % de largeur ou vitesse).

**Fin** : retour vers l'édition avec le message « 5 articles rangés ». Si plus rien à trier en arrivant : « Rien à trier. » + retour.

---

## Import — `/l/[slug]/edition/importer`

Maquettes : `ImportV4.jpg` (étape 2), `MImportV4.jpg`. Détails de calcul : `08-import-export.md`.

- Héros 300 px : « ← Mes 30 ans », « Annuler », titre « Importer *un fichier* », « Excel, CSV ou Numbers exporté ».
- Barre en verre qui chevauche : étapes (1 Fichier ✓ · 2 Colonnes · 3 Vérifier) et pastille du fichier (icône olive, nom, « 45 lignes · 8 colonnes », choix de la feuille, « Changer »).
- **Étape 1** (non dessinée, même gabarit) : grande zone de dépôt pointillée 280 px, icône tableur, « Déposez un fichier ici, ou choisissez-le », « .xlsx, .xls, .csv, .ods · 5 Mo max », bouton « Choisir un fichier ». Erreurs : format, taille, fichier vide, plus de 2 000 lignes.
- **Étape 2** : titre « Les *colonnes* », « Les correspondances sont devinées d'après les titres. Changez celles qui ne vont pas. » Tableau : lettre de colonne + titre, 3 exemples, flèche, menu « Devient » (Nom, Lien, Prix, Catégorie, Tags, Coup de cœur, Note, Photo (lien d'image), Ne pas importer) avec badge « deviné », et une aide sous le menu (« 2 nouvelles : Jardin, Cuisine », « oui, x, 1, ✓ comptent comme oui », « séparés par des virgules »). Une même cible ne peut être choisie que pour une colonne (sauf « Ne pas importer ») : choisir une cible déjà prise remet l'autre colonne sur « Ne pas importer ».
- Colonne de droite « Aperçu » : 3 premiers articles tels qu'ils seront créés (vignette initiale, « photo à venir »), puis options (cases) et la mention des doublons.
- Bouton « Importer 43 articles → », « Retour », « 45 lignes − 2 doublons ». Désactivé si aucune colonne n'est « Nom » ni « Lien ».
- **Étape 3** : résumé chiffré, boutons « Voir les articles à trier » et « Trier maintenant ».
- Mobile : en-tête simple (←, « Importer », « Annuler »), étapes compactes, pastille fichier, une carte par colonne (lettre, titre, exemples sur une ligne, menu pleine largeur), barre collante avec le décompte et le bouton.

---

## Réglages — `/l/[slug]/edition/reglages`

Maquettes : `ReglagesV4.jpg`, `MReglagesV4.jpg` (défilement complet).

- Héros 320 px : « ← Retour à la liste », indicateur « ✓ Enregistré » (ou « Enregistrement… »), titre « Réglages *de Mes 30 ans* ».
- Desktop : sommaire collant à gauche (La liste, Catégories, Tags, Accès, Exporter, Supprimer en rouille), sections en cartes de verre clair (rayon 30, 34 px de marge) à droite (860 px max). Mobile : sommaire en puces défilantes qui chevauche le héros, cartes pleine largeur.
- **La liste** : nom (grand champ), prénom, adresse (slug, bouton copier, aide = URL complète ; modification : « Les anciens liens redirigeront vers la nouvelle adresse. »), petit mot, ambiance.
- **Catégories** : rangées (poignée, nom modifiable en place, « 8 articles », corbeille). « Non classé » en italique, non modifiable, toujours en dernier. Champ pointillé « Nouvelle catégorie » + « Ajouter ». Aide : « Glissez pour changer l'ordre d'affichage. Supprimer une catégorie remet ses articles dans « Non classé ». » Supprimer une catégorie non vide : suppression immédiate + message « Catégorie supprimée · Annuler ».
- **Tags** : rangées (pastille de couleur cliquable → popover de 8 couleurs, nom, compteur, corbeille), champ « Nouveau tag : avis, priorité, taille… ».
- **Accès** : « Nouveau mot de passe » (vide = inchangé) + « Changer » (message « Mot de passe changé. Les autres appareils devront le saisir. ») ; bloc lien secret (comme à la création) ; « Régénérer le lien secret » (confirmation en ligne : « L'ancien lien ne marchera plus. Régénérer ? » Oui / Non) ; « Verrouiller cet appareil » (supprime le cookie, retour à la page visiteur).
- **Exporter** : « Télécharger en Excel » + « Mêmes colonnes que l'import : vous pouvez le modifier puis le réimporter. »
- **Supprimer la liste** : carte rouille pâle, « Les 24 articles et leurs photos seront effacés. Impossible de revenir en arrière. », champ « Tapez « Mes 30 ans » pour confirmer », bouton rouille actif seulement si le texte correspond exactement. Après suppression : accueil + message « Liste supprimée. ».
- Mobile : lien « Importer un fichier Excel » en bas.

---

## Éléments communs

- **Messages éphémères** (sonner) en bas au centre (desktop) ou au-dessus de la barre basse (mobile), encre, 4 s (8 s s'il y a « Annuler »). Un seul à la fois.
- **Feuilles mobiles** (vaul) : poignée, fermeture par glissement, fond voilé `rgba(24,20,10,.55)`, rayon 26 en haut.
- **Panneaux desktop** (Radix Dialog) : focus piégé, `Échap` ferme, retour du focus à l'élément d'origine.
- **Titres de page** (`<title>`) : « Mes 30 ans · liste de Merin · Envies », « Lampe champignon · Mes 30 ans · Envies », « Envies » pour l'accueil.
- **Favicon** : feuille au trait lin sur rond olive (dessin `leaf` des maquettes).
