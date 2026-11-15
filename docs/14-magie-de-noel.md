# 14. La Magie de Noël

Jeu à rôles cachés, en parallèle d'un Secret Santa lancé. Version simple : une seule action possible, facultative, et un jeu qui va au bout même si personne ne joue.

## Principes

- **Il marche sans tout le monde.** Rien n'attend personne. Les semaines se résolvent seules, à l'heure dite.
- **Une action par semaine, au plus** : désigner un suspect. Un clic, modifiable, facultatif.
- **Les manigances sont possibles, pas nécessaires.** Lire la gazette et cliquer suffit pour jouer pleinement.
- **Fun immédiat** : la carte de rôle se retourne dès la première visite, et le premier indice est déjà là.

## Règles

1. **Rôles.** À l'ouverture du jeu, environ un joueur sur quatre est tiré au sort Grinch (`floor((n + 2) / 4)`, au moins 1). Les autres sont Pères Noël. Les Grinchs voient qui sont les autres Grinchs. De 5 à 30 joueurs.
2. **Cinq semaines.** La durée d'une « semaine » est réglable de 1 à 14 jours (7 par défaut).
3. **Désignation.** Chaque semaine, chacun peut désigner une personne encore en jeu, sauf soi-même. Un Grinch démasqué ne désigne plus. Un Père Noël démasqué continue.
4. **Fin de semaine, dans l'ordre :**
   - la personne la plus désignée est démasquée, si elle a au moins `max(2, nombre de Grinchs)` voix et qu'il n'y a pas d'égalité ;
   - Grinch démasqué : Magie +2, sans dépasser le niveau de départ, et il ne nuit plus ;
   - Père Noël démasqué : Magie −1 ;
   - chaque Grinch encore caché retire 1 de Magie.
5. **Fin de partie.**
   - Magie à 0 : les Grinchs gagnent.
   - Tous les Grinchs démasqués : les Pères Noël gagnent, sans attendre.
   - Magie au-dessus de 0 après la semaine 5 : les Pères Noël gagnent.
6. **Révélation.** L'organisation révèle les rôles quand la partie est finie. Le tableau montre chaque rôle, la semaine où chaque masque est tombé, et le **flair** de chacun : le nombre de fois où il a désigné un Grinch encore caché. Le meilleur flair est signalé.

## Comment on déduit

- **Les indices de la gazette**, sur un Grinch encore caché, de plus en plus précis :
  - semaine 1 : nombre de lettres du prénom ;
  - semaine 2 : première lettre entre A et L, ou entre M et Z ;
  - semaine 3 : deux innocents ;
  - semaines 4 et 5 : un trio qui cache un Grinch.
- **Qui a désigné qui** : publié dans la gazette après chaque semaine. On peut repérer ceux qui votent ensemble ou qui protègent quelqu'un.
- **Le secret personnel.** À la fin de la semaine 2, chaque Père Noël reçoit en privé le nom d'un autre Père Noël, de préférence encore en jeu. Les Grinchs ne reçoivent rien, mais peuvent prétendre le contraire.
- **Les masques tombés** : un Père Noël démasqué est innocenté pour de bon.

Les joueurs peuvent en parler entre eux comme ils veulent. Tout le monde peut mentir.

## Équilibre

Magie de départ par taille de groupe, dans `engine.ts` (`BALANCED`). Elle est calculée par simulation pour qu'à participation de 60 %, chaque camp gagne environ une fois sur deux. Le modèle de la simulation :
- chaque joueur désigne avec une probabilité donnée ;
- un Père Noël vise un Grinch dans 30 % des cas en semaine 1, puis de plus en plus souvent jusqu'à 65 % en semaine 5 ;
- les Grinchs accusent ensemble un innocent.

Elle ne dépasse jamais `Grinchs × 5`, pour que les Grinchs puissent toujours gagner par le seul sabotage. Si personne ne joue, les Grinchs gagnent : c'est voulu.

| Joueurs | Grinchs | Seuil | Magie de départ |
| ------- | ------- | ----- | --------------- |
| 5       | 1       | 2     | 4               |
| 8       | 2       | 2     | 8               |
| 12      | 3       | 3     | 12              |
| 16      | 4       | 4     | 18              |
| 20      | 5       | 5     | 23              |

L'organisation peut choisir « Avantage Pères Noël » (×1,2) ou « Avantage Grinchs » (×0,8).

## Mails

Rien de secret ne part par mail : jamais de rôle ni de secret personnel, seulement ce que la gazette dit à tous et le lien personnel vers le jeu.

- **Ouverture** : « votre rôle vous attend », avec le premier indice.
- **Gazette** à la fin de chaque semaine, ou fin de partie.
- **Révélation**.

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

## Design

Les pages du jeu ont leur propre univers et n'utilisent pas le style de base d'Envies. Elles sont dans `src/components/magic/`, avec les classes `mg-` de `magic.css` :
- nuit d'hiver bleu profond, ciel étoilé, neige légère ;
- lumière dorée, papier crème pour la gazette.

- **Compteur** (`MagicGlobe`) : une boule à neige.
  - La lumière ambrée descend avec la Magie et le givre gagne le verre.
  - Quatre états, écrits en toutes lettres : sereine (60 % et plus), fragile, critique (moins de 30 %, l'étoile vacille), éteinte (verre givré, sapin éteint).
  - Le chiffre et une rangée d'étoiles doublent l'information.
  - `role="meter"`.
- **Carte de rôle** (`RoleCard`) : face cachée à la première visite, retournée d'un geste. L'appareil s'en souvient.
  - Père Noël : bonnet sur fond rouge.
  - Grinch : boule fêlée sur fond vert.
- **Gazette** (`GazetteCard`) : bandeau de journal, bilan, indice encadré, « qui a désigné qui » dépliable.
- **Mouvement.** La neige, les paillettes et la vague s'arrêtent avec `prefers-reduced-motion` (règle globale).
