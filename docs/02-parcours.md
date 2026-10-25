# 02 · Parcours

Vue d'ensemble : `docs/screens/ParcoursV4.jpg`. Chaque étape renvoie aux écrans de `03-ecrans.md`.

## Visiteur

### V1. Consulter une liste reçue par lien (cas principal, mobile)

1. Le visiteur ouvre `/l/mes-30-ans` depuis une messagerie. L'aperçu du lien montre le titre, le prénom et l'image d'ambiance (balises OpenGraph, voir jalon 8).
2. Il voit le héros (« La liste de Merin », « Mes *30 ans* », petit mot, 24 articles · 6 coups de cœur · ≈ 1 240 €), puis la bande de catégories en verre qui chevauche le héros.
3. Il fait défiler les sections par catégorie. Il touche « Filtres » pour ouvrir la feuille de filtres (catégorie, tags, coups de cœur, ordre). Le bouton du bas annonce le résultat (« Voir 2 articles »).
4. Il touche une carte : la fiche s'ouvre en feuille presque plein écran par-dessus la liste. URL : `/l/mes-30-ans/a/<ref>`. Bouton retour du navigateur = fermeture.
5. Il touche « Voir sur etsy.com » (nouvel onglet) ou descend vers « Trouver ailleurs », ajuste les mots de recherche et ouvre un comparateur, une boutique neuve ou un site de seconde main.

### V2. Parcourir l'accueil

1. `/` : héros « Envies », recherche en verre, puis les listes. Desktop : cartes avec la couverture d'ambiance, le titre, le nombre d'articles et 3 vignettes. Mobile : rangées compactes.
2. Recherche instantanée (côté client si moins de 200 listes, sinon côté serveur) par titre ou prénom, insensible aux accents.
3. Tri : « Récentes » (dernière modification de contenu), « A → Z », « Plus d'articles ».

### V3. Partager

- Bouton « Partager » de la liste : `navigator.share({ title, url })` si disponible, sinon copie du lien et message « Lien copié ».
- Bouton lien dans la fiche : copie `/l/<slug>/a/<ref>`.

## Créateur

### C1. Créer une liste

