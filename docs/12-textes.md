# 12 · Textes de l'interface

Ton : sobre, direct, chaleureux sans effusion. Vouvoiement. Pas de point d'exclamation, pas d'emoji, pas de superlatif, pas de « Oups ». Une erreur = ce qui s'est passé + ce qu'on peut faire. Les variables sont entre `{}`.

Les nombres : `Intl.NumberFormat('fr-FR')`. Pluriels gérés (`1 article`, `2 articles`). Dates relatives : « à l'instant », « il y a 2 min », « il y a 3 h », « hier », « il y a 2 jours », puis « le 12 octobre ».

## Commun

| Clé | Texte |
|---|---|
| app.name | Envies |
| nav.allLists | Toutes les listes |
| action.share | Partager |
| action.edit | Modifier |
| action.done | Terminer |
| action.close | Fermer |
| action.cancel | Annuler |
| action.save | Enregistrer |
| action.copy | Copier |
| action.add | Ajouter |
| action.delete | Supprimer |
| action.retry | Réessayer |
| action.undo | Annuler |
| toast.linkCopied | Lien copié |
| toast.saved | Enregistré |
| toast.saving | Enregistrement… |
| error.network | Pas enregistré. Vérifiez la connexion. |
| error.generic | Quelque chose n'a pas marché. Réessayez. |
| error.locked | La modification s'est verrouillée. Saisissez le mot de passe pour continuer. |
| count.items | {n} article · {n} articles |
| count.favorites | {n} coup de cœur · {n} coups de cœur |
| price.total | {montant} au total · ≈ {montant} (s'il manque des prix) |
| list.byline | La liste de {prénom} |

## Accueil

| Clé | Texte |
|---|---|
| home.kicker | Listes d'envies |
| home.count | {n} listes |
| home.search.placeholder | Une liste, un prénom |
| home.sort.recent | Récentes |
| home.sort.alpha | A → Z |
| home.sort.size | Plus d'articles |
| home.new | Nouvelle liste |
| home.card.updated | {prénom} · modifiée {date relative} |
| home.empty | Aucune liste pour l'instant. |
| home.noResult | Aucune liste ne correspond. |

## Liste (visiteur)

| Clé | Texte |
|---|---|
| list.stats.items | articles |
| list.stats.favorites | coups de cœur |
| list.stats.total | au total |
| filter.all | Tout |
| filter.favorites | Coups de cœur |
| filter.tags | Tags |
| filter.order | Ordre de la liste |
| filter.order.recent | Plus récents |
| filter.order.priceAsc | Prix croissant |
| filter.order.priceDesc | Prix décroissant |
| filter.search.placeholder | Chercher dans la liste |
| filter.mobile.button | Filtres |
| filter.sheet.title | Filtres |
| filter.sheet.clear | Tout effacer |
| filter.sheet.onlyFavorites | Seulement les coups de cœur |
| filter.sheet.category | Catégorie |
| filter.sheet.order | Ordre |
| filter.sheet.apply | Voir {n} articles · Voir 1 article · Aucun article |
| list.uncategorized | Non classé |
| list.empty | Cette liste est encore vide. |
| list.noResult | Rien avec ces filtres. |
| list.footer.all | Toutes les listes |
| notFound.title | Introuvable |
| notFound.text | Cette liste n'existe pas, ou plus. |

## Fiche article

| Clé | Texte |
|---|---|
| item.position | {i} sur {n} |
| item.prev / item.next | Article précédent / Article suivant |
| item.copyLink | Copier le lien de l'article |
| item.favorite | Coup de cœur |
| item.priceChecked | relevé sur {domaine} le {date} |
| item.priceManual | prix indiqué par {prénom} |
| item.note | Note de {prénom} |
| item.visit | Voir sur {domaine} |
| item.readMore | Lire la suite |
| item.fetchFailed | Les infos n'ont pas pu être lues sur la page. |
| elsewhere.title | Trouver ailleurs |
| elsewhere.subtitle | même recherche, autres boutiques |
| elsewhere.subtitle.mobile | Même recherche, autres boutiques. Modifiez les mots si besoin. |
| elsewhere.query | Mots de la recherche |
| elsewhere.copy | Copier le nom |
| elsewhere.group.compare | Comparer · Comparer les prix (mobile) |
| elsewhere.group.new | Neuf |
| elsewhere.group.secondhand | Seconde main |
| elsewhere.disclaimer | Ces liens ouvrent une simple recherche dans un nouvel onglet. Rien n'est suivi ni rémunéré. |

## Nouvelle liste

| Clé | Texte |
|---|---|
| create.title | Nouvelle liste |
| create.intro | Pas de compte. Un nom, un mot de passe simple, et c'est parti. |
| create.name | Nom de la liste |
| create.name.placeholder | Noël 2026 |
| create.owner | Votre prénom |
| create.owner.hint | Affiché sous le titre : « La liste de {prénom} ». |
| create.password | Mot de passe pour modifier |
| create.password.hint | Simple, à donner à qui peut modifier. |
| create.description | Un petit mot (facultatif) |
| create.description.add | Ajouter un petit mot |
| create.ambiance | Ambiance |
| create.ambiance.feuillage / ciel / ambre | Feuillage / Ciel doré / Ambre |
| create.preview | Aperçu |
| create.submit | Créer la liste |
| create.note | Toutes les listes sont visibles depuis l'accueil. Le mot de passe protège seulement la modification. |
| create.error.name | Donnez un nom à la liste. |
| create.error.owner | Indiquez votre prénom. |
| create.error.password | 4 caractères au moins. |
| create.error.rate | Trop de listes créées d'un coup. Réessayez dans une heure. |
| created.title | C'est prêt. |
| created.text | « {titre} » est en ligne. Gardez ces deux liens quelque part. |
| created.publicLink | Lien à partager |
| created.publicLink.hint | Pour vos proches. Lecture seule. |
| created.secretLink | Lien secret de modification |
| created.secretLink.hint | Ouvre la modification sans mot de passe, sur n'importe quel appareil. À ne pas partager. Il reste visible dans les réglages. |
| created.start | Ajouter les premières envies |
| created.view | Voir la liste |

## Déverrouiller

| Clé | Texte |
|---|---|
| unlock.title | Modifier {titre} |
| unlock.text | Le mot de passe a été choisi à la création de la liste. |
| unlock.password | Mot de passe pour modifier |
| unlock.showPassword / hidePassword | Afficher le mot de passe / Masquer le mot de passe |
| unlock.remember | Rester déverrouillé sur cet appareil (30 jours) |
| unlock.submit | Déverrouiller |
| unlock.forgot | Oublié ? Ouvrez le lien secret de modification reçu à la création, ou demandez-le à la personne qui a créé la liste. |
| unlock.error.wrong | Ce n'est pas le bon mot de passe. |
| unlock.error.rate | Trop d'essais. Réessayez dans {n} minutes. |
| unlock.error.key | Ce lien de modification n'est plus valable. |

## Mode édition

| Clé | Texte |
|---|---|
| edit.badge | Mode édition |
| edit.import | Importer |
| edit.settings | Réglages |
| edit.summary | {n} articles · {m} à trier |
| add.placeholder | Collez un lien, ou écrivez un nom |
| add.placeholder.mobile | Coller un lien, écrire un nom |
| add.photo | Photo |
| add.hint.enter | ajoute et vide le champ |
| add.hint.paste | plusieurs liens collés : un article par ligne |
| add.hint.drop | glissez une image ou un fichier Excel n'importe où |
| add.inCategory | dans {catégorie} |
| add.done | {n} articles ajoutés · Article ajouté |
| add.duplicate | Déjà dans la liste |
| add.rate | Beaucoup d'ajouts d'un coup. Réessayez dans quelques minutes. |
| add.sheet.title | Ajouter |
| add.sheet.placeholder | Un lien ou un nom par ligne |
| add.sheet.paste | Coller |
| add.sheet.hint | Ajoutez en rafale : la fiche se complète toute seule (photo, prix, description). Vous rangerez plus tard. |
| add.sheet.recent | Ajoutés à l'instant |
| add.sheet.status.pending | Récupération des infos… |
| add.sheet.status.failed | Rien trouvé sur la page |
| add.sheet.status.noLink | Sans lien |
| add.sheet.complete | Compléter |
| add.sheet.sortNow | Trier les {n} maintenant |
| inbox.title | À trier |
| inbox.text | {n} nouveaux, pas encore rangés. |
| inbox.sortAllInto | Tout ranger dans… |
| inbox.sortNow | Trier maintenant · Trier (mobile) |
| inbox.seeAll | Voir les {n} |
| inbox.card.pending | Récupération… |
| inbox.card.noPhoto | Pas de photo trouvée |
| inbox.card.failed | Rien trouvé · compléter |
| inbox.card.noPrice | prix inconnu |
| inbox.card.noLink | sans lien |
| inbox.live.found | {nom} trouvé |
| section.rename | Renommer la catégorie |
| section.addHere | Ajouter ici |
| card.edit | Modifier |
| card.move | Déplacer |
| card.select | Sélectionner |
| card.actions | Actions |
| card.favorite.add / remove | Ajouter aux coups de cœur / Retirer des coups de cœur |
| selection.count | {n} sélectionnés · 1 sélectionné |
| selection.category | Catégorie |
| selection.tags | Tags |
| selection.favorite | Coup de cœur |
| selection.clear | Annuler la sélection |
| toast.deleted | Article supprimé · {n} articles supprimés |
| toast.sorted | {n} articles rangés |
| toast.restoreConflict | Un article avec ce lien existe déjà. |
| edit.empty.title | Collez un premier lien, ou écrivez un nom. |
| edit.empty.text | La photo, la description et le prix arrivent tout seuls. |
| edit.empty.import | Importer un fichier Excel |

## Modifier un article

| Clé | Texte |
|---|---|
| itemEdit.title | Modifier l'article |
| itemEdit.autosave | enregistré automatiquement |
| itemEdit.changePhoto | Changer la photo |
| itemEdit.photo.file / camera / remove | Choisir un fichier / Prendre une photo / Retirer la photo |
| itemEdit.candidates | Trouvées sur la page |
| itemEdit.name | Nom |
| itemEdit.price | Prix |
| itemEdit.link | Lien |
| itemEdit.refetch | Relire la page du lien |
| itemEdit.refetch.updated | Prix mis à jour : {nouveau} (avant {ancien}) |
| itemEdit.refetch.nothing | Rien de nouveau sur la page. |
| itemEdit.category | Catégorie |
| itemEdit.category.new | Nouvelle |
| itemEdit.tags | Tags |
| itemEdit.tags.new | Nouveau tag |
| itemEdit.favorite | Coup de cœur |
| itemEdit.note | Note pour les visiteurs |
| itemEdit.delete | Supprimer l'article |
| itemEdit.discard.title | Abandonner les modifications ? |
| itemEdit.discard.yes / no | Abandonner / Continuer |

## Tri rapide

| Clé | Texte |
|---|---|
| sort.title | Tri rapide |
| sort.kicker | {titre} · à trier |
| sort.progress | {i} sur {n} |
| sort.quit | Quitter |
| sort.added | ajouté {date relative} |
| sort.suggested | proposée d'après la page : {fil d'Ariane} |
| sort.category | Catégorie · Ranger dans (mobile) |
| sort.newCategory | Nouvelle catégorie… |
| sort.skip | Passer |
| sort.validate | Valider et suivant · Valider (mobile) |
| sort.swipeHint | glisser pour passer |
| sort.legend | précédent · passer · valider et suivant · catégorie · tags · coup de cœur · supprimer · quitter |
| sort.empty | Rien à trier. |

