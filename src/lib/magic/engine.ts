// La Magie de Noël, version simple (docs/14-magie-de-noel.md) : règles pures, sans base ni réseau.
//
// Environ un Krampus pour quatre joueurs, tirés au sort. Chaque semaine, chacun peut désigner un
// suspect. Le plus désigné (seuil atteint, sans égalité) est démasqué : un Krampus fait remonter
// la Magie, un Père Noël la fait baisser. Puis chaque Krampus encore caché retire 1 de Magie.
// Les Krampus gagnent si la Magie tombe à 0 ; les Pères Noël s'ils tiennent cinq semaines ou
// démasquent tous les Krampus.

export type Role = "pn" | "gr";
export type Rng = (max: number) => number;

export const ROUNDS = 5;
export const MIN_PLAYERS = 5;
export const MAX_PLAYERS = 30;
/** Démasquer un Krampus rend de la Magie, sans dépasser le niveau de départ. */
export const CATCH_GAIN = 2;
/** Démasquer un Père Noël coûte de la Magie. */
export const WRONG_LOSS = 1;
/** Perte par Krampus encore caché, à la fin de chaque semaine. */
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

/** Magie au départ. `pn` avantage les Pères Noël, `gr` les Krampus. */
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

/** Peut désigner : tout le monde, sauf un Krampus déjà démasqué. */
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
  /** Krampus encore cachés après le démasquage : chacun retire 1. */
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
  // Anciens indices, gardés pour relire les gazettes déjà publiées.
  | { t: "letters"; n: number }
  | { t: "range"; from: string; to: string }
  // « Le prénom d'un Krampus contient la lettre R. »
  | { t: "has"; letter: string }
  // « Le prénom d'un Krampus compte 5 lettres ou moins » (max), « ou plus » (min).
  | { t: "length"; op: "max" | "min"; n: number }
  | { t: "innocent"; names: string[] }
  | { t: "among"; names: string[] };

const lettersOf = (name: string) => new Set(fold(name).replace(/[^A-Z]/g, ""));
const firstLetter = (name: string) =>
  fold(name)
    .replace(/[^A-Z]/g, "")
    .charAt(0) || "A";

/** Le prénom de `p` correspond à un indice portant sur les lettres. */
function nameMatches(clue: Clue, p: Person): boolean {
  switch (clue.t) {
    case "letters":
      return letterCount(p.firstName) === clue.n;
    case "range":
      return firstLetter(p.firstName) >= clue.from && firstLetter(p.firstName) <= clue.to;
    case "has":
      return lettersOf(p.firstName).has(clue.letter);
    case "length":
      return clue.op === "max" ? letterCount(p.firstName) <= clue.n : letterCount(p.firstName) >= clue.n;
    default:
      return false;
  }
}

/** Part visée des joueurs en jeu qu'un indice sur les lettres laisse suspects : ni trop, ni trop peu. */
const CLUE_SHARE = 0.5;

/** Tous les indices sur les lettres possibles parmi ces joueurs. */
function letterClues(kind: "has" | "length", people: readonly Person[]): Clue[] {
  if (kind === "has") {
    const all = new Set<string>();
    for (const p of people) for (const l of lettersOf(p.firstName)) all.add(l);
    return [...all].map((letter) => ({ t: "has", letter }));
  }
  const lengths = people.map((p) => letterCount(p.firstName));
  const out: Clue[] = [];
  for (let n = Math.min(...lengths); n <= Math.max(...lengths); n++) {
    out.push({ t: "length", op: "max", n }, { t: "length", op: "min", n });
  }
  return out;
}

/**
 * Le meilleur indice sur les lettres parmi `candidates` : celui qui laisse suspecte une part des
 * joueurs en jeu la plus proche de la moitié, pour qu'un prénom rare ne trahisse personne.
 * Tirage au sort parmi les quasi-ex aequo, pour varier.
 */
function balanced(candidates: Clue[], inGame: readonly Person[], rng: Rng): Clue | null {
  if (!candidates.length || !inGame.length) return null;
  const scored = candidates.map((clue) => {
    const share = inGame.filter((p) => nameMatches(clue, p)).length / inGame.length;
    return { clue, gap: Math.abs(share - CLUE_SHARE) };
  });
  const best = Math.min(...scored.map((s) => s.gap));
  const near = scored.filter((s) => s.gap <= best + 0.08);
  return near[rng(near.length)]!.clue;
}

