# 11 · Plan de livraison

Neuf jalons, dans l'ordre. Chacun se termine par une PR déployée en preview, avec ses critères cochés. Ne pas commencer un jalon avant que le précédent soit vert. Chaque jalon est vérifié à **390 px** et à **1440 px**.

---

## Jalon 0 · Socle

- App Next.js (App Router, TS strict, Tailwind v4, ESLint, Prettier), pnpm, Node 22. Générée dans un dossier temporaire puis fusionnée à la racine (le dépôt contient déjà les specs, les textures et `supabase/`).
- Types TypeScript de la base : `supabase gen types typescript --project-id nanhxhrbgftqhqivwfvt > src/types/database.ts`, clients Supabase typés avec `Database`.
- `globals.css` avec les tokens de `04-design-system.md`, polices via `next/font`, textures servies depuis `public/textures`, calque `<Grain />` global.
- Supabase local (`supabase init`, `supabase start`), migration et seed appliqués.
- Clients Supabase (service role `server-only`, anon serveur, anon navigateur).
- Vitest et Playwright configurés, un test de fumée chacun.
- CI GitHub Actions (fournie dans `.github/workflows/ci.yml`, à ajuster). Projet Vercel relié au dépôt, variables Production + Preview (même projet Supabase), `vercel.json`.
- Page `/design` (non liée, `noindex`) qui montre tous les composants de base : boutons, puces, champs, interrupteur, carte article, carte sans photo, verre clair et sombre sur feuillage. C'est la planche FondationsV4 en vrai.

**Critères** : `pnpm build` passe ; la preview Vercel s'ouvre ; `/design` ressemble à `FondationsV4.jpg` (couleurs, typo, matières) ; Lighthouse accessibilité ≥ 95 sur `/design`.

## Jalon 1 · Lecture (visiteur)

- Accueil (`/`) desktop et mobile, recherche, tri, états vides.
- Liste (`/l/[slug]`) : héros d'ambiance (les 3 ambiances), panneau du petit mot et chiffres, barre de filtres collante, sections, cartes, section claire une sur deux, pied de page.
- Filtres : catégorie, tags (OU), coups de cœur, ordre, recherche ; état dans l'URL ; feuille mobile avec « Voir N articles ».
- Fiche (`/a/[ref]`) en panneau (desktop) et feuille (mobile), route interceptée + page directe, précédent / suivant, copier le lien.
- « Trouver ailleurs » (`09`), avec URL vérifiées à la main.
- Partager (Web Share API ou copie).
- 404, redirection d'ancien slug.
- Photo : fond studio, `contain + multiply` si `meta.lightBackground`, repli initiale.

**Critères** :
- Avec le seed, `/l/mes-30-ans` montre 4 sections + « Non classé », les 3 coups de cœur, le total « ≈ 757 € ».
- Filtrer « Maison & déco » + tag « Seconde main OK » montre 2 articles (Fauteuil en rotin, Vase boule) ; ajouter « Coups de cœur » n'en laisse qu'un (Vase boule).
- Le bouton retour ferme la fiche sans quitter la liste. Le lien copié d'une fiche ouvert dans un nouvel onglet affiche la liste avec la fiche ouverte.
- Navigation complète au clavier (Tab, Entrée, Échap, flèches dans la fiche).
- e2e : `visitor.spec.ts` (accueil → liste → filtre → fiche → trouver ailleurs) en desktop et mobile.

## Jalon 2 · Création et accès

- `/nouvelle` avec aperçu en direct, validation, champ piège, limite de fréquence.
- État « C'est prêt. » avec les deux liens à copier.
- Jeton d'édition (cookie HMAC), `requireEdit`, déverrouillage par mot de passe (modale desktop, feuille mobile au-dessus du clavier) et par lien secret (fragment).
- Messages d'erreur et « Trop d'essais ».
- « Verrouiller cet appareil » (bouton temporaire dans l'édition en attendant les réglages).

**Critères** :
- Créer une liste, fermer le navigateur, revenir : toujours déverrouillé (case cochée) ; décochée : verrouillé après fermeture de session.
- Le lien secret ouvert dans un autre navigateur déverrouille, et le fragment disparaît de l'URL.
- 11 mauvais mots de passe → bloqué 15 min (testé avec une fenêtre raccourcie en test).
- Aucune requête d'écriture vers Supabase depuis le navigateur (vérifier l'onglet réseau : seulement des lectures et le websocket temps réel).
- Tests unitaires : scrypt, génération et normalisation de clé, signature et vérification de jeton (expiré, mauvaise version, signature altérée).

## Jalon 3 · Édition et ajout rapide

- Mode édition desktop et mobile (héros réduit, pastille, Terminer).
- Barre d'ajout desktop (collante, multiligne, Entrée, collage multiple, glisser une image) et mobile (barre basse + feuille « Ajouter » avec « Ajoutés à l'instant »).
- Articles sans lien avec photo envoyée (sharp → Storage).
- Zone « À trier » avec les 4 états (pour l'instant, les liens restent `pending` : l'extraction arrive au jalon 4 ; simuler les états avec le seed).
- Cœur cliquable, panneau / feuille « Modifier l'article » (sans la relecture), catégories et tags créés en ligne.
- Suppression avec « Annuler » (8 s), restauration.
- Sélection multiple et barre d'actions, « Tout ranger dans… ».
- Glisser-déposer des cartes (dans et entre sections) et des sections ; « Déplacer » au menu ⋯ sur mobile.
- Doublon de lien → « Déjà dans la liste » + mise en évidence.

