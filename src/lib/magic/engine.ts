// La Magie de Noël (docs/14-magie-de-noel.md) : règles du jeu, pures. Le hasard est injecté.

export type RandomInt = (max: number) => number;

/** Rôle réel. `inf_gr` : Grinch placé chez les Pères Noël. `inf_pn` : Père Noël placé chez les Grinchs. */
export type Role = "pn" | "gr" | "inf_gr" | "inf_pn";
export type Chat = "pn" | "gr";
export type PnCard = "facteur" | "lanterne" | "parefeu" | "bouclier" | "fee";
export type GrCard = "cyber" | "brouilleur" | "siphon" | "corrupteur" | "givre";
/** `espion` : le pouvoir d'un infiltré, joué par le tchat où il est placé. */
export type Card = PnCard | GrCard | "espion";
export type PlayerSecret = { role: Role; pseudo: string; card: Card };
export type Nature = "num" | "mag" | "glace";

export const PLAYERS = 12;
export const CAMP_SIZE = 5;
export const ROUNDS = 5;
export const ACCUSATIONS = 2;
export const PN_CARDS: PnCard[] = ["facteur", "lanterne", "parefeu", "bouclier", "fee"];
export const GR_CARDS: GrCard[] = ["cyber", "brouilleur", "siphon", "corrupteur", "givre"];

export const PSEUDOS = [
  "Flocon",
  "Cannelle",
  "Sapin",
  "Chocolat Chaud",
  "Pain d'Épices",
  "Grelot",
  "Guirlande",
  "Marron Glacé",
  "Boule de Neige",
  "Étoile",
  "Mandarine",
  "Houx",
  "Papillote",
  "Clémentine",
  "Moufle",
  "Traîneau",
];

/** Tchat où le joueur est placé. */
export const chatOf = (role: Role): Chat => (role === "pn" || role === "inf_gr" ? "pn" : "gr");
/** Camp pour lequel il joue. */
export const campOf = (role: Role): Chat => (role === "pn" || role === "inf_pn" ? "pn" : "gr");
export const isInfiltre = (role: Role) => role === "inf_gr" || role === "inf_pn";

// ---------------------------------------------------------------------------
// Choix du camp, dans l'ordre d'arrivée
// ---------------------------------------------------------------------------

/** Ce que le prochain arrivant peut choisir. `auto` : plus de choix, son rôle lui est donné. */
export type JoinOption = "camp" | "infiltre" | "auto";

function counts(joined: readonly PlayerSecret[]) {
  const n = (role: Role) => joined.filter((p) => p.role === role).length;
  return { pn: n("pn"), gr: n("gr"), infGr: n("inf_gr"), infPn: n("inf_pn") };
}

export function joinOption(joined: readonly PlayerSecret[]): JoinOption {
  const c = counts(joined);
  if (c.pn < CAMP_SIZE && c.gr < CAMP_SIZE) return "camp";
  if (c.pn < CAMP_SIZE || c.gr < CAMP_SIZE) return "auto";
  return c.infGr + c.infPn === 0 ? "infiltre" : "auto";
}

export class MagicError extends Error {}

/**
 * Rôle, pseudonyme et carte du prochain arrivant. Les dix premiers remplissent les camps
 * (un camp complet envoie dans l'autre), les deux derniers sont les infiltrés.
 * `choice` sans valeur ou impossible : tirage au sort parmi ce qui reste.
 */
