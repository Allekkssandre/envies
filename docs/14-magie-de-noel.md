# 14. La Magie de Noël

Jeu à rôles cachés adossé à un Secret Santa lancé (`docs/13-secret-santa.md`). Il se joue à 12, sur 5 manches. Il ne touche jamais aux cadeaux pendant la partie. Les conséquences du résultat sur le Jour J restent à définir.

## Règles

**But.** Une jauge, la Magie de Noël, part de 4 (réglable de 3 à 5). Les Grinchs gagnent si elle tombe à 0. Si elle tient 5 manches, les Pères Noël gagnent. En parallèle, chacun joue pour un classement individuel.

**Camps.** 5 Pères Noël, 5 Grinchs, 2 infiltrés. Le Grinch infiltré joue pour les Grinchs mais se trouve dans le tchat des Pères Noël. Le Père Noël infiltré, l'inverse. Chaque tchat compte donc 6 pseudonymes, dont un infiltré, et tout le monde le sait.

**Choix du camp.** Jusqu'au début de la partie, chacun choisit en secret depuis son lien personnel, dans l'ordre d'arrivée. Un camp complet envoie dans l'autre. Le onzième choisit quel infiltré il sera, le douzième prend l'autre rôle. Au début de la partie, les retardataires sont placés au hasard, dans un ordre tiré au sort. Le nombre de places restantes n'est jamais affiché.

**Ce que chacun sait.** Son rôle, son pseudonyme (tiré au sort) et son pouvoir. Rien d'autre : ni qui est qui, ni les pouvoirs des autres, ni la liste des pouvoirs de son camp. On peut annoncer son pouvoir ou se taire. Seul l'infiltré a le droit de mentir.

**Une manche.** Le tchat débat, puis vote pour un pseudonyme. À la fin du vote, le pouvoir du plus voté est joué d'office, dans chaque tchat. Chaque pseudonyme ne peut être choisi qu'une fois. Égalité ou aucun vote : tirage au sort. Les votes sont modifiables jusqu'à la fin, et leur décompte est visible dans le tchat. Une gazette par tchat donne aussitôt le bilan.

**Pouvoirs des Grinchs.**

| Carte | Nature | Effet |
|---|---|---|
| CyberGrinch | numérique | −1, visite d'une manche chez les Pères Noël |
| Brouilleur | numérique | −1, la nature de l'attaque est cachée aux Pères Noël |
| Siphon | magique | −2 |
| Corrupteur | magique | −3, les Pères Noël apprennent le nombre de lettres du prénom de l'attaquant |
| Givré | glace | −1, le pouvoir des Pères Noël de la manche suivante est annulé. Manche 5 : −2. Imblocable |
| Espion (Père Noël infiltré) | numérique | −1, visite d'une manche chez les Pères Noël, son vrai camp |

**Pouvoirs des Pères Noël.**

| Carte | Effet |
|---|---|
| Facteur | +1, visite d'une manche chez les Grinchs |
| Lanterne | +1, nombre de lettres du prénom d'un Grinch tiré au sort (infiltré compris) |
| Pare-feu | bloque l'attaque de la manche si elle est numérique |
| Bouclier | bloque l'attaque de la manche si elle est magique |
| Fée du sapin | rend la plus grosse perte subie en une manche jusqu'ici (au moins 1) |
| Espion (Grinch infiltré) | +1, visite d'une manche chez les Grinchs, son vrai camp |

L'attaque et la défense d'une manche sont comptées ensemble. Une attaque bloquée n'a aucun effet (ni perte, ni visite, ni indice). Un pouvoir gelé est consommé sans effet.

**Visites.** Le visiteur quitte son tchat et entre dans l'autre sous son pseudonyme, annoncé ainsi : « X est présent dans le tchat en raison de son pouvoir d'espionnage. Il peut être un infiltré de votre camp, ou un membre du camp adverse. » Il ne voit que les messages écrits depuis son arrivée, il écrit, et il vote au vote suivant de ce tchat. Il rentre à la fin de ce vote. Les deux espionnages d'un tchat (la vraie carte et celle de l'infiltré) ont exactement le même effet visible.

**Gazettes.** Pères Noël : pouvoir joué (pseudonyme), attaque subie (nature et décompte, jamais le nom du pouvoir), défense, jauge, indices. Grinchs : pouvoir joué, résultat de leur attaque, défense adverse, jauge.