**Critères** :
- Coller 5 liens d'un coup → 5 cartes dans « À trier » en moins de 300 ms (optimiste), positions correctes après rechargement.
- Supprimer puis « Annuler » restaure à la même place.
- Déplacer une carte de « Maison & déco » vers « Lecture & carnets » change sa catégorie et la range.
- Toutes les actions renvoient `EDIT_LOCKED` sans cookie (test d'intégration sur chaque action).
- e2e : `edit.spec.ts` (déverrouiller → ajouter un nom → ajouter une photo → modifier → coup de cœur → supprimer → annuler).

## Jalon 4 · Extraction depuis les liens

- Tout `07-extraction-liens.md` : normalisation, `safeFetch` avec protection SSRF, extraction générique, prix, adaptateurs (leboncoin, amazon, vinted, ikea, Shopify), image (2 tailles, fond clair), proposition de catégorie, écriture sans écraser.
- Lancement via `after()`, temps réel, relance par le client, statut `failed` propre.
- « Relire la page du lien » et choix parmi les photos trouvées.

**Critères** :
- Tests unitaires sur au moins 10 fixtures HTML réelles (titre, prix, devise, image, fil d'Ariane attendus).
- `parsePrice` : tous les cas du tableau de `07` § 5.
- `safeFetch` refuse `http://localhost`, `http://127.0.0.1`, `http://169.254.169.254`, un domaine qui résout vers 10.x, et une redirection vers l'un d'eux.
- En preview : un lien Etsy, un lien Fnac, un lien leboncoin se remplissent en moins de 10 s, la carte se met à jour sans recharger. Un lien Amazon bloqué finit en « Rien trouvé · compléter ».
- Une image produit sur fond blanc s'affiche fondue dans le fond studio.

## Jalon 5 · Tri rapide

- Desktop : pile, raccourcis (`KeyboardEvent.code`, étiquettes selon la disposition), édition en ligne du nom et du prix, catégorie proposée présélectionnée, nouvelle catégorie en ligne, animation.
- Mobile : carte glissable, boutons, cœur.
- `?ids=` pour trier une sélection ; fin de tri ; « Rien à trier. »

**Critères** :
- Trier 5 articles au clavier seul, sans souris, en moins de 30 s.
- Les raccourcis ne se déclenchent pas pendant la saisie du nom.
- Sur un clavier AZERTY, la légende affiche « A Z E R » ; en QWERTY « Q W E R ».
- e2e : `sort.spec.ts` (desktop clavier, mobile boutons).

## Jalon 6 · Import et export

- Import en 3 étapes (`08-import-export.md`), desktop et mobile, glisser un fichier sur l'édition.
- Export .xlsx réimportable.

**Critères** :
- Fichier de test `tests/fixtures/import-45.xlsx` (à créer : 45 lignes, 8 colonnes comme dans la maquette, dont 2 doublons) → la correspondance devinée est celle de `ImportV4.jpg`, et l'import crée 43 articles et 2 catégories.
- CSV avec `;` et accents en Windows-1252 importé correctement.
- Export d'une liste puis import dans une liste vide : mêmes articles, catégories, tags, coups de cœur, notes, prix.
- Tests unitaires de la devinette de colonnes et des conversions.

## Jalon 7 · Réglages

- Toutes les sections de `ReglagesV4` desktop et mobile, enregistrement automatique avec indicateur.
- Adresse (slug) avec redirection, changement de mot de passe (déconnecte les autres appareils), lien secret (copier, régénérer), verrouiller, export, suppression de la liste avec confirmation.
- Catégories et tags : renommer, ordonner, couleur, supprimer avec « Annuler ».

**Critères** :
- Changer le slug : l'ancien lien redirige (308).
- Régénérer la clé : l'ancien lien secret affiche « Ce lien de modification n'est plus valable. » ; un autre appareil déverrouillé est verrouillé à sa prochaine action.
- Supprimer la liste : disparaît de l'accueil, son ancien lien donne 404.

## Jalon 8 · Finitions

- Images OpenGraph par liste (`next/og` : texture de l'ambiance, prénom, titre selon la règle typographique) et par article (photo + nom + prix).
- Métadonnées, favicon, `manifest.webmanifest`, icône d'écran d'accueil.
- Option PWA « cible de partage » : `share_target` dans le manifeste → `/partage?url=…&title=…&text=…` : choisir parmi les listes déverrouillées sur l'appareil (lecture des cookies) → ajout direct dans « À trier ». Sans liste déverrouillée : « Ouvrez d'abord une de vos listes en mode édition sur ce téléphone. »
- Tâche quotidienne complète (purge, nettoyage, export de sauvegarde le dimanche).
- Passe accessibilité (axe sur chaque page, lecteur d'écran sur les parcours principaux), passe performance (LCP, poids JS), `prefers-reduced-motion`.
- Relecture de tous les textes contre `12-textes.md`.

**Critères** : Lighthouse ≥ 90 performance mobile et ≥ 95 accessibilité sur accueil, liste, fiche ; partage d'un lien depuis Chrome Android vers Envies ajoute l'article ; aperçu de lien correct dans WhatsApp et iMessage.

---

## Tests : récapitulatif

| Type | Contenu minimum |
|---|---|
| Unitaires (Vitest) | `normalizeUrl`, `parsePrice`, `extract` sur fixtures, `suggestCategory`, `buildSearchQuery`, devinette de colonnes, conversions d'import, `slugify`, `splitTitle`, format des prix, scrypt, clé, jeton, positions (fractional-indexing autour des cas limites) |
| Intégration | actions serveur contre Supabase locale : `requireEdit`, doublons, restauration, suppression de catégorie, import par lots |
| E2E (Playwright, 390 et 1440) | visiteur, création, déverrouillage (mot de passe et lien secret), édition, tri, import, réglages |