/**
 * Indice de la semaine `week` (1 à 5), sur un Krampus encore caché. De plus en plus précis :
 * une lettre de son prénom, la longueur de son prénom, deux innocents, puis un trio qui cache
 * un Krampus. Les deux premiers laissent toujours environ la moitié des joueurs suspects.
 */
export function makeClue(week: number, people: readonly (Person & Player)[], rng: Rng): Clue | null {
  const grinchs = people.filter((p) => p.role === "gr" && !p.out);
  const innocents = people.filter((p) => p.role === "pn" && !p.out);
  if (!grinchs.length) return null;
  const inGame = people.filter((p) => !p.out);
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
  const kind = week === 2 ? "length" : "has";
  const truths = letterClues(kind, inGame).filter((c) => nameMatches(c, target));
  return balanced(truths, inGame, rng) ?? { t: "length", op: "max", n: letterCount(target.firstName) };
}

/**
 * Secrets personnels : chaque Père Noël reçoit le nom d'un autre Père Noël, de préférence
 * encore en jeu. Les Krampus ne reçoivent rien.
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

/** Flair : désignations portées sur un Krampus encore caché au moment du vote. */
export function flair(
  rounds: readonly { votes: readonly Vote[]; hiddenKrampus: readonly string[] }[],
): Map<string, number> {
  const out = new Map<string, number>();
  for (const r of rounds) {
    for (const v of r.votes) {
      if (r.hiddenKrampus.includes(v.target)) out.set(v.voter, (out.get(v.voter) ?? 0) + 1);
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Atouts (facultatifs, un par joueur et par partie, sans effet sur le score)
// ---------------------------------------------------------------------------

export type AtoutKind = "loupe" | "fausse_piste" | "alibi";

/** Les atouts qu'un rôle peut jouer. */
export const ATOUTS: Record<Role, AtoutKind[]> = { pn: ["loupe"], gr: ["fausse_piste", "alibi"] };

/** L'Alibi couvre la semaine où il est joué et la suivante. */
export const ALIBI_WEEKS = 2;

/** Semaines couvertes par un Alibi joué en semaine `played` (sans dépasser la dernière). */
export function alibiWeeks(played: number): number[] {
  const weeks: number[] = [];
  for (let w = played; w < played + ALIBI_WEEKS && w <= ROUNDS; w++) weeks.push(w);
  return weeks;
}

/**
 * Loupe : au moins un des deux joueurs est-il un Krampus ? Un Krampus couvert par son Alibi
 * cette semaine passe inaperçu.
 */
export function loupeResult(
  players: readonly Player[],
  targets: readonly [string, string],
  alibis: ReadonlySet<string>,
): boolean {
  return targets.some((id) => {
    const p = players.find((x) => x.id === id);
    return p?.role === "gr" && !alibis.has(id);
  });
}

/** Vrai si l'indice est exact au regard des rôles. */
export function clueIsTrue(
  clue: Clue,
  people: readonly (Person & Player)[],
  names: Map<string, string>,
): boolean {
  const hidden = people.filter((p) => p.role === "gr" && !p.out);
  const roleOf = (name: string) => people.find((p) => names.get(p.id) === name)?.role;
  switch (clue.t) {
    case "letters":
    case "range":
    case "has":
    case "length":
      return hidden.some((p) => nameMatches(clue, p));
    case "innocent":
      return clue.names.every((n) => roleOf(n) === "pn");
    case "among":
      return clue.names.some((n) => roleOf(n) === "gr");
  }
}

/**
 * Fausse piste : jusqu'à trois faux indices crédibles, du même genre que le vrai indice de la
 * semaine `week` quand c'est possible. Chacun est faux au regard des rôles.
 */
export function fakeClueOptions(week: number, people: readonly (Person & Player)[], rng: Rng): Clue[] {
  const names = displayNames(people);
  const inGame = people.filter((p) => !p.out);
  const hiddenK = inGame.filter((p) => p.role === "gr");
  const innocents = inGame.filter((p) => p.role === "pn");
  const out: Clue[] = [];
  const push = (c: Clue) => {
    if (
      out.length < 3 &&
      !out.some((o) => JSON.stringify(o) === JSON.stringify(c)) &&
      !clueIsTrue(c, people, names)
    ) {
      out.push(c);
    }
  };
  const tries = (make: () => Clue | null) => {
    for (let i = 0; i < 12 && out.length < 3; i++) {
      const c = make();
      if (c) push(c);
    }
  };
  const pick = <T>(list: readonly T[]) => list[rng(list.length)]!;
  // Faux indices sur les lettres : vrais pour aucun Krampus caché, et aussi équilibrés que les vrais.
  const lettersFake = (kind: "has" | "length") => () =>
    balanced(
      letterClues(kind, inGame).filter((c) => !clueIsTrue(c, people, names)),
      inGame,
      rng,
    );
  const has = lettersFake("has");
  const length = lettersFake("length");
  // Un Krampus et un innocent présentés comme deux innocents.
  const innocent = () =>
    hiddenK.length && innocents.length
      ? ({
          t: "innocent",
          names: shuffle([pick(hiddenK), pick(innocents)], rng).map((p) => names.get(p.id)!),
        } as Clue)
      : null;
  // Trois innocents présentés comme cachant un Krampus.
  const among = () =>
    innocents.length >= 3
      ? ({
          t: "among",
          names: shuffle(innocents, rng)
            .slice(0, 3)
            .map((p) => names.get(p.id)!),
        } as Clue)
      : null;
  const order =
    week >= 4
      ? [among, innocent, has]
      : week === 3
        ? [innocent, among, has]
        : week === 2
          ? [length, has, innocent]
          : [has, length, innocent];
  for (const make of order) tries(make);
  return out;
}

// ---------------------------------------------------------------------------
// Points personnels et classement (sans effet sur la Magie)
// ---------------------------------------------------------------------------

/**
 * Ce qui rapporte ou coûte des points à un joueur, semaine par semaine.
 * Père Noël : désigner un Krampus encore caché (flair), le faire démasquer (bonus), faire
 * démasquer un Père Noël (erreur). Krampus : traverser une semaine sans être démasqué
 * (camouflage), être démasqué, faire démasquer un Père Noël (manigance).
 */
export type PointKind = "flair" | "catch" | "wrong" | "camouflage" | "caught" | "scheme";

export const POINTS: Record<PointKind, number> = {
  flair: 2,
  catch: 1,
  wrong: -1,
  camouflage: 2,
  caught: -2,
  scheme: 2,
};

export type PointLine = { kind: PointKind; round: number; points: number; target?: string };

/**
 * Points de chacun sur les semaines résolues. `outRound` : semaine où le joueur a été
 * démasqué, `null` s'il ne l'a pas été.
 */
export function playerPoints(
  players: readonly { id: string; role: Role; outRound: number | null }[],
  rounds: readonly { round: number; votes: readonly Vote[] }[],
): Map<string, PointLine[]> {
  const out = new Map<string, PointLine[]>(players.map((p) => [p.id, []]));
  const byId = new Map(players.map((p) => [p.id, p]));
  const add = (id: string, kind: PointKind, round: number, target?: string) =>
    out.get(id)?.push({ kind, round, points: POINTS[kind], ...(target ? { target } : {}) });
  // En jeu au début de la semaine `r` : pas encore démasqué avant elle.
  const inGame = (p: { outRound: number | null }, r: number) => p.outRound === null || p.outRound >= r;
  for (const { round, votes } of [...rounds].sort((a, b) => a.round - b.round)) {
    const unmasked = players.find((p) => p.outRound === round) ?? null;
    const seen = new Set<string>();
    for (const v of votes) {
      const voter = byId.get(v.voter);
      const target = byId.get(v.target);
      if (!voter || !target || voter.id === target.id || seen.has(voter.id)) continue;
      if (!inGame(target, round) || (voter.role === "gr" && !inGame(voter, round))) continue;
      seen.add(voter.id);
      if (voter.role === "pn") {
        if (target.role === "gr") add(voter.id, "flair", round, target.id);
        if (unmasked?.id === target.id)
          add(voter.id, target.role === "gr" ? "catch" : "wrong", round, target.id);
      } else if (unmasked?.id === target.id && target.role === "pn") {
        add(voter.id, "scheme", round, target.id);
      }
    }
    for (const p of players) {
      if (p.role === "gr" && inGame(p, round))
        add(p.id, p.outRound === round ? "caught" : "camouflage", round);
    }
  }
  return out;
}

export const pointTotal = (lines: readonly PointLine[]) => lines.reduce((sum, l) => sum + l.points, 0);
