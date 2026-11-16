import "server-only";
import { createHash, randomInt } from "node:crypto";
import { after } from "next/server";
import {
  ATOUTS,
  CERT_ROUND,
  MAX_PLAYERS,
  MIN_PLAYERS,
  assignRoles,
  canBeTargeted,
  canVote,
  certificates,
  displayNames,
  fakeClueOptions,
  flair,
  loupeResult,
  makeClue,
  playerPoints,
  pointTotal,
  resolveRound,
  startMagic,
  tally,
  threshold,
  shuffle,
  validVotes,
  ROUNDS,
  type AtoutKind,
  type Clue,
  type Level,
  type Person,
  type PointKind,
  type Player,
  type Role,
  type Vote,
} from "@/lib/magic/engine";
import type {
  AtoutView,
  Gazette,
  MagicSummary,
  MagicTeaser,
  MagicView,
  NoteMark,
  RevealRow,
} from "@/lib/magic/types";
import { siteUrl } from "@/lib/siteUrl";
import { getFreshServiceDb as getServiceDb, type Db } from "@/server/db/client";
import { decryptSecret, decryptToken, encryptSecret } from "@/server/santa/crypto";
import { sendMail } from "@/server/santa/mail";
import type { Json, Tables } from "@/types/database";
import { gazetteMail, openingMail, revealMail } from "./mail";

// La Magie de Noël côté serveur (docs/14-magie-de-noel.md).
// L'état avance « à la demande » : chaque lecture résout d'abord ce qui est échu (début de la
// partie, fin d'une semaine), et le cron quotidien fait de même pour que les mails partent
// même si personne ne passe. Chaque changement est écrit d'un bloc par `magic_commit`, qui
// refuse si un autre appel a écrit entre-temps ; on relit alors et on recommence.

type Game = Tables<"magic_games">;
const DAY = 24 * 60 * 60 * 1000;

const scope = (santaId: string, participantId: string) => `${santaId}:${participantId}:magic`;

type Secret = { role: Role; cert?: string };

function parseSecret(value: unknown): Secret | null {
  if (typeof value !== "object" || value === null) return null;
  const { role, cert } = value as Record<string, unknown>;
  if (role !== "pn" && role !== "gr") return null;
  return typeof cert === "string" ? { role, cert } : { role };
}

export type Entry = Person &
  Player & { email: string; tokenEnc: string | null; cert: string | null; outRound: number | null };

async function loadRoster(db: Db, santaId: string): Promise<Entry[]> {
  const [{ data: players }, { data: people }] = await Promise.all([
    db.from("magic_players").select("participant_id, secret, out_round, out_role").eq("santa_id", santaId),
    db
      .from("santa_participants")
      .select("id, first_name, last_name, email, token_enc")
      .eq("santa_id", santaId)
      .order("position"),
  ]);
  const rows = new Map((players ?? []).map((p) => [p.participant_id, p]));
  return (people ?? []).flatMap((p) => {
    const row = rows.get(p.id);
    const secret = row ? parseSecret(decryptSecret(scope(santaId, p.id), row.secret)) : null;
    if (!row || !secret) return [];
    return [
      {
        id: p.id,
        firstName: p.first_name,
        lastName: p.last_name,
        email: p.email,
        tokenEnc: p.token_enc,
        role: secret.role,
        cert: secret.cert ?? null,
        out: row.out_round !== null,
        outRound: row.out_round,
      },
    ];
  });
}

type Commit = {
  game?: Record<string, Json>;
  players?: { id: string; secret?: string; out_round?: number; out_role?: Role }[];
  round?: { round: number; data: Json };
};

async function commit(db: Db, game: Game, c: Commit): Promise<boolean> {
  const { data, error } = await db.rpc("magic_commit", {
    p_santa: game.santa_id,
    p_version: game.version,
    p_game: c.game ?? {},
    p_players: (c.players ?? []) as unknown as Json,
    p_round: (c.round ?? null) as unknown as Json,
  });
  if (error) throw new Error(`magic_commit : ${error.message}`);
  return data === true;
}

async function loadGame(db: Db, santaId: string): Promise<Game | null> {
  const { data } = await db.from("magic_games").select("*").eq("santa_id", santaId).maybeSingle();
  return data;
}