**Identifications.** Deux par joueur sur toute la partie, définitives, secrètes. On vise une personne (son vrai nom) et un rôle : Père Noël, Grinch ou infiltré. Juste : +1, +2, +4. Faux : −1, −2, −1. Être identifié : −1. Un infiltré désigné comme « Grinch » ou « Père Noël » compte comme faux. Le rappel « n restantes » est visible en permanence sur la page du jeu.

**Fin.** Jauge à 0, ou fin de la manche 5. L'organisation révèle ensuite rôles, pseudonymes, pouvoirs et classement, visibles par tous.

## Scénarios passés en revue et décisions

| Scénario | Décision |
|---|---|
| Deux joueurs choisissent en même temps | Chaque écriture porte la version de l'état. La seconde est refusée, relue et rejouée : l'ordre d'arrivée est l'ordre des écritures réussies |
| Un joueur n'ouvre jamais son lien | Placé d'office au début de la partie |
| Personne ne vote | Tirage au sort parmi les pouvoirs restants : la partie avance toujours |
| Égalité | Tirage au sort entre les ex æquo (pas de second tour : les décomptes sont visibles, le tchat peut départager lui-même) |
| Personne n'ouvre le jeu pendant plusieurs jours | Les échéances passées sont résolues à la première visite, dans l'ordre, et par la tâche quotidienne |
| Un vote arrive après l'échéance | Refusé : l'échéance est résolue avant toute action |
| Le tchat vote son infiltré | Son pouvoir est joué : même décompte que la vraie carte d'espionnage, mais l'infiltré rejoint son vrai camp une manche |
| L'infiltré annonce un faux pouvoir et se fait voter | Son départ en visite montre qu'il avait l'espionnage. Il a intérêt à annoncer l'espionnage |
| Espionnage bloqué par le Pare-feu, ou Facteur gelé | Pas de visite |
| Les deux visites la même manche | Chaque tchat perd un membre et accueille un visiteur |
| Visiteur absent de son tchat | Il n'y vote pas cette manche. À son retour, il retrouve tout l'historique |
| Espionnage joué à la manche 5 | La visite dure jusqu'à la révélation, sans vote |
| Givré à la manche 5 | −2, rien à geler |
| Jauge à 0 avant la manche 5 | Partie terminée, tchats et identifications ouverts jusqu'à la révélation |
| Identifier au hasard | Perdant en moyenne pour tout joueur et tout rôle (vérifié par un test) |
| Indices trop précis | Lanterne et Corrupteur donnent un nombre de lettres, pas une initiale |
| Indices de présence | Ni « en ligne », ni heure des messages |
| « Tout annuler » le Secret Santa | Le jeu est effacé avec lui |
| Discussions hors du jeu | Règle d'honneur, rappelée dans les règles |

Équilibre : avec une jauge de départ à 4 et des votes au hasard, les Grinchs gagnent 52 % des 518 400 ordres de vote possibles (test `engine.test.ts`). De vrais joueurs s'en écarteront : l'organisation peut régler la jauge de départ.

## Technique

- `src/lib/magic/engine.ts` : règles pures (choix du camp, vote, manche, classement), testées.
- `src/server/magic/game.ts` : déroulé à la demande (`advanceMagic`), vue d'un joueur, révélation.
- `src/server/actions/magic.ts` : actions du joueur (par son lien personnel) et de l'organisation.
- Migration `20261116100000_magie_de_noel.sql` : tables `magic_*`, fonction `magic_commit` (écriture d'un bloc, refusée si la version a changé).
- Secret : rôle, pseudonyme et pouvoir de chaque joueur sont chiffrés (AES-256-GCM, `SANTA_SECRET_KEY`). Tchats, votes et visites ne portent que des pseudonymes. Aucune page de l'organisation ne montre un rôle.
- Routes : `/lutins/moi/[token]/jeu` (joueur). L'organisation ouvre, suit et révèle depuis `/lutins/[slug]`.
- Pas de mail pour les gazettes dans cette version : tout se lit sur le site.

## Textes

Tous dans `src/lib/magic/texts.ts` (rôles, pouvoirs, gazettes, messages du tchat, règles). Règles d'écriture : phrases courtes, pas de tiret long, pas de point d'exclamation, pas de formule d'accroche.

## À venir

- Illustrations des cartes et mise en forme des gazettes : prompts dans `docs/15-magie-prompts-design.md`.
- Conséquences du résultat sur le Jour J.
- Gazettes par mail.
