# 14. La Magie de Noël

Jeu à rôles cachés, en parallèle d'un Secret Santa. Version simple : une seule action possible, facultative, et un jeu qui va au bout même si personne ne joue.

## Principes

- **Il marche sans tout le monde.** Rien n'attend personne. Les semaines se résolvent seules, à l'heure dite.
- **Une action par semaine, au plus** : désigner un suspect. Un clic, modifiable, facultatif.
- **Les manigances sont possibles, pas nécessaires.** Lire la gazette et cliquer suffit pour jouer pleinement.
- **Fun immédiat** : la carte de rôle se retourne dès la première visite, et le premier indice est déjà là.

## Règles

1. **Rôles.** À l'ouverture du jeu, environ un joueur sur quatre est tiré au sort Krampus (`floor((n + 2) / 4)`, au moins 1). Les autres sont Pères Noël. Les Krampus voient qui sont les autres Krampus. De 5 à 30 joueurs.
2. **Cinq semaines.** La durée d'une « semaine » est réglable de 1 à 14 jours (7 par défaut).
3. **Désignation.** Chaque semaine, chacun peut désigner une personne encore en jeu, sauf soi-même. Un Krampus démasqué ne désigne plus. Un Père Noël démasqué continue.
4. **Fin de semaine, dans l'ordre :**
   - la personne la plus désignée est démasquée, si elle a au moins `max(2, nombre de Krampus)` voix et qu'il n'y a pas d'égalité ;
   - Krampus démasqué : Magie +2, sans dépasser le niveau de départ, et il ne nuit plus ;
   - Père Noël démasqué : Magie −1 ;
   - chaque Krampus encore caché retire 1 de Magie.
5. **Fin de partie.**
   - Magie à 0 : les Krampus gagnent.
   - Tous les Krampus démasqués : les Pères Noël gagnent, sans attendre.
   - Magie au-dessus de 0 après la semaine 5 : les Pères Noël gagnent.
6. **Révélation.** L'organisation révèle les rôles quand la partie est finie. Le tableau montre chaque rôle, la semaine où chaque masque est tombé, et le **flair** de chacun : le nombre de fois où il a désigné un Krampus encore caché. Le meilleur flair est signalé.

## Comment on déduit

- **Les indices de la gazette**, sur un Krampus encore caché, de plus en plus précis :
  - semaine 1 : une lettre que contient le prénom (« contient la lettre R ») ;
  - semaine 2 : la longueur du prénom, en seuil (« 5 lettres ou moins », « 6 lettres ou plus ») ;
  - ces deux indices sont choisis pour laisser suspects environ la moitié des joueurs en jeu (`CLUE_SHARE`) : une initiale ou une longueur rare ne désigne jamais quelqu'un à elle seule. Les faux indices de la Fausse piste suivent la même règle. Les anciens indices (nombre exact de lettres, première lettre A à L ou M à Z) restent lisibles dans les gazettes déjà publiées ;
  - semaine 3 : deux innocents ;
  - semaines 4 et 5 : un trio qui cache un Krampus.
- **Qui a désigné qui** : publié dans la gazette après chaque semaine. On peut repérer ceux qui votent ensemble ou qui protègent quelqu'un.
- **Le secret personnel.** À la fin de la semaine 2, chaque Père Noël reçoit en privé le nom d'un autre Père Noël, de préférence encore en jeu. Les Krampus ne reçoivent rien, mais peuvent prétendre le contraire.
- **Les masques tombés** : un Père Noël démasqué est innocenté pour de bon.

Les joueurs peuvent en parler entre eux comme ils veulent. Tout le monde peut mentir.

## Le facultatif

Pour ceux qui veulent pousser le jeu. Rien de tout cela ne change le score : ni la Magie, ni le seuil, ni le sabotage.

- **Le pouvoir** (« atout » dans le code), un par joueur, à jouer une seule fois dans la partie, pendant une semaine en cours.
  - Père Noël, **la Loupe** : il choisit deux joueurs encore en jeu et apprend aussitôt, en secret, si au moins l'un des deux est un Krampus.
  - Krampus, au choix :
    - **la Fausse piste** : l'indice de la gazette de fin de semaine est remplacé par un faux, choisi parmi trois propositions toujours fausses (`fakeClueOptions`, du même genre que le vrai indice quand c'est possible). Une seule par semaine pour tous les Krampus. Impossible la dernière semaine, qui n'a pas d'indice suivant.
    - **l'Alibi** : pendant la semaine où il est joué et la suivante (`ALIBI_WEEKS`, sans dépasser la dernière semaine), toute Loupe dirigée vers lui répond « rien de suspect ». Durée limitée pour que le moment compte : joué en semaine 1, il ne protège plus ensuite.
  - Un Krampus dont le rôle est révélé ne peut plus jouer son pouvoir. Un Père Noël révélé garde sa Loupe.
  - La gazette d'ouverture et les règles préviennent que les indices peuvent être truqués.
