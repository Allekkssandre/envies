// La Magie de Noël, version simple (docs/14-magie-de-noel.md) : règles pures, sans base ni réseau.
//
// Environ un Grinch pour quatre joueurs, tirés au sort. Chaque semaine, chacun peut désigner un
// suspect. Le plus désigné (seuil atteint, sans égalité) est démasqué : un Grinch fait remonter
// la Magie, un Père Noël la fait baisser. Puis chaque Grinch encore caché retire 1 de Magie.
// Les Grinchs gagnent si la Magie tombe à 0 ; les Pères Noël s'ils tiennent cinq semaines ou
// démasquent tous les Grinchs.

export type Role = "pn" | "gr";
export type Rng = (max: number) => number;

export const ROUNDS = 5;
export const MIN_PLAYERS = 5;
export const MAX_PLAYERS = 30;
/** Démasquer un Grinch rend de la Magie, sans dépasser le niveau de départ. */
export const CATCH_GAIN = 2;
/** Démasquer un Père Noël coûte de la Magie. */
export const WRONG_LOSS = 1;
/** Perte par Grinch encore caché, à la fin de chaque semaine. */
export const SABOTAGE = 1;
/** Les secrets personnels sont distribués à la fin de cette semaine. */
export const CERT_ROUND = 2;

export function grinchCount(players: number): number {
  return Math.max(1, Math.floor((players + 2) / 4));
}

/** Nombre minimal de désignations pour démasquer quelqu'un. */
export function threshold(players: number): number {
  return Math.max(2, grinchCount(players));
}

// Magie de départ pour 5 à 30 joueurs : environ une chance sur deux pour chaque camp quand
// 60 % des joueurs désignent chaque semaine (simulation, docs/14-magie-de-noel.md § Équilibre).
const BALANCED = [
  4, 9, 9, 8, 7, 14, 14, 12, 11, 19, 18, 18, 17, 24, 24, 23, 23, 29, 29, 28, 28, 34, 34, 34, 33, 39,
];

export type Level = "pn" | "balanced" | "gr";

/** Magie au départ. `pn` avantage les Pères Noël, `gr` les Grinchs. */
export function startMagic(players: number, level: Level = "balanced"): number {
  const n = Math.min(MAX_PLAYERS, Math.max(MIN_PLAYERS, players));
  const base = BALANCED[n - MIN_PLAYERS]!;
  const factor = level === "pn" ? 1.2 : level === "gr" ? 0.8 : 1;
  return Math.min(grinchCount(n) * ROUNDS, Math.max(2, Math.round(base * factor)));
}

export function shuffle<T>(items: readonly T[], rng: Rng): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = rng(i + 1);
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

/** Rôles tirés au sort. */
export function assignRoles(ids: readonly string[], rng: Rng): Map<string, Role> {
  const grinchs = grinchCount(ids.length);
  return new Map(shuffle(ids, rng).map((id, i) => [id, i < grinchs ? "gr" : "pn"] as const));
}

export type Player = { id: string; role: Role; out: boolean };
export type Vote = { voter: string; target: string };

/** Peut désigner : tout le monde, sauf un Grinch déjà démasqué. */
export const canVote = (p: Player) => !(p.out && p.role === "gr");
/** Peut être désigné : quiconque n'est pas encore démasqué. */
export const canBeTargeted = (p: Player) => !p.out;

/** Désignations valables : un votant actif, une cible encore en jeu, jamais soi-même. */
export function validVotes(players: readonly Player[], votes: readonly Vote[]): Vote[] {
  const byId = new Map(players.map((p) => [p.id, p]));
  return votes.filter((v) => {
    const voter = byId.get(v.voter);
    const target = byId.get(v.target);
    return voter && target && v.voter !== v.target && canVote(voter) && canBeTargeted(target);
  });
}

export function tally(players: readonly Player[], votes: readonly Vote[]) {
  const counts: Record<string, number> = {};
  for (const v of validVotes(players, votes)) counts[v.target] = (counts[v.target] ?? 0) + 1;
  const top = Math.max(0, ...Object.values(counts));
  const leaders = Object.keys(counts).filter((id) => counts[id] === top);
  const unmasked = top >= threshold(players.length) && leaders.length === 1 ? leaders[0]! : null;
  return { counts, top, leaders, unmasked };
}

export type RoundResult = {
  unmasked: string | null;
  unmaskedRole: Role | null;
  /** Effet du démasquage sur la Magie (+2, −1 ou 0), après plafond. */
  accusation: number;
  /** Grinchs encore cachés après le démasquage : chacun retire 1. */
  sabotage: number;
  before: number;
  after: number;
  winner: Role | null;
  /** Pourquoi la partie finit. */
  end: "zero" | "all-caught" | "last-round" | null;
};