/** Désignations des semaines déjà résolues, semaine par semaine. */
async function resolvedRounds(db: Db, game: Game): Promise<{ round: number; votes: Vote[] }[]> {
  if (game.round < 1) return [];
  const { data } = await db
    .from("magic_votes")
    .select("round, voter, target")
    .eq("santa_id", game.santa_id)
    .lte("round", game.round);
  return Array.from({ length: game.round }, (_, i) => i + 1).map((round) => ({
    round,
    votes: (data ?? []).filter((v) => v.round === round),
  }));
}

const roundEnd = (game: Pick<Game, "starts_at" | "round_days">, round: number) =>
  new Date(game.starts_at).getTime() + round * game.round_days * DAY;

// ---------------------------------------------------------------------------
// Atouts
// ---------------------------------------------------------------------------

const atoutScope = (santaId: string, participantId: string) => `${santaId}:${participantId}:atout`;

type Atout = {
  participantId: string;
  round: number;
  kind: AtoutKind;
  targets?: [string, string];
  found?: boolean;
  clue?: Clue;
};

async function loadAtouts(db: Db, santaId: string): Promise<Atout[]> {
  const { data } = await db
    .from("magic_atouts")
    .select("participant_id, round, secret")
    .eq("santa_id", santaId)
    .order("created_at");
  return (data ?? []).flatMap((row) => {
    const value = decryptSecret(atoutScope(santaId, row.participant_id), row.secret);
    if (typeof value !== "object" || value === null) return [];
    const v = value as Omit<Atout, "participantId" | "round">;
    if (v.kind !== "loupe" && v.kind !== "fausse_piste" && v.kind !== "alibi") return [];
    return [{ ...v, participantId: row.participant_id, round: row.round }];
  });
}

/** Tirage reproductible : les faux indices proposés restent les mêmes d'un affichage à l'autre. */
function seededRng(seed: string) {
  let s = createHash("sha256").update(seed).digest().readUInt32LE(0);
  return (max: number) => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return Math.floor((s / 2 ** 32) * max);
  };
}

const fakeOptions = (santaId: string, me: string, round: number, roster: Entry[]) =>
  round < ROUNDS ? fakeClueOptions(round + 1, roster, seededRng(`${santaId}:${me}:${round}`)) : [];

// ---------------------------------------------------------------------------
// Déroulé automatique
// ---------------------------------------------------------------------------

/** Fin d'une semaine : démasquage, sabotage, gazette, indice suivant, secrets personnels. */
async function resolveNext(db: Db, game: Game): Promise<void> {
  const round = game.round + 1;
  const roster = await loadRoster(db, game.santa_id);
  const { data: rows } = await db
    .from("magic_votes")
    .select("voter, target")
    .eq("santa_id", game.santa_id)
    .eq("round", round);
  const votes = validVotes(roster, rows ?? []);
  const res = resolveRound({
    round,
    magic: game.magic,
    startMagic: game.start_magic,
    players: roster,
    votes,
  });
  const { top, leaders } = tally(roster, votes);
  const names = displayNames(roster);
  const [atouts, { data: letterRows }] = await Promise.all([
    loadAtouts(db, game.santa_id),
    db.from("magic_letters").select("body").eq("santa_id", game.santa_id).eq("round", round),
  ]);
  // Fausse piste : le premier Krampus qui l'a préparée cette semaine remplace l'indice.
  const fake = atouts.find((a) => a.kind === "fausse_piste" && a.round === round && a.clue)?.clue;
  const after = roster.map((p) => (p.id === res.unmasked ? { ...p, out: true, outRound: round } : p));

  const players: NonNullable<Commit["players"]> = [];
  if (res.unmasked) players.push({ id: res.unmasked, out_round: round, out_role: res.unmaskedRole! });
  const certs = round === CERT_ROUND && !res.end ? certificates(after, randomInt) : null;
  for (const [id, cert] of certs ?? []) {
    const p = after.find((x) => x.id === id)!;
    players.push({ id, secret: encryptSecret(scope(game.santa_id, id), { role: p.role, cert }) });
  }

  const gazette: Gazette = {
    round,
    before: res.before,
    after: res.after,
    accusation: res.accusation,
    sabotage: res.sabotage,
    unmasked: res.unmasked ? { name: names.get(res.unmasked)!, role: res.unmaskedRole! } : null,
    missed: res.unmasked ? null : top === 0 ? "none" : leaders.length > 1 ? "tie" : "threshold",
    votes: votes.map((v) => ({ voter: names.get(v.voter)!, target: names.get(v.target)! })),
    clue: res.end ? null : (fake ?? makeClue(round + 1, after, randomInt)),
    certs: Boolean(certs?.size),
    letters: shuffle(
      (letterRows ?? []).map((l) => l.body),
      randomInt,
    ),
    winner: res.winner,
    end: res.end,
  };
  await commit(db, game, {
    game: { magic: res.after, round, ...(res.end ? { status: "over", winner: res.winner! } : {}) },
    players,
    round: { round, data: gazette as unknown as Json },
  });
}