- **Le carnet d'enquête** : chaque joueur marque les autres « suspect », « innocent » ou rien. Les notes sont privées et gardées en base, donc retrouvées sur tous les appareils. Elles apparaissent aussi sur les boutons de désignation.

Tables :
- `magic_atouts`, avec le contenu chiffré, car la nature de l'atout trahirait le rôle ;
- `magic_letters` : reste de l'ancien courrier des lecteurs, retiré du jeu (2026-11-16), plus lu ni écrit ;
- `magic_notes`.

## Points personnels et classement

À côté de la Magie, commune à tous, chacun marque des points pour lui. Ils ne changent rien à la Magie ni à la victoire d'un camp. `playerPoints` dans `engine.ts`, semaine par semaine, sur les semaines résolues :

| Rôle       | Ce qui compte                                                              | Points |
| ---------- | -------------------------------------------------------------------------- | ------ |
| Père Noël  | Bon flair : désigner un Krampus encore caché                               | +2     |
| Père Noël  | Krampus démasqué : ce Krampus est démasqué cette semaine-là                | +1     |
| Père Noël  | Erreur sur la personne : la personne désignée est démasquée, Père Noël     | −1     |
| Krampus    | Camouflage : une semaine traversée sans être démasqué                      | +2     |
| Krampus    | Manigance réussie : désigner un Père Noël qui est démasqué                 | +2     |
| Krampus    | Démasqué : la semaine où il est démasqué                                   | −2     |

- **Pendant la partie**, chacun voit ses propres points, ligne par ligne, sur la page du jeu (« Vos points »). Un Père Noël ne voit pas encore le flair porté sur un joueur dont le rôle est caché : il lui dirait qui est Krampus. Ces points apparaissent à la révélation, et la page le dit.
- **À la révélation**, le classement général remplace l'ancien tableau du flair : rang, rôle, détail (« 2 bons flairs, 1 Krampus démasqué »), total. Le mail de révélation donne le podium. Ex aequo : même rang.
- `magic_games.reveal` garde `points` et `detail` pour chaque joueur, à côté de `flair`.

## Ouverture avec le tirage

L'organisation peut cocher « Jouer aussi à La Magie de Noël » pendant la préparation, avec le début de la partie, la durée d'une manche et l'équilibre. Les réglages sont gardés dans `santas.magic_plan`. Au lancement du tirage :
- le jeu s'ouvre aussitôt après le tirage (`createMagic` avec `silent`), sans mail d'ouverture à part ;
- chaque participant reçoit **un seul mail** : son lien de tirage, puis un encadré de nuit qui présente le jeu, le premier indice et le bouton « Découvrir mon rôle » (« Secret Santa et Magie de Noël : … ») ;
- si le jeu ne peut pas s'ouvrir, le tirage part quand même, et l'organisation l'ouvre ensuite depuis le suivi (mail à part).

On ne peut pas lancer si le jeu est coché sans date, avec une date passée, ou hors de 5 à 30 participants (`magicPlanProblems`). « Renvoyer le lien » présente aussi le jeu tant qu'il est en cours. Le jeu peut toujours s'ouvrir après le lancement, comme avant.

## Accès depuis la page du tirage

En tête de la page du tirage de chaque participant, un bandeau de nuit dit où en est le jeu et y mène d'un clic : « Votre rôle vous attend », « À vous de désigner un suspect » (avec la date limite), « Votre suspect est désigné », « Les masques sont tombés ». Il montre aussi la jauge de Magie. Côté organisation, le suivi du jeu passe juste après le contrôle du tirage.

## Équilibre

Magie de départ par taille de groupe, dans `engine.ts` (`BALANCED`). Elle est calculée par simulation pour qu'à participation de 60 %, chaque camp gagne environ une fois sur deux. Le modèle de la simulation :
- chaque joueur désigne avec une probabilité donnée ;
- un Père Noël vise un Krampus dans 30 % des cas en semaine 1, puis de plus en plus souvent jusqu'à 65 % en semaine 5 ;
- les Krampus accusent ensemble un innocent.

Elle ne dépasse jamais `Krampus × 5`, pour que les Krampus puissent toujours gagner par le seul sabotage. Si personne ne joue, les Krampus gagnent : c'est voulu.