export function assignJoin(
  joined: readonly PlayerSecret[],
  choice: Role | null,
  randomInt: RandomInt,
): PlayerSecret {
  if (joined.length >= PLAYERS) throw new MagicError("Le jeu est complet.");
  const c = counts(joined);
  const open: Role[] = [];
  if (c.pn < CAMP_SIZE) open.push("pn");
  if (c.gr < CAMP_SIZE) open.push("gr");
  if (!open.length) {
    if (!c.infGr) open.push("inf_gr");
    if (!c.infPn) open.push("inf_pn");
  }
  if (!open.length) throw new MagicError("Le jeu est complet.");
  const role = choice && open.includes(choice) ? choice : open[randomInt(open.length)]!;

  let card: Card = "espion";
  if (role === "pn" || role === "gr") {
    const all: Card[] = role === "pn" ? PN_CARDS : GR_CARDS;
    const taken = new Set(joined.filter((p) => p.role === role).map((p) => p.card));
    const free = all.filter((x) => !taken.has(x));
    card = free[randomInt(free.length)]!;
  }
  const used = new Set(joined.map((p) => p.pseudo));
  const names = PSEUDOS.filter((p) => !used.has(p));
  return { role, card, pseudo: names[randomInt(names.length)]! };
}

/** Vérifie une distribution complète : 5 + 5 + 2, cartes et pseudonymes tous différents. */
export function checkRoster(players: readonly PlayerSecret[]): void {
  const c = counts(players);
  if (players.length !== PLAYERS || c.pn !== 5 || c.gr !== 5 || c.infGr !== 1 || c.infPn !== 1) {
    throw new MagicError("Distribution des rôles invalide.");
  }
  if (new Set(players.map((p) => p.pseudo)).size !== PLAYERS) throw new MagicError("Pseudonyme en double.");
  for (const [role, cards] of [
    ["pn", PN_CARDS],
    ["gr", GR_CARDS],
  ] as const) {
    const held = players.filter((p) => p.role === role).map((p) => p.card);
    if (new Set(held).size !== 5 || held.some((x) => !(cards as Card[]).includes(x))) {
      throw new MagicError("Cartes invalides.");
    }
  }
  if (players.some((p) => isInfiltre(p.role) && p.card !== "espion"))
    throw new MagicError("Cartes invalides.");
}

// ---------------------------------------------------------------------------
// Vote
// ---------------------------------------------------------------------------

export type Tally = { winner: string; counts: Record<string, number>; tie: boolean; noVote: boolean };

/**
 * Pouvoir joué dans un tchat : le pseudonyme le plus voté parmi ceux qui n'ont pas encore joué.
 * Égalité, ou aucun vote : tirage au sort. Les votes hors liste ne comptent pas.
 */
export function tally(
  votes: readonly { voter: string; target: string }[],
  voters: readonly string[],
  eligible: readonly string[],
  randomInt: RandomInt,
): Tally {
  if (!eligible.length) throw new MagicError("Plus aucun pouvoir à jouer.");
  const result: Record<string, number> = {};
  const seen = new Set<string>();
  for (const v of votes) {
    if (!voters.includes(v.voter) || !eligible.includes(v.target) || seen.has(v.voter)) continue;
    seen.add(v.voter);
    result[v.target] = (result[v.target] ?? 0) + 1;
  }
  const best = Math.max(0, ...Object.values(result));
  const top = best === 0 ? [...eligible] : eligible.filter((p) => result[p] === best);
  return {
    winner: top[randomInt(top.length)]!,
    counts: result,
    tie: best > 0 && top.length > 1,
    noVote: best === 0,
  };
}

// ---------------------------------------------------------------------------
// Résolution d'une manche
// ---------------------------------------------------------------------------

const ATTACK: Record<GrCard | "espion", { nature: Nature; loss: number }> = {
  cyber: { nature: "num", loss: 1 },
  espion: { nature: "num", loss: 1 },
  brouilleur: { nature: "num", loss: 1 },
  siphon: { nature: "mag", loss: 2 },
  corrupteur: { nature: "mag", loss: 3 },
  givre: { nature: "glace", loss: 1 },
};

export type RoundInput = {
  round: number;
  gauge: number;
  /** Le pouvoir des Pères Noël de cette manche est gelé (Givré joué à la manche d'avant). */
  frozen: boolean;
  /** Plus grosse perte subie en une manche jusqu'ici. */
  maxLoss: number;
  /** Carte du pseudonyme voté dans le tchat des Pères Noël (`espion` : leur infiltré). */
  pnCard: PnCard | "espion";
  grCard: GrCard | "espion";
};