## Import

| Clé | Texte |
|---|---|
| import.title | Importer un fichier |
| import.formats | Excel, CSV ou Numbers exporté |
| import.step.file / columns / check | Fichier / Colonnes / Vérifier |
| import.drop | Déposez un fichier ici, ou choisissez-le |
| import.drop.formats | .xlsx, .xls, .csv, .ods · 5 Mo max |
| import.drop.button | Choisir un fichier |
| import.file.meta | {n} lignes · {m} colonnes |
| import.file.sheet | Feuille « {nom} » |
| import.file.change | Changer |
| import.columns.title | Les colonnes |
| import.columns.text | Les correspondances sont devinées d'après les titres. Changez celles qui ne vont pas. |
| import.columns.head.source / samples / target | Colonne du fichier / Exemples / Devient |
| import.target.* | Nom · Lien · Prix · Catégorie · Tags · Coup de cœur · Note · Photo (lien d'image) · Ne pas importer |
| import.guessed | deviné |
| import.help.newCategories | {n} nouvelles : {noms} |
| import.help.favorite | oui, x, 1, ✓ comptent comme oui |
| import.help.tags | séparés par des virgules |
| import.preview.title | Aperçu |
| import.preview.count | 3 premières lignes |
| import.preview.photoLater | photo à venir |
| import.option.header | La première ligne contient les titres |
| import.option.enrich | Compléter depuis les liens |
| import.option.enrich.hint | Photo, description et prix manquant, en arrière-plan. |
| import.option.sorted | Ranger directement |
| import.option.sorted.hint | Sinon, tout arrive dans « À trier ». |
| import.duplicates | {n} lignes ont un lien déjà présent dans la liste : elles seront ignorées. |
| import.submit | Importer {n} articles |
| import.back | Retour |
| import.math | {lignes} lignes − {d} doublons |
| import.progress | Import… {i} / {n} |
| import.done.title | {n} articles importés |
| import.done.details | {d} doublons ignorés · {v} lignes vides ignorées · {c} catégories créées : {noms} · {t} tags créés |
| import.done.enrich | Les photos et les prix arrivent depuis les liens, en arrière-plan. |
| import.done.inbox | Voir les articles à trier |
| import.error.format | Ce format n'est pas lu. Utilisez .xlsx, .xls, .csv ou .ods. |
| import.error.size | Fichier trop lourd (5 Mo max). |
| import.error.rows | Plus de 2 000 lignes : découpez le fichier. |
| import.error.empty | Ce fichier est vide. |
| import.error.noTarget | Choisissez au moins une colonne Nom ou Lien. |

## Réglages

| Clé | Texte |
|---|---|
| settings.title | Réglages de {titre} |
| settings.back | Retour à la liste |
| settings.nav.* | La liste · Catégories · Tags · Accès · Exporter · Supprimer |
| settings.list.slug | Adresse |
| settings.list.slug.changed | Les anciens liens redirigeront vers la nouvelle adresse. |
| settings.list.slug.taken | Cette adresse est déjà prise. |
| settings.categories.text | Glissez pour changer l'ordre d'affichage. Supprimer une catégorie remet ses articles dans « Non classé ». |
| settings.categories.new | Nouvelle catégorie |
| settings.categories.deleted | Catégorie supprimée |
| settings.tags.text | Priorité, avis, taille, ce que vous voulez. La couleur sert de repère sur les cartes. |
| settings.tags.new | Nouveau tag : avis, priorité, taille… |
| settings.tags.color | Couleur du tag |
| settings.tags.deleted | Tag supprimé |
| settings.access.text | Pas de compte : le mot de passe et le lien secret sont les deux clés de la modification. |
| settings.access.newPassword | Nouveau mot de passe |
| settings.access.newPassword.placeholder | Laissez vide pour garder l'actuel |
| settings.access.change | Changer |
| settings.access.changed | Mot de passe changé. Les autres appareils devront le saisir. |
| settings.access.secret.hint | Ouvre la modification sans mot de passe. Si vous pensez qu'il a circulé, régénérez-le : l'ancien ne marchera plus. |
| settings.access.regenerate | Régénérer le lien secret |
| settings.access.regenerate.confirm | L'ancien lien ne marchera plus. Régénérer ? · Oui · Non |
| settings.access.lock | Verrouiller cet appareil |
| settings.export.button | Télécharger en Excel |
| settings.export.text | Mêmes colonnes que l'import : vous pouvez le modifier puis le réimporter. |
| settings.delete.title | Supprimer la liste |
| settings.delete.text | Les {n} articles et leurs photos seront effacés. Impossible de revenir en arrière. |
| settings.delete.confirm | Tapez « {titre} » pour confirmer |
| settings.delete.done | Liste supprimée. |
| settings.import | Importer un fichier Excel |

## Cible de partage (jalon 8)

| Clé | Texte |
|---|---|
| share.title | Ajouter à une liste |
| share.choose | Dans quelle liste ? |
| share.none | Ouvrez d'abord une de vos listes en mode édition sur ce téléphone. |
| share.added | Ajouté à {titre} |