export function resolveRound(input: {
  round: number;
  magic: number;
  startMagic: number;
  players: readonly Player[];
  votes: readonly Vote[];
}): RoundResult & { counts: Record<string, number> } {
  const { counts, unmasked } = tally(input.players, input.votes);
  const role = unmasked ? input.players.find((p) => p.id === unmasked)!.role : null;
  const raw = role === "gr" ? CATCH_GAIN : role === "pn" ? -WRONG_LOSS : 0;
  const capped = Math.min(input.startMagic, Math.max(0, input.magic + raw));
  const hidden = input.players.filter((p) => p.role === "gr" && !p.out && p.id !== unmasked).length;
  const after = Math.max(0, capped - hidden * SABOTAGE);
  const end = after <= 0 ? "zero" : hidden === 0 ? "all-caught" : input.round >= ROUNDS ? "last-round" : null;
  return {
    counts,
    unmasked,
    unmaskedRole: role,
    accusation: capped - input.magic,
    sabotage: hidden * SABOTAGE,
    before: input.magic,
    after,
    winner: end === "zero" ? "gr" : end ? "pn" : null,
    end,
  };
}

// ---------------------------------------------------------------------------
// Indices
// ---------------------------------------------------------------------------

export type Person = { id: string; firstName: string; lastName: string };

/** Prénom, suivi de l'initiale du nom quand deux joueurs ont le même prénom. */
export function displayNames(people: readonly Person[]): Map<string, string> {
  const key = (p: Person) => p.firstName.trim().toLocaleLowerCase("fr");
  const seen = new Map<string, number>();
  for (const p of people) seen.set(key(p), (seen.get(key(p)) ?? 0) + 1);
  return new Map(
    people.map((p) => {
      const first = p.firstName.trim();
      const initial = p.lastName.trim().charAt(0).toLocaleUpperCase("fr");
      return [p.id, (seen.get(key(p)) ?? 0) > 1 && initial ? `${first} ${initial}.` : first] as const;
    }),
  );
}

const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLocaleUpperCase("fr");

/** Lettres du prénom, sans compter espaces, tirets ni apostrophes. */
export const letterCount = (name: string) => fold(name).replace(/[^A-Z]/g, "").length;

export type Clue =
  | { t: "letters"; n: number }
  | { t: "range"; from: string; to: string }
  | { t: "innocent"; names: string[] }
  | { t: "among"; names: string[] };

/**
 * Indice de la semaine `week` (1 à 5), sur un Grinch encore caché. De plus en plus précis :
 * nombre de lettres, première lettre, deux innocents, puis un trio qui cache un Grinch.
 */
export function makeClue(week: number, people: readonly (Person & Player)[], rng: Rng): Clue | null {
  const grinchs = people.filter((p) => p.role === "gr" && !p.out);
  const innocents = people.filter((p) => p.role === "pn" && !p.out);
  if (!grinchs.length) return null;
  const names = displayNames(people);
  const target = grinchs[rng(grinchs.length)]!;
  if (week === 3 && innocents.length >= 2) {
    return {
      t: "innocent",
      names: shuffle(innocents, rng)
        .slice(0, 2)
        .map((p) => names.get(p.id)!),
    };
  }
  if (week >= 4 && innocents.length >= 2) {
    const trio = shuffle([target, ...shuffle(innocents, rng).slice(0, 2)], rng);
    return { t: "among", names: trio.map((p) => names.get(p.id)!) };
  }
  if (week === 2) {
    const first =
      fold(target.firstName)
        .replace(/[^A-Z]/g, "")
        .charAt(0) || "A";
    return first <= "L" ? { t: "range", from: "A", to: "L" } : { t: "range", from: "M", to: "Z" };
  }
  return { t: "letters", n: letterCount(target.firstName) };
}

/**
 * Secrets personnels : chaque Père Noël reçoit le nom d'un autre Père Noël, de préférence
 * encore en jeu. Les Grinchs ne reçoivent rien.
 */
export function certificates(players: readonly Player[], rng: Rng): Map<string, string> {
  const out = new Map<string, string>();
  const pns = players.filter((p) => p.role === "pn");
  for (const p of pns) {
    const others = pns.filter((o) => o.id !== p.id);
    const fresh = others.filter((o) => !o.out);
    const pool = fresh.length ? fresh : others;
    if (pool.length) out.set(p.id, pool[rng(pool.length)]!.id);
  }
  return out;
}

/** Flair : désignations portées sur un Grinch encore caché au moment du vote. */
export function flair(
  rounds: readonly { votes: readonly Vote[]; hiddenGrinchs: readonly string[] }[],
): Map<string, number> {
  const out = new Map<string, number>();
  for (const r of rounds) {
    for (const v of r.votes) {
      if (r.hiddenGrinchs.includes(v.target)) out.set(v.voter, (out.get(v.voter) ?? 0) + 1);
    }
  }
  return out;
}
