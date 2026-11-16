# 13 — Secret Santa

Sous-section du site, sous `/lutins`. Une personne organise un tirage au sort entre des participants. Chacun reçoit par mail un lien personnel qui lui dit à qui il offre un cadeau, et avec quel thème. Personne d'autre ne le sait, l'organisation non plus.

## Routes

| Route | Contenu |
|---|---|
| `/lutins` | Présentation en 4 étapes, création (nom + mot de passe de l'organisation). |
| `/lutins/[slug]` | Organisation. Verrouillée : mot de passe ou lien secret `#cle=…`. Préparation, puis suivi. |
| `/lutins/moi/[token]` | Page d'un lutin, ouverte par son lien personnel. Jamais indexée, `Referrer-Policy: no-referrer`. |

L'adresse de l'organisation finit par 6 caractères aléatoires : elle ne se devine pas.

## Parcours

1. **Création.** Nom et mot de passe (4 caractères au moins). Un cookie signé garde l'accès 30 jours. La page montre un lien secret qui ouvre l'organisation sans mot de passe.
2. **Préparation.** Informations facultatives (budget, date de l'échange, petit mot), thèmes (un par ligne), participants (prénom, nom, adresse mail). Tout est modifiable tant que le tirage n'est pas lancé. « Enregistrer » envoie tout d'un coup.
3. **Lancement.** Possible avec au moins 3 participants, au moins autant de thèmes différents que de participants, des adresses toutes différentes, et un envoi de mails configuré. Une confirmation est demandée (des mails partent : action vers l'extérieur, écart assumé avec la règle « seule la suppression d'une liste demande une confirmation »). Le tirage est fait, vérifié, enregistré d'un bloc, puis un mail part pour chaque participant.
4. **Suivi.** Pour chacun : mail envoyé (ou non parti), lien ouvert, a confirmé. « Renvoyer le lien » et « Corriger l'adresse » créent un nouveau lien ; l'ancien ne vaut plus ; le tirage ne change pas. Les informations restent modifiables. Les thèmes et les participants, non.
5. **Lutin.** Sa page montre la personne à qui il offre (prénom, nom), son thème, le budget, la date et le petit mot. « J'ai bien noté » est la seule chose que l'organisation voit de cette page. Il voit la fiche de la personne tirée et, si elle existe, peut ouvrir sa liste d'idées. Il remplit sa propre fiche et crée sa liste d'idées.
6. **Tout annuler.** Les liens envoyés ne valent plus, le Secret Santa redevient modifiable ; un nouveau lancement envoie de nouveaux mails à tous. **Supprimer** : il faut retaper le nom ; tout disparaît, listes d'idées comprises.

## Tirage

`src/lib/santa/draw.ts`, pur et testé.

- Les participants sont mélangés (Fisher-Yates, hasard cryptographique `crypto.randomInt`). Le mélange recommence tant que quelqu'un se tire lui-même. Tous les tirages valides ont la même probabilité. Aucune exclusion : aléatoire complet.
- Les thèmes sont mélangés de la même façon ; les n premiers vont aux n participants. S'il y a plus de thèmes que de participants, les autres ne servent pas.
- `checkDraw` vérifie toutes les règles avant tout enregistrement : chacun offre une fois et reçoit une fois, personne ne se tire soi-même, chaque thème est donné une fois au plus, tout le monde a un tirage.
- L'enregistrement passe par la fonction `santa_launch` : verrou sur le Secret Santa, statut « préparation » exigé, une ligne par participant, tout ou rien.
- À chaque affichage de l'organisation, le serveur déchiffre tous les tirages et relance `checkDraw`. La page affiche « Tirage vérifié » sans rien en révéler, ou « Tirage à refaire ».
- Tests : 20 000 tirages de 3 à 30 personnes vérifiés un par un ; équiprobabilité contrôlée (3 personnes : 2 tirages possibles, 4 personnes : 9) ; hasard défaillant → aucun tirage enregistré.

## Secret

- Le tirage de chaque participant (`{ receiverId, themeId }`) est chiffré en AES-256-GCM avec `SANTA_SECRET_KEY`, lié au participant et au Secret Santa (données associées). La base ne le contient jamais en clair.
- Le lien personnel (192 bits aléatoires) n'est gardé qu'en empreinte SHA-256. Le mail ne contient que ce lien.
- Aucune action, aucune page de l'organisation ne renvoie un tirage. Seule la page d'un lutin déchiffre le sien.
- Limite connue (option A, choisie) : une personne qui aurait à la fois la base et la clé du serveur pourrait déchiffrer. En échange, un lien perdu peut être renvoyé sans refaire le tirage.
- Tables `santas`, `santa_secrets`, `santa_themes`, `santa_participants` : RLS activée sans politique, droits retirés à `anon` : rien n'est lisible avec la clé publique.

## Fiche et liste d'idées

- Fiche : âge, pointure, taille de vêtements, goûts et envies (texte libre). Tout facultatif.
- Liste d'idées : une liste ordinaire du site (ajout par lien, prix, photo…), privée et masquée de l'accueil (`lists.hidden`). Créée au premier clic, ouverte en modification par le lien personnel (cookie d'édition), sans mot de passe à retenir.
- Seul le Santa de la personne voit sa fiche et ouvre sa liste (cookie de lecture posé depuis sa page de lutin).

## Mails

`src/server/santa/mail.ts`. Par défaut, une **boîte Gmail** dédiée, en SMTP avec un mot de passe d'application (`GMAIL_USER`, `GMAIL_APP_PASSWORD`, 500 mails par jour) : un vrai compte Gmail écrivant à des proches arrive bien mieux en boîte de réception. Sinon, API transactionnelle de **Brevo** (plan gratuit, 300 mails par jour), sans nom de domaine : Brevo remplace l'adresse d'expéditeur Gmail par une adresse à lui, le nom affiché reste « Secret Santa · Envies ». Risque de dossier « indésirables » : l'organisation voit qui a ouvert son lien.

Variables : `BREVO_API_KEY`, `SANTA_MAIL_FROM` (adresse validée chez Brevo), facultatives `SANTA_MAIL_FROM_NAME`, `SANTA_MAIL_REPLY_TO`. Local et tests : `SANTA_MAIL_DIR`, chaque mail écrit en JSON (ignoré sur Vercel). Sans configuration, « Lancer le tirage » reste désactivé avec « L'envoi des mails n'est pas configuré. »

Contenu : objet « Secret Santa : {nom} » ; « Bonjour {prénom}, le tirage au sort est fait. Découvrez à qui vous offrez un cadeau, et votre thème. » ; bouton « Découvrir mon tirage » ; petit mot, budget, date ; « Ce lien est personnel. Ne le transférez pas. »

## Textes

| Clé | Texte |
|---|---|
| home.santa | Secret Santa |
| santa.create.title / password | Nom du Secret Santa · Mot de passe de l'organisation |
| santa.create.hint | Il ouvre la page d'organisation. Elle ne montre jamais qui a tiré qui. |
| santa.create.submit | Créer le Secret Santa |
| santa.unlock | Saisissez le mot de passe de l'organisation. · Déverrouiller |
| santa.info | Les informations · Budget (facultatif) · Date de l'échange (facultatif) · Petit mot (facultatif) |
| santa.themes | Les thèmes · Un thème par ligne. Chaque participant en reçoit un différent ; il en faut au moins autant que de participants. |
| santa.people | Les participants · Prénom · Nom · Adresse mail · Ajouter un participant |
| santa.problems | Il faut au moins 3 participants. · Il manque {n} thème(s) : il en faut un différent par participant. · Deux participants ont la même adresse mail. · Chaque participant a besoin d'un prénom et d'une adresse mail valable. · L'envoi des mails n'est pas encore configuré. |
| santa.launch | Lancer le tirage · Lancer le tirage ? · Lancer et envoyer les mails |
| santa.launched | Tirage lancé. {n} mails envoyés. |
| santa.check.ok | Tirage vérifié · {n} participants : chacun offre à une seule personne, différente de lui-même, et reçoit un thème que personne d'autre n'a. Le contrôle ne révèle rien du tirage. |
| santa.check.bad | Tirage à refaire · {raison} Annulez et relancez le tirage. |
| santa.status | Mail envoyé · Mail non parti · Lien ouvert · A confirmé · {c} sur {n} ont confirmé avoir vu leur tirage. |
| santa.resend | Renvoyer le lien · Corriger l'adresse · Envoyer un nouveau lien · Nouveau lien envoyé à {prénom}. |
| santa.cancel | Tout annuler · Tirage annulé. Les liens envoyés ne valent plus. |
| santa.delete | Supprimer le Secret Santa · Tapez « {nom} » pour confirmer. |
| lutin.reveal | Bonjour {prénom}, vous offrez un cadeau à · Votre thème · Budget · Échange des cadeaux |
| lutin.confirm | J'ai bien noté · C'est noté. Gardez le secret. |
| lutin.target | Ce que {prénom} a indiqué · Voir sa liste d'idées · {prénom} n'a pas encore fait sa liste d'idées. · {prénom} n'a encore rien indiqué. |
| lutin.me | Ma fiche, pour mon Santa · Seule la personne qui vous a tiré la verra. Tout est facultatif. · Âge · Pointure · Taille de vêtements · Goûts et envies · Enregistrer ma fiche · Créer ma liste d'idées · Modifier ma liste d'idées |
| lutin.expired | Ce lien n'est plus valable. · Le tirage a peut-être été refait, ou un nouveau lien vous a été envoyé. |

Pas de maquette pour cette section : elle reprend les matières du site (fond ambre texturé, panneau papier, grain fin), la typographie et les composants existants, en version mobile et desktop.