/**
 * Résout tout ce qui est échu ; si une gazette est sortie, envoie ses mails après la réponse.
 * Sans effet s'il n'y a rien à faire. Ne lève pas.
 */
export async function advanceMagic(santaId: string, now = Date.now()): Promise<void> {
  const db = getServiceDb();
  try {
    let changed = false;
    for (let step = 0; step < 12; step++) {
      const game = await loadGame(db, santaId);
      if (!game) return;
      if (game.status === "waiting" && now >= new Date(game.starts_at).getTime()) {
        await commit(db, game, { game: { status: "playing" } });
      } else if (game.status === "playing" && now >= roundEnd(game, game.round + 1)) {
        await resolveNext(db, game);
        changed = true;
      } else break;
    }
    if (changed) schedule(() => sendPendingMails(santaId));
  } catch (error) {
    console.error("advanceMagic", error instanceof Error ? error.message : error);
  }
}

/** Après la réponse quand c'est possible (page, action), tout de suite sinon (cron, tests). */
function schedule(task: () => Promise<void>) {
  const run = () =>
    task().catch((error) => console.error("magic mail", error instanceof Error ? error.message : error));
  try {
    after(run);
  } catch {
    void run();
  }
}

// ---------------------------------------------------------------------------
// Mails
// ---------------------------------------------------------------------------

function personalUrl(santaId: string, p: Entry): string | null {
  if (!p.tokenEnc) return null;
  const token = decryptToken(santaId, p.id, p.tokenEnc);
  return token ? `${siteUrl()}/lutins/moi/${token}/jeu` : null;
}

async function mailEveryone(
  db: Db,
  santaId: string,
  build: (p: Entry, url: string | null, title: string) => Parameters<typeof sendMail>[0],
) {
  const [{ data: santa }, roster] = await Promise.all([
    db.from("santas").select("title").eq("id", santaId).maybeSingle(),
    loadRoster(db, santaId),
  ]);
  if (!santa) return;
  for (const p of roster) {
    const result = await sendMail(build(p, personalUrl(santaId, p), santa.title));
    if (!result.ok) console.error("magic mail", p.id, result.error);
  }
}

/**
 * Mails en attente : la dernière gazette non envoyée (les plus anciennes, rattrapées d'un coup,
 * sont marquées sans envoi), puis la révélation. Chaque envoi est réservé en base avant de partir.
 */
export async function sendPendingMails(santaId: string): Promise<void> {
  const db = getServiceDb();
  const now = new Date().toISOString();
  const { data: claimed } = await db
    .from("magic_rounds")
    .update({ mailed_at: now })
    .eq("santa_id", santaId)
    .is("mailed_at", null)
    .select("round, data");
  const latest = (claimed ?? []).sort((a, b) => b.round - a.round)[0];
  if (latest) {
    const gazette = latest.data as unknown as Gazette;
    const game = await loadGame(db, santaId);
    if (game) {
      await mailEveryone(db, santaId, (p, url, title) =>
        gazette.round === 0
          ? openingMail(p.email, p.firstName, { title, url, startsAt: game.starts_at, gazette })
          : gazetteMail(p.email, p.firstName, { title, url, gazette }),
      );
    }
  }
  const { data: reveal } = await db
    .from("magic_games")
    .update({ reveal_mailed_at: now })
    .eq("santa_id", santaId)
    .eq("status", "revealed")
    .is("reveal_mailed_at", null)
    .select("winner, reveal")
    .maybeSingle();
  if (reveal) {
    const rows = Array.isArray(reveal.reveal) ? (reveal.reveal as unknown as RevealRow[]) : [];
    const podium = rows
      .filter((r) => typeof r.points === "number")
      .slice(0, 3)
      .map((r) => ({ name: r.name, points: r.points! }));
    await mailEveryone(db, santaId, (p, url, title) =>
      revealMail(p.email, p.firstName, { title, url, winner: reveal.winner as Role | null, podium }),
    );
  }
}

