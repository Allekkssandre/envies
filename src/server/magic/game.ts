import "server-only";
import { randomInt } from "node:crypto";
import { after } from "next/server";
import {
  CERT_ROUND,
  MAX_PLAYERS,
  MIN_PLAYERS,
  assignRoles,
  canBeTargeted,
  canVote,
  certificates,
  displayNames,
  flair,
  makeClue,
  resolveRound,
  startMagic,
  tally,
  threshold,
  validVotes,
  type Level,
  type Person,
  type Player,
  type Role,
  type Vote,
} from "@/lib/magic/engine";
import type { Gazette, MagicSummary, MagicView, RevealRow } from "@/lib/magic/types";
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

const roundEnd = (game: Pick<Game, "starts_at" | "round_days">, round: number) =>
  new Date(game.starts_at).getTime() + round * game.round_days * DAY;

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
    clue: res.end ? null : makeClue(round + 1, after, randomInt),
    certs: Boolean(certs?.size),
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
    .select("winner")
    .maybeSingle();
  if (reveal) {
    await mailEveryone(db, santaId, (p, url, title) =>
      revealMail(p.email, p.firstName, { title, url, winner: reveal.winner as Role | null }),
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
    gazettes: (gazettes ?? []).map((g) => g.data as unknown as Gazette),
    reveal:
      game.status === "revealed" && Array.isArray(game.reveal)
        ? (game.reveal as unknown as RevealRow[])
        : null,
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

export async function createMagic(
  santaId: string,
  options: { startsAt: string; roundDays: number; level: Level },
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
    const { error: roundError } = await db
      .from("magic_rounds")
      .insert({ santa_id: santaId, round: 0, data: opening as unknown as Json });
    if (roundError) throw new Error(roundError.message);
  } catch (error) {
    await db.from("magic_games").delete().eq("santa_id", santaId);
    throw error;
  }
  schedule(() => sendPendingMails(santaId));
  return "ok";
}

/** Fin de partie : rôles et flair de chacun, écrits en clair pour tous. */
export async function revealMagic(santaId: string): Promise<boolean> {
  const db = getServiceDb();
  for (let attempt = 0; attempt < 5; attempt++) {
    const game = await loadGame(db, santaId);
    if (!game || game.status !== "over") return game?.status === "revealed";
    const roster = await loadRoster(db, santaId);
    const { data: votes } = await db
      .from("magic_votes")
      .select("round, voter, target")
      .eq("santa_id", santaId);
    const hiddenAt = (round: number) =>
      roster.filter((r) => r.role === "gr" && (r.outRound === null || r.outRound >= round)).map((r) => r.id);
    const rounds = Array.from({ length: game.round }, (_, i) => i + 1).map((round) => ({
      votes: (votes ?? []).filter((v) => v.round === round),
      hiddenGrinchs: hiddenAt(round),
    }));
    const points = flair(rounds);
    const rows: RevealRow[] = roster
      .map((r) => ({
        name: `${r.firstName} ${r.lastName}`.trim(),
        role: r.role,
        outRound: r.outRound,
        flair: points.get(r.id) ?? 0,
      }))
      .sort((a, b) => b.flair - a.flair || a.name.localeCompare(b.name, "fr"));
    if (await commit(db, game, { game: { status: "revealed", reveal: rows as unknown as Json } })) {
      schedule(() => sendPendingMails(santaId));
      return true;
    }
  }
  return false;
}