1. Accueil → « Nouvelle liste » → `/nouvelle`.
2. Saisie : nom de la liste, prénom, mot de passe (visible par défaut, bouton œil pour masquer), petit mot (facultatif, replié sur mobile), ambiance (3 vignettes). L'aperçu du héros se met à jour en direct (desktop : colonne de droite ; mobile : en haut).
3. « Créer la liste » → création côté serveur (liste, secret, cookie d'édition posé immédiatement) → écran « C'est prêt. » avec les deux liens : lien à partager et lien secret de modification, chacun avec « Copier ».
4. « Ajouter les premières envies » → `/l/<slug>/edition` (liste vide en mode édition, champ d'ajout focalisé sur desktop).

Erreurs : champ manquant (message sous le champ), nom de liste trop long, mot de passe trop court, trop de créations depuis la même adresse (« Trop de listes créées d'un coup. Réessayez dans une heure. »).

### C2. Déverrouiller une liste existante

- Depuis la page liste, « Modifier » → `/l/<slug>/edition`. Sans cookie valide, la page affiche la liste en fond et la modale « Modifier *Mes 30 ans* » (desktop) ou une feuille au-dessus du clavier (mobile).
- Mot de passe + case « Rester déverrouillé sur cet appareil (30 jours) », cochée par défaut. Décochée : cookie de session (12 h max).
- Bon mot de passe → la modale se ferme, le mode édition apparaît. Mauvais : « Ce n'est pas le bon mot de passe. », champ en rouille, focus conservé, texte sélectionné.
- Plus de 10 essais en 15 minutes pour une même liste et une même adresse : « Trop d'essais. Réessayez dans 10 minutes. », bouton désactivé.
- Par lien secret : `/l/<slug>/edition#cle=XXXX-XXXX-XXXX`. Le fragment n'est jamais envoyé au serveur : la page lit `location.hash`, envoie la clé à l'action `unlockWithKey`, efface le fragment (`history.replaceState`) et affiche le mode édition. Clé invalide : la modale mot de passe s'affiche avec « Ce lien de modification n'est plus valable. ».

### C3. Ajouter vite (le cœur du produit)

**Desktop** (mode édition) :

1. Le grand champ « Collez un lien, ou écrivez un nom » est en haut, toujours visible (il chevauche le héros, puis devient collant en haut de l'écran au défilement).
2. Coller un lien + Entrée → l'article apparaît immédiatement dans « À trier » avec l'état « Récupération… ». Le champ se vide et garde le focus.
3. Coller plusieurs lignes (liens et/ou noms) → un article par ligne non vide. Message : « 5 articles ajoutés ».
4. Écrire un nom + Entrée → article sans lien, vignette avec l'initiale.
5. Glisser une image n'importe où sur la page → article sans lien avec cette photo, nom vide à compléter (focus sur le nom dans le panneau de modification). Glisser un fichier .xlsx/.csv → ouvre l'import.
6. Bouton « Photo » : sélecteur de fichier image → même chose.
7. En arrière-plan, l'extraction remplit la carte (photo, nom, prix). L'écran se met à jour en direct.

**Mobile** (mode édition) :

1. Barre collante en bas : « Coller un lien, écrire un nom », icône appareil photo, bouton +.
2. La toucher ouvre la feuille « Ajouter » : champ multiligne focalisé, boutons « Coller » (lit le presse-papiers si autorisé), « Photo » (appareil photo ou galerie), « Ajouter ».
3. Après « Ajouter », la feuille reste ouverte pour enchaîner. La liste « Ajoutés à l'instant » montre l'état de chaque ajout : en cours, trouvé (✓), rien trouvé (« Compléter »), sans lien.
4. « Trier les 4 maintenant » → tri rapide sur ces articles. « Fermer » → retour au mode édition.

### C4. Ranger avec le tri rapide

1. Depuis « À trier » → « Trier maintenant » (desktop) ou « Trier » (mobile) → `/l/<slug>/edition/trier`.
2. Un article à la fois, la pile suivante visible derrière. Progression « 3 sur 5 ».
3. Catégorie proposée présélectionnée si l'extraction en a trouvé une (badge « proposée d'après la page : Maison › Luminaires »).
4. Desktop : `1`–`9` catégorie, `N` nouvelle catégorie (champ en ligne), touches de la rangée du haut (`A Z E R T Y U I O P` sur AZERTY, `Q W E R…` sur QWERTY, voir `03-ecrans.md`) pour les tags, `C` coup de cœur, `Entrée` valider et suivant, `→` passer, `←` précédent, `Suppr` supprimer (annulable), `Échap` quitter. Le nom et le prix sont modifiables en ligne (les raccourcis sont inactifs tant qu'un champ a le focus).
5. Mobile : gros boutons de catégories et de tags, cœur, « Passer », « Valider ». Glisser la carte vers la gauche = passer, vers la droite = valider.
6. Valider = enregistre catégorie, tags, cœur, et `sorted_at = now()`. Passer = ne change rien, l'article reste à trier.
7. Après le dernier : retour au mode édition avec « 5 articles rangés ».

### C5. Modifier un article

- Desktop : clic sur « Modifier » au survol d'une carte, ou clic sur la carte en mode édition → panneau à droite (`/l/<slug>/edition/a/<ref>`). Enregistrement automatique à la sortie de chaque champ (« enregistré automatiquement »).
- Mobile : la carte ouvre la feuille « Modifier l'article » avec « Annuler » et « Enregistrer ».
- Champs : photo (changer : choisir parmi les photos trouvées sur la page, ou envoyer une image), nom, prix + devise, lien (bouton « Relire la page du lien »), catégorie (+ nouvelle), tags (+ nouveau), coup de cœur, note pour les visiteurs. « Supprimer l'article » en bas.

### C6. Actions groupées (desktop surtout)

- Survol d'une carte : case à cocher en haut à gauche. Maj+clic sélectionne une plage. `Échap` désélectionne.
- Barre flottante : « 2 sélectionnés », Catégorie ▾, Tags ▾ (ajoute/retire), Coup de cœur (bascule), Supprimer, ✕.
- Mobile : appui long sur une carte → mode sélection, même barre en bas.
- « Tout ranger dans… » (zone À trier) : donne une catégorie à tous les articles à trier et les sort de « À trier ».

### C7. Réordonner

- Desktop : poignée au survol à gauche de la carte, glisser-déposer dans la grille, y compris vers une autre section (change la catégorie). Les sections se réordonnent par leur poignée.
- Mobile : dans les réglages (catégories), et par « Déplacer » dans le menu ⋯ d'une carte (choix de la catégorie, puis « En premier » / « En dernier »).
- Clavier (accessibilité) : poignée focalisable, Espace pour saisir, flèches pour déplacer, Espace pour lâcher (comportement de `@dnd-kit`).

### C8. Importer un fichier Excel

1. Mode édition → « Importer » (desktop), ou Réglages → « Importer un fichier Excel » (mobile), ou glisser un fichier sur la page.
2. Étape 1 · Fichier : zone de dépôt, formats .xlsx .xls .csv .ods, 5 Mo max, 2 000 lignes max. Choix de la feuille si plusieurs.
3. Étape 2 · Colonnes : chaque colonne du fichier, 3 exemples, et le champ Envies qu'elle devient (devinée, modifiable). Aperçu des 3 premiers articles. Options : « La première ligne contient les titres », « Compléter depuis les liens », « Ranger directement ». Bouton « Importer 43 articles » (lignes − doublons − lignes vides).
4. Étape 3 · Vérifier : résultat (« 43 articles importés · 2 doublons ignorés · 2 catégories créées »), boutons « Voir les articles à trier » et « Trier maintenant ». Les infos des liens arrivent en arrière-plan.

Détails : `08-import-export.md`.

### C9. Réglages

`/l/<slug>/edition/reglages` : La liste (nom, prénom, adresse, petit mot, ambiance), Catégories, Tags, Accès (nouveau mot de passe, lien secret, régénérer, verrouiller cet appareil), Exporter, Supprimer la liste. Enregistrement automatique champ par champ, indicateur « Enregistré » en haut.

### C10. Terminer

« Terminer » quitte le mode édition vers la page visiteur (`/l/<slug>`), sans verrouiller. « Verrouiller cet appareil » (réglages) supprime le cookie.

## Comportements transverses

- **Temps réel** : en mode édition, un abonnement Supabase Realtime sur `items` (filtre `list_id`) met à jour les cartes quand l'extraction finit. Filet de sécurité : tant qu'au moins un article est `pending`, rafraîchir toutes les 3 s (au plus 2 minutes), et relancer l'extraction des articles `pending` depuis plus de 30 s (route `POST /api/lists/[id]/enrich`).
- **Hors ligne / erreur réseau** : les actions optimistes sont annulées et un message « Pas enregistré. Vérifiez la connexion. » propose « Réessayer ».
- **Retour navigateur** : ferme la fiche, le panneau ou la feuille ouverte avant de quitter la page.
- **Session expirée pendant l'édition** : toute action renvoie `EDIT_LOCKED` → la modale de déverrouillage s'ouvre, l'action est rejouée après succès.