| Joueurs | Krampus | Seuil | Magie de départ |
| ------- | ------- | ----- | --------------- |
| 5       | 1       | 2     | 4               |
| 8       | 2       | 2     | 8               |
| 12      | 3       | 3     | 12              |
| 16      | 4       | 4     | 18              |
| 20      | 5       | 5     | 23              |

L'organisation peut choisir « Avantage Pères Noël » (×1,2) ou « Avantage Krampus » (×0,8).

## Mails

Rien de secret ne part par mail : jamais de rôle ni de secret personnel, seulement ce que la gazette dit à tous et le lien personnel vers le jeu.

- **Ouverture** : « votre rôle vous attend », avec le premier indice.
- **Gazette** à la fin de chaque semaine, ou fin de partie.
- **Révélation**, avec le podium du classement.

Quand le jeu est coché avant le tirage, l'ouverture ne part pas : le mail du tirage la remplace.

Les mails partent après la réponse de la page ou de l'action qui fait avancer le jeu. Le cron quotidien (04:17 UTC) rattrape ce qui n'est pas parti, même si personne n'ouvre le jeu. Chaque envoi est réservé en base avant de partir (`magic_rounds.mailed_at`, `magic_games.reveal_mailed_at`) : jamais de doublon. Si plusieurs semaines se résolvent d'un coup, seule la dernière gazette part.

Le lien personnel est gardé chiffré (`santa_participants.token_enc`, clé serveur) pour être remis dans ces mails. `token_hash` reste seul à servir pour reconnaître un lien. Un Secret Santa lancé avant cette colonne reçoit des mails sans lien, avec la consigne d'ouvrir le lien du premier mail.

## Technique

- `src/lib/magic/engine.ts` : règles pures (rôles, désignations, résolution, indices, secrets, flair), testées dans `engine.test.ts` avec une simulation d'équilibre.
- `src/server/magic/game.ts` : avance à la lecture, écritures par `magic_commit` (version optimiste), envois.
- `src/server/magic/mail.ts` : gabarits des mails.
- Tables :
  - `magic_games` ;
  - `magic_players`, avec `secret` chiffré `{ role, cert? }`, et `out_round` / `out_role` publics ;
  - `magic_votes` ;
  - `magic_rounds`, la gazette de chaque semaine, où la semaine 0 est l'ouverture.
- La base ne contient aucun rôle en clair avant la révélation, sauf celui des masques tombés.
- « Tout annuler » sur le Secret Santa efface aussi le jeu (`santa_cancel`).

## Textes

Les textes du jeu sont dans `src/lib/magic/texts.ts`. Ils doivent être chaleureux, précis et sans jargon :
- on raconte une petite histoire de Noël (lutins, traces dans la neige, chalet) ;
- on dit toujours de quoi il s'agit : « désigner la personne que vous soupçonnez d'être un Krampus », « son vrai rôle est révélé à tous », « il cesse de retirer de la Magie » ;
- pas de point d'exclamation, pas de tiret long.

Le camp adverse s'appelle **Krampus** partout (le Grinch est une marque). Dans le code, son identifiant reste `gr`.

## Design

Les pages du jeu ont leur propre univers et n'utilisent pas le style de base d'Envies. Elles sont dans `src/components/magic/`, avec les classes `mg-` de `magic.css` :
- nuit d'hiver bleu profond, ciel étoilé, neige légère ;
- lumière dorée.

- **Compteur** (`MagicGlobe`) : une boule à neige à l'ancienne.
  - Dedans : un chalet sous la neige et un sapin dont les 13 ampoules s'allument en proportion de la Magie.
  - Socle en bois tourné avec un ruban de velours, un nœud et du houx.
  - Quand la Magie baisse, les ampoules s'éteignent, les fenêtres faiblissent et le givre gagne le verre.
  - Quatre états, écrits en toutes lettres : rayonnante (60 % et plus), vacillante, en danger (moins de 30 %, l'étoile vacille), éteinte (verre givré).
  - Le chiffre et une rangée d'étoiles doublent l'information.
  - `role="meter"`.
- **Carte de rôle** (`RoleCard`) : face cachée à la première visite, retournée d'un geste. L'appareil s'en souvient.
  - Père Noël : bonnet sur fond rouge.
  - Krampus : masque cornu à grelot sur fond brun sombre.
- **Gazette** (`GazetteCard`) : un vieux journal de Noël.
  - Papier vieilli, bandeau avec du houx, filets doubles et « Prix : un chocolat chaud ».
  - Gros titre, lettrine, encart de la Magie.
  - Encart « L'enquête » pour l'indice, et un « carnet des désignations » dépliable.
- **Mouvement.** La neige, les étincelles et les ampoules s'arrêtent avec `prefers-reduced-motion` (règle globale).