export type RoundResult = {
  nature: Nature;
  /** Nature annoncée aux Pères Noël (`null` : cachée par le Brouilleur). */
  natureShown: Nature | null;
  blocked: boolean;
  loss: number;
  gain: number;
  gaugeAfter: number;
  maxLossAfter: number;
  /** Le pouvoir des Pères Noël de la manche suivante sera gelé. */
  frozenNext: boolean;
  /** Le joueur voté chez les Pères Noël part en visite chez les Grinchs. */
  pnVisit: boolean;
  grVisit: boolean;
  lanterne: boolean;
  corrupteur: boolean;
  grinchsWin: boolean;
};

/** Une manche : l'attaque des Grinchs et la défense des Pères Noël, comptées en même temps. */
export function resolveRound(input: RoundInput): RoundResult {
  const { round, gauge, frozen, maxLoss, pnCard, grCard } = input;
  const attack = ATTACK[grCard];
  const pnActive = !frozen;
  const blocked =
    pnActive &&
    ((pnCard === "parefeu" && attack.nature === "num") || (pnCard === "bouclier" && attack.nature === "mag"));
  let loss = 0;
  if (!blocked) {
    loss = attack.loss;
    if (grCard === "givre" && round >= ROUNDS) loss += 1;
  }
  let gain = 0;
  if (pnActive) {
    if (pnCard === "facteur" || pnCard === "espion" || pnCard === "lanterne") gain = 1;
    else if (pnCard === "fee") gain = Math.max(maxLoss, 1);
  }
  const gaugeAfter = Math.max(0, gauge - loss + gain);
  return {
    nature: attack.nature,
    natureShown: grCard === "brouilleur" ? null : attack.nature,
    blocked,
    loss,
    gain,
    gaugeAfter,
    maxLossAfter: Math.max(maxLoss, loss),
    frozenNext: !blocked && grCard === "givre" && round < ROUNDS,
    pnVisit: pnActive && (pnCard === "facteur" || pnCard === "espion"),
    grVisit: !blocked && (grCard === "cyber" || grCard === "espion"),
    lanterne: pnActive && pnCard === "lanterne",
    corrupteur: !blocked && grCard === "corrupteur",
    grinchsWin: gauge - loss + gain <= 0,
  };
}

/** Nombre de lettres d'un prénom (indices de la Lanterne et du Corrupteur). */
export function letterCount(name: string): number {
  return [...name].filter((c) => /\p{L}/u.test(c)).length;
}

// ---------------------------------------------------------------------------
// Identifications et classement
// ---------------------------------------------------------------------------

export type AccusedRole = "pn" | "gr" | "inf";
export const accusedRoleOf = (role: Role): AccusedRole => (isInfiltre(role) ? "inf" : role);

const RIGHT: Record<AccusedRole, number> = { pn: 1, gr: 2, inf: 4 };
const WRONG: Record<AccusedRole, number> = { pn: -1, gr: -2, inf: -1 };

export type Score = { points: number; right: number; wrong: number; unmasked: number };

/** Points de chacun : identifications justes ou fausses, et −1 chaque fois qu'on est démasqué. */
export function scores(
  players: readonly { id: string; role: Role }[],
  accusations: readonly { accuser: string; target: string; role: AccusedRole }[],
): Map<string, Score> {
  const out = new Map<string, Score>(
    players.map((p) => [p.id, { points: 0, right: 0, wrong: 0, unmasked: 0 }]),
  );
  const roles = new Map(players.map((p) => [p.id, accusedRoleOf(p.role)]));
  for (const a of accusations) {
    const accuser = out.get(a.accuser);
    const target = out.get(a.target);
    const truth = roles.get(a.target);
    if (!accuser || !target || !truth || a.accuser === a.target) continue;
    if (truth === a.role) {
      accuser.points += RIGHT[a.role];
      accuser.right += 1;
      target.points -= 1;
      target.unmasked += 1;
    } else {
      accuser.points += WRONG[a.role];
      accuser.wrong += 1;
    }
  }
  return out;
}
