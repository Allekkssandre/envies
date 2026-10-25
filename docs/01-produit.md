# 01 · Produit

## En une phrase

Un catalogue de listes d'envies, ouvert à tous en lecture, où l'on ajoute un article en une seconde et où on le range quand on a le temps.

## Pour qui

- **Merin**, qui tient sa liste (anniversaire, Noël, maison…) et veut la partager.
- **Quelques amis**, qui créent la leur sur le même site.
- **Les proches**, qui consultent une liste pour offrir quelque chose. Ils arrivent souvent par un lien reçu sur une messagerie, sur téléphone.

C'est un site personnel, pas un produit. Volume attendu : quelques dizaines de listes, quelques centaines à quelques milliers d'articles. Pas besoin de passer à l'échelle, mais il faut que ce soit rapide et fiable.

## Principes

1. **Ajouter d'abord, ranger ensuite.** Le champ d'ajout accepte un lien ou un nom, ou plusieurs lignes d'un coup. Un article ajouté arrive dans « À trier ». Le tri rapide permet de le ranger plus tard, au clavier ou au pouce.
2. **Pas de compte, pas d'admin.** Une liste = un mot de passe simple + un lien secret. Personne ne gère les autres listes.
3. **Tout est public en lecture.** L'accueil montre toutes les listes. Pas de liste privée (hors périmètre).
4. **Zéro IA.** Le remplissage automatique lit les métadonnées standard de la page (JSON-LD, OpenGraph, microdonnées). La catégorie proposée vient du fil d'Ariane de la page.
5. **Sobre.** Textes courts, sans marketing. L'interface s'efface derrière les photos des articles.
6. **Beau et profond.** Direction « chiné, organique, boisé » : flou de feuillage, ciel doré, ambre, verre dépoli, grain fin. Voir `04-design-system.md`.
7. **Mobile d'abord pour la lecture et l'ajout**, desktop confortable pour le tri et l'import.

## Périmètre

### Dans le périmètre (v1)

- Accueil : toutes les listes, recherche par nom de liste ou prénom, tri (récentes, A→Z, plus d'articles).
- Page liste : héros d'ambiance, filtres (catégorie, tags, coups de cœur, ordre, recherche), sections par catégorie, cartes d'articles.
- Fiche article : photo, nom, prix, boutique, note, bouton vers la boutique, « Trouver ailleurs » (9 recherches externes).
- Partage : lien de la liste (Web Share API, sinon copie), lien direct vers un article.
- Création de liste : nom, prénom, petit mot (facultatif), ambiance, mot de passe.
- Lien secret de modification, affiché à la création et dans les réglages.
- Déverrouillage par mot de passe (cookie 30 jours ou session), verrouillage manuel.
- Mode édition : barre d'ajout rapide (lien, nom, plusieurs lignes, photo), zone « À trier », coup de cœur, modification, déplacement, suppression avec annulation, sélection multiple, glisser-déposer pour l'ordre.
- Remplissage automatique depuis un lien : photo (plusieurs candidates), nom, description, prix, devise, boutique, catégorie proposée. Relecture à la demande.
- Article sans lien (« Un bon pour un massage ») avec photo facultative envoyée depuis l'appareil.
- Tri rapide : un article à la fois, raccourcis clavier sur desktop, gros boutons sur mobile.
- Import Excel / CSV / ODS avec correspondance des colonnes devinée et modifiable, aperçu, doublons ignorés.
- Export Excel réimportable.
- Réglages : infos de la liste, adresse (slug), ambiance, catégories (renommer, ordonner, supprimer), tags (renommer, couleur, supprimer), mot de passe, lien secret (copier, régénérer), verrouiller l'appareil, suppression de la liste.

### Hors périmètre (v1)

- Réservation ou marquage « déjà offert » par les visiteurs (idée v2, voir plus bas).
- Comptes, connexion, notifications, e-mails.
- Listes privées ou protégées en lecture.
- Suivi de prix automatique (le prix est relevé à l'ajout et lors d'une relecture manuelle).
- Affiliation, publicité, analytics marketing. Les liens externes ne sont pas suivis.
- Multilingue. L'interface est en français.

### Pistes v2 (ne pas coder, mais ne pas fermer la porte)

- « Je m'en occupe » : un visiteur réserve un article de façon anonyme, invisible pour le propriétaire s'il le souhaite. Prévoir qu'un article puisse avoir un état de réservation plus tard (pas de colonne en v1).
- Cible de partage PWA (partager une page depuis le téléphone vers Envies). Elle fait partie du jalon de finitions, en option.

## Vocabulaire

| Terme | Sens |
|---|---|
| Liste | Un ensemble d'articles, avec un titre, un prénom (le propriétaire), un petit mot, une ambiance. |
| Article | Une envie : nom, lien facultatif, photo, prix, note, catégorie, tags, coup de cœur. |
| Catégorie | Un rangement exclusif (un article a 0 ou 1 catégorie). Ordonnées à la main. Sans catégorie = « Non classé ». |
| Tag | Une étiquette libre et multiple (priorité, avis, taille…), avec une couleur parmi 8. |
| Coup de cœur | Un marqueur booléen, mis en avant (cœur rouille). |
| À trier | Articles ajoutés mais pas encore validés par le propriétaire (`sorted_at` vide). Visibles des visiteurs comme les autres. |
| Ambiance | Le décor de la liste : `feuillage` (défaut), `ciel` (ciel doré), `ambre`. |
| Lien secret | URL qui ouvre l'édition sans mot de passe : `/l/<slug>/edition#cle=XXXX-XXXX-XXXX`. |
| Mode édition | La page liste avec les outils du propriétaire, après déverrouillage. |
| Relecture | Relancer l'extraction des infos depuis le lien de l'article. |

## Règles métier

### Listes

- Titre : 1 à 80 caractères. Prénom : 1 à 40. Petit mot : 0 à 500.
- Le titre s'affiche avec la règle typographique : premier mot en romain, la suite en italique (« Mes *30 ans* »). Un titre d'un seul mot est en italique entier sur l'accueil (« *Envies* ») et en romain dans une liste.
- Slug : dérivé du titre (minuscules, sans accents, tirets), unique. En cas de collision : `-2`, `-3`… Modifiable dans les réglages. L'ancien slug redirige (table `list_redirects`).
- Mot de passe : 4 caractères minimum, pas d'autre règle (c'est voulu). Stocké haché (scrypt).
- Lien secret : 12 caractères tirés d'un alphabet sans ambiguïté (chiffres 2–9 et majuscules sans I, L, O), groupés par 4 : `XXXX-XXXX-XXXX`. Régénérable. Régénérer ou changer le mot de passe déconnecte les autres appareils.
- Supprimer une liste : confirmation en tapant le titre exact. Suppression douce, purge après 30 jours.