// ---------------------------------------------------------------------------
// Joueur
// ---------------------------------------------------------------------------

export async function buildMagicView(
  santaId: string,
  title: string,
  participantId: string,
): Promise<MagicView | null> {
  const db = getServiceDb();
  const game = await loadGame(db, santaId);
  if (!game) return null;
  const roster = await loadRoster(db, santaId);
  const me = roster.find((r) => r.id === participantId);
  if (!me) return null;
  const playing = game.status === "playing";
  const round = playing ? game.round + 1 : null;
  const [{ data: gazettes }, { data: votes }] = await Promise.all([
    db.from("magic_rounds").select("data").eq("santa_id", santaId).order("round", { ascending: false }),
    round
      ? db.from("magic_votes").select("voter, target").eq("santa_id", santaId).eq("round", round)
      : Promise.resolve({ data: [] as Vote[] }),
  ]);
  const names = displayNames(roster);
  const current = validVotes(roster, votes ?? []);
  const [atouts, { data: letter }, { data: notes }, history] = await Promise.all([
    loadAtouts(db, santaId),
    round
      ? db
          .from("magic_letters")
          .select("body")
          .eq("santa_id", santaId)
          .eq("round", round)
          .eq("author", participantId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    db.from("magic_notes").select("target, mark").eq("santa_id", santaId).eq("owner", participantId),
    resolvedRounds(db, game),
  ]);
  // Un Père Noël ne voit pas encore le flair porté sur un joueur au rôle caché : il le trahirait.
  const revealed = game.status === "revealed";
  const outIds = new Set(roster.filter((r) => r.out).map((r) => r.id));
  const myLines = (playerPoints(roster, history).get(me.id) ?? []).filter(
    (l) => revealed || me.role === "gr" || l.kind !== "flair" || (l.target && outIds.has(l.target)),
  );
  const mine = atouts.find((a) => a.participantId === participantId);
  let atout: AtoutView;
  if (mine) {
    atout = {
      state: "used",
      kind: mine.kind,
      round: mine.round,
      ...(mine.targets && mine.found !== undefined
        ? { loupe: { names: [names.get(mine.targets[0])!, names.get(mine.targets[1])!], found: mine.found } }
        : {}),
      ...(mine.clue ? { clue: mine.clue } : {}),
    };
  } else if (!playing || (me.out && me.role === "gr")) {
    atout = { state: "locked" };
  } else {
    atout = {
      state: "ready",
      options: me.role === "gr" ? fakeOptions(santaId, me.id, round!, roster) : [],
      fakeTaken: me.role === "gr" && atouts.some((a) => a.kind === "fausse_piste" && a.round === round),
    };
  }
  return {
    title,
    status: game.status as MagicView["status"],
    startsAt: game.starts_at,
    roundDays: game.round_days,
    startMagic: game.start_magic,
    magic: game.magic,
    round,
    deadline: round ? new Date(roundEnd(game, round)).toISOString() : null,
    winner: game.winner as Role | null,
    threshold: threshold(roster.length),
    me: {
      role: me.role,
      out: me.out,
      cert: me.cert ? (names.get(me.cert) ?? null) : null,
      accomplices:
        me.role === "gr"
          ? roster
              .filter((r) => r.role === "gr" && r.id !== me.id)
              .map((r) => ({ name: names.get(r.id)!, out: r.out }))
          : [],
    },
    players: roster.map((r) => ({
      id: r.id,
      name: names.get(r.id)!,
      me: r.id === me.id,
      out: r.out ? r.role : null,
      outRound: r.outRound,
    })),
    vote: {
      mine: current.find((v) => v.voter === me.id)?.target ?? null,
      voters: current.length,
      open: playing && canVote(me),
    },
    atout,
    letter: { mine: letter?.body ?? null, open: playing },
    notes: Object.fromEntries((notes ?? []).map((n) => [n.target, n.mark as NoteMark])),
    gazettes: (gazettes ?? []).map((g) => g.data as unknown as Gazette),
    points: {
      total: pointTotal(myLines),
      lines: myLines.map((l) => ({
        kind: l.kind,
        round: l.round,
        points: l.points,
        target: l.target ? (names.get(l.target) ?? null) : null,
      })),
      pending: me.role === "pn" && !revealed,
    },
    reveal:
      game.status === "revealed" && Array.isArray(game.reveal)
        ? (game.reveal as unknown as RevealRow[])
        : null,
  };
}

/** Résumé du jeu pour la page du tirage d'un joueur ; `null` s'il n'y a pas de jeu. */
export async function magicTeaser(santaId: string, participantId: string): Promise<MagicTeaser | null> {
  const db = getServiceDb();
  const game = await loadGame(db, santaId);
  if (!game) return null;
  const round = game.status === "playing" ? game.round + 1 : null;
  const [{ data: me }, { count }] = await Promise.all([
    db
      .from("magic_players")
      .select("out_role")
      .eq("santa_id", santaId)
      .eq("participant_id", participantId)
      .maybeSingle(),
    round
      ? db
          .from("magic_votes")
          .select("voter", { count: "exact", head: true })
          .eq("santa_id", santaId)
          .eq("round", round)
          .eq("voter", participantId)
      : Promise.resolve({ count: 0 }),
  ]);
  if (!me) return null;
  return {
    status: game.status as MagicTeaser["status"],
    round,
    magic: game.magic,
    startMagic: game.start_magic,
    startsAt: game.starts_at,
    deadline: round ? new Date(roundEnd(game, round)).toISOString() : null,
    voted: Boolean(count),
    canVote: me.out_role !== "gr",
  };
}

export type VoteResult = "ok" | "closed" | "invalid";

/** Désignation de la semaine en cours, modifiable ; `null` la retire. */
export async function castVote(
  santaId: string,
  participantId: string,
  targetId: string | null,
): Promise<VoteResult> {
  const db = getServiceDb();
  const game = await loadGame(db, santaId);
  if (!game || game.status !== "playing") return "closed";
  const roster = await loadRoster(db, santaId);
  const me = roster.find((r) => r.id === participantId);
  if (!me || !canVote(me)) return "closed";
  const round = game.round + 1;
  if (targetId === null) {
    const { error } = await db
      .from("magic_votes")
      .delete()
      .eq("santa_id", santaId)
      .eq("round", round)
      .eq("voter", participantId);
    if (error) throw new Error(error.message);
    return "ok";
  }
  const target = roster.find((r) => r.id === targetId);
  if (!target || target.id === me.id || !canBeTargeted(target)) return "invalid";
  const { error } = await db
    .from("magic_votes")
    .upsert({ santa_id: santaId, round, voter: participantId, target: targetId });
  if (error) throw new Error(error.message);
  return "ok";
}

export type AtoutInput =
  { kind: "loupe"; targets: [string, string] } | { kind: "fausse_piste"; option: number } | { kind: "alibi" };

export type AtoutResult = "ok" | "closed" | "used" | "invalid" | "taken";

/** Joue l'atout du joueur, une fois dans la partie. */
export async function playAtout(
  santaId: string,
  participantId: string,
  input: AtoutInput,
): Promise<AtoutResult> {
  const db = getServiceDb();
  const game = await loadGame(db, santaId);
  if (!game || game.status !== "playing") return "closed";
  const round = game.round + 1;
  const roster = await loadRoster(db, santaId);
  const me = roster.find((r) => r.id === participantId);
  if (!me || (me.out && me.role === "gr")) return "closed";
  if (!ATOUTS[me.role].includes(input.kind)) return "invalid";
  const atouts = await loadAtouts(db, santaId);
  if (atouts.some((a) => a.participantId === me.id)) return "used";

  let secret: Omit<Atout, "participantId" | "round">;
  if (input.kind === "loupe") {
    const [a, b] = input.targets;
    const valid = (id: string) => roster.some((r) => r.id === id && r.id !== me.id && !r.out);
    if (a === b || !valid(a) || !valid(b)) return "invalid";
    const alibis = new Set(atouts.filter((x) => x.kind === "alibi").map((x) => x.participantId));
    secret = { kind: "loupe", targets: [a, b], found: loupeResult(roster, [a, b], alibis) };
  } else if (input.kind === "fausse_piste") {
    if (atouts.some((x) => x.kind === "fausse_piste" && x.round === round)) return "taken";
    const clue = fakeOptions(santaId, me.id, round, roster)[input.option];
    if (!clue) return "invalid";
    secret = { kind: "fausse_piste", clue };
  } else {
    secret = { kind: "alibi" };
  }
  const { error } = await db.from("magic_atouts").insert({
    participant_id: me.id,
    santa_id: santaId,
    round,
    secret: encryptSecret(atoutScope(santaId, me.id), secret),
  });
  if (error?.code === "23505") return "used";
  if (error) throw new Error(error.message);
  return "ok";
}

/** Lettre au courrier des lecteurs pour la semaine en cours ; `null` la retire. */
export async function writeLetter(
  santaId: string,
  participantId: string,
  body: string | null,
): Promise<boolean> {
  const db = getServiceDb();
  const game = await loadGame(db, santaId);
  if (!game || game.status !== "playing") return false;
  const { count } = await db
    .from("magic_players")
    .select("participant_id", { count: "exact", head: true })
    .eq("santa_id", santaId)
    .eq("participant_id", participantId);
  if (!count) return false;
  const round = game.round + 1;
  const { error } = body
    ? await db.from("magic_letters").upsert({
        santa_id: santaId,
        round,
        author: participantId,
        body,
        updated_at: new Date().toISOString(),
      })
    : await db
        .from("magic_letters")
        .delete()
        .eq("santa_id", santaId)
        .eq("round", round)
        .eq("author", participantId);
  if (error) throw new Error(error.message);
  return true;
}

/** Carnet d'enquête : note privée sur un autre joueur ; `null` l'efface. */
export async function setNote(
  santaId: string,
  owner: string,
  target: string,
  mark: NoteMark | null,
): Promise<boolean> {
  if (owner === target) return false;
  const db = getServiceDb();
  const { data: players } = await db
    .from("magic_players")
    .select("participant_id")
    .eq("santa_id", santaId)
    .in("participant_id", [owner, target]);
  if ((players ?? []).length !== 2) return false;
  const { error } = mark
    ? await db.from("magic_notes").upsert({ santa_id: santaId, owner, target, mark })
    : await db.from("magic_notes").delete().eq("owner", owner).eq("target", target);
  if (error) throw new Error(error.message);
  return true;
}

// ---------------------------------------------------------------------------
// Organisation
// ---------------------------------------------------------------------------

export async function magicSummary(santaId: string): Promise<MagicSummary | null> {
  const db = getServiceDb();
  const game = await loadGame(db, santaId);
  if (!game) return null;
  const { count } = await db
    .from("magic_players")
    .select("participant_id", { count: "exact", head: true })
    .eq("santa_id", santaId);
  return {
    status: game.status as MagicSummary["status"],
    startsAt: game.starts_at,
    roundDays: game.round_days,
    startMagic: game.start_magic,
    magic: game.magic,
    round: game.round,
    winner: game.winner as Role | null,
    players: count ?? 0,
  };
}

/**
 * Ouvre le jeu : rôles tirés au sort, gazette d'ouverture avec le premier indice. Le mail
 * d'ouverture part ensuite, sauf avec `silent` : le jeu s'ouvre alors en même temps que le
 * tirage, et le mail d'invitation du Secret Santa le présente (`magicInvite`).
 */
export async function createMagic(
  santaId: string,
  options: { startsAt: string; roundDays: number; level: Level; silent?: boolean },
  now = Date.now(),
): Promise<"ok" | "exists" | "players"> {
  const db = getServiceDb();
  const { data: people } = await db
    .from("santa_participants")
    .select("id, first_name, last_name")
    .eq("santa_id", santaId)
    .order("position");
  const list = people ?? [];
  if (list.length < MIN_PLAYERS || list.length > MAX_PLAYERS) return "players";
  const roles = assignRoles(
    list.map((p) => p.id),
    randomInt,
  );
  const magic = startMagic(list.length, options.level);
  const { error } = await db.from("magic_games").insert({
    santa_id: santaId,
    status: new Date(options.startsAt).getTime() <= now ? "playing" : "waiting",
    starts_at: options.startsAt,
    round_days: options.roundDays,
    start_magic: magic,
    magic,
  });
  if (error) return "exists";
  try {
    const { error: playersError } = await db.from("magic_players").insert(
      list.map((p) => ({
        participant_id: p.id,
        santa_id: santaId,
        secret: encryptSecret(scope(santaId, p.id), { role: roles.get(p.id)! }),
      })),
    );
    if (playersError) throw new Error(playersError.message);
    const everyone = list.map((p) => ({
      id: p.id,
      firstName: p.first_name,
      lastName: p.last_name,
      role: roles.get(p.id)!,
      out: false,
    }));
    const opening: Gazette = {
      round: 0,
      before: magic,
      after: magic,
      accusation: 0,
      sabotage: 0,
      unmasked: null,
      missed: null,
      votes: [],
      clue: makeClue(1, everyone, randomInt),
      certs: false,
      winner: null,
      end: null,
    };
    const { error: roundError } = await db.from("magic_rounds").insert({
      santa_id: santaId,
      round: 0,
      data: opening as unknown as Json,
      ...(options.silent ? { mailed_at: new Date(now).toISOString() } : {}),
    });
    if (roundError) throw new Error(roundError.message);
  } catch (error) {
    await db.from("magic_games").delete().eq("santa_id", santaId);
    throw error;
  }
  if (!options.silent) schedule(() => sendPendingMails(santaId));
  return "ok";
}

/** Ce que le mail d'invitation du Secret Santa dit du jeu : début et dernier indice paru. */
export async function magicInvite(santaId: string): Promise<{ startsAt: string; clue: Clue | null } | null> {
  const db = getServiceDb();
  const game = await loadGame(db, santaId);
  if (!game || game.status === "over" || game.status === "revealed") return null;
  const { data } = await db
    .from("magic_rounds")
    .select("data")
    .eq("santa_id", santaId)
    .order("round", { ascending: false })
    .limit(1)
    .maybeSingle();
  const gazette = data?.data as unknown as Gazette | undefined;
  return { startsAt: game.starts_at, clue: gazette?.clue ?? null };
}

/** Fin de partie : rôles et flair de chacun, écrits en clair pour tous. */
export async function revealMagic(santaId: string): Promise<boolean> {
  const db = getServiceDb();
  for (let attempt = 0; attempt < 5; attempt++) {
    const game = await loadGame(db, santaId);
    if (!game || game.status !== "over") return game?.status === "revealed";
    const roster = await loadRoster(db, santaId);
    const history = await resolvedRounds(db, game);
    const hiddenAt = (round: number) =>
      roster.filter((r) => r.role === "gr" && (r.outRound === null || r.outRound >= round)).map((r) => r.id);
    const flairs = flair(history.map((h) => ({ votes: h.votes, hiddenKrampus: hiddenAt(h.round) })));
    const points = playerPoints(roster, history);
    const rows: RevealRow[] = roster
      .map((r) => {
        const lines = points.get(r.id) ?? [];
        const detail: Partial<Record<PointKind, number>> = {};
        for (const l of lines) detail[l.kind] = (detail[l.kind] ?? 0) + 1;
        return {
          name: `${r.firstName} ${r.lastName}`.trim(),
          role: r.role,
          outRound: r.outRound,
          flair: flairs.get(r.id) ?? 0,
          points: pointTotal(lines),
          detail,
        };
      })
      .sort((a, b) => b.points - a.points || b.flair - a.flair || a.name.localeCompare(b.name, "fr"));
    if (await commit(db, game, { game: { status: "revealed", reveal: rows as unknown as Json } })) {
      schedule(() => sendPendingMails(santaId));
      return true;
    }
  }
  return false;
}