### Articles

- Il faut au moins un nom **ou** un lien.
- Si on colle un lien seul, le nom affiché est le domaine tant que l'extraction n'a pas fini.
- Un même lien (normalisé, voir `07-extraction-liens.md`) ne peut être présent qu'une fois par liste. Ajouter un doublon affiche « Déjà dans la liste » et met l'article existant en évidence.
- Prix facultatif, en centimes, devise ISO (EUR par défaut, celle de la liste). Le total affiché d'une liste additionne les prix dans la devise de la liste et ignore les autres.
- Le remplissage automatique ne remplace jamais un champ saisi à la main. La relecture met à jour le prix et les photos candidates, et ne remplit les autres champs que s'ils sont vides.
- Suppression douce, annulable 8 s, purge après 30 jours avec les images.
- Un article quitte « À trier » quand on le valide dans le tri rapide, quand on lui donne une catégorie (n'importe où), ou via « Tout ranger dans… ». Modifier seulement un tag ou le cœur ne le sort pas de « À trier ».

### Catégories et tags

- Noms uniques par liste, insensibles à la casse et aux accents. Catégorie : 1 à 40 caractères. Tag : 1 à 30.
- Supprimer une catégorie remet ses articles dans « Non classé » (sans les remettre dans « À trier »).
- Supprimer un tag le retire des articles.
- « Non classé » n'est pas une catégorie en base : c'est `category_id IS NULL`. Toujours affiché en dernier, seulement s'il contient des articles.
- Couleurs de tag : `rouille`, `ocre`, `miel`, `olive`, `sauge`, `ardoise`, `prune`, `sable`. Un nouveau tag prend la première couleur pas encore utilisée.

### Filtres visiteurs

- Catégorie : une seule à la fois (ou « Tout »).
- Tags : plusieurs possibles, logique **OU** entre tags.
- Coups de cœur : interrupteur.
- Les groupes se combinent en **ET** (catégorie ET un des tags ET coup de cœur).
- Ordre : « Ordre de la liste » (manuel), « Plus récents », « Prix croissant », « Prix décroissant » (les articles sans prix à la fin).
- Recherche : dans le nom, la note, la boutique, insensible aux accents.
- L'état des filtres est dans l'URL (`?c=…&t=…&fav=1&o=prix-asc&q=…`) pour pouvoir partager une vue.
