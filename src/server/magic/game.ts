import "server-only";
import { randomInt } from "node:crypto";
import {
  ACCUSATIONS,
  PLAYERS,
  ROUNDS,
  assignJoin,
  campOf,
  chatOf,
  checkRoster,
  joinOption,
  letterCount,
  resolveRound,
  scores,
  tally,
  type AccusedRole,
  type Chat,
  type GrCard,
  type PlayerSecret,
  type PnCard,
  type Role,
} from "@/lib/magic/engine";
import type {
  Gazette,
  MagicMember,
  MagicMessage,
  MagicSummary,
  MagicView,
  RevealRow,
  SystemNote,
} from "@/lib/magic/types";
import { getServiceDb, type Db } from "@/server/db/client";
import { decryptSecret, encryptSecret } from "@/server/santa/crypto";
import type { Json, Tables } from "@/types/database";

// La Magie de Noël côté serveur (docs/14-magie-de-noel.md).
// L'état avance « à la demande » : chaque lecture résout d'abord ce qui est échu (fin du choix
// des camps, fin d'un vote). Chaque changement est écrit d'un bloc par `magic_commit`, qui
// refuse si un autre appel a écrit entre-temps ; on relit alors et on recommence.

type Game = Tables<"magic_games">;
const DAY = 24 * 60 * 60 * 1000;
const other = (chat: Chat): Chat => (chat === "pn" ? "gr" : "pn");

const scope = (santaId: string, participantId: string) => `${santaId}:${participantId}:magic`;

function parseSecret(value: unknown): PlayerSecret | null {
  if (typeof value !== "object" || value === null) return null;
  const { role, pseudo, card } = value as Record<string, unknown>;
  return typeof role === "string" && typeof pseudo === "string" && typeof card === "string"
    ? ({ role, pseudo, card } as PlayerSecret)
    : null;
}

export type RosterEntry = { id: string; firstName: string; lastName: string; secret: PlayerSecret | null };

async function loadRoster(db: Db, santaId: string): Promise<RosterEntry[]> {
  const [{ data: players }, { data: people }] = await Promise.all([
    db.from("magic_players").select("participant_id, secret").eq("santa_id", santaId),
    db
      .from("santa_participants")
      .select("id, first_name, last_name")
      .eq("santa_id", santaId)
      .order("position"),
  ]);
  const secrets = new Map((players ?? []).map((p) => [p.participant_id, p.secret]));
  return (people ?? [])
    .filter((p) => secrets.has(p.id))
    .map((p) => {
      const stored = secrets.get(p.id);
      return {
        id: p.id,
        firstName: p.first_name,
        lastName: p.last_name,
        secret: stored ? parseSecret(decryptSecret(scope(santaId, p.id), stored)) : null,
      };
    });
}

type Commit = {
  game?: Record<string, Json>;
  players?: { id: string; secret: string }[];
  round?: { round: number; pn_pseudo: string; gr_pseudo: string; data: Json };
  closeVisits?: boolean;
  messages?: { chat: Chat; pseudo: string | null; kind: "chat" | "gazette" | "system"; body: string }[];
  visits?: { round: number; pseudo: string; chat: Chat }[];
};

async function commit(db: Db, game: Game, c: Commit): Promise<boolean> {
  const { data, error } = await db.rpc("magic_commit", {
    p_santa: game.santa_id,
    p_version: game.version,
    p_game: c.game ?? {},
    p_players: c.players ?? [],
    p_round: c.round ?? null,
    p_close_visits: c.closeVisits ?? false,
    p_messages: c.messages ?? [],
    p_visits: c.visits ?? [],
  });
  if (error) throw new Error(`magic_commit : ${error.message}`);
  return data === true;
}

const system = (chat: Chat, note: SystemNote) => ({
  chat,
  pseudo: null,
  kind: "system" as const,
  body: JSON.stringify(note),
});

async function loadGame(db: Db, santaId: string): Promise<Game | null> {
  const { data } = await db.from("magic_games").select("*").eq("santa_id", santaId).maybeSingle();
  return data;
}

type GameState = { frozenNext: boolean; maxLoss: number };
function stateOf(game: Game): GameState {
  const s =
    typeof game.state === "object" && game.state !== null && !Array.isArray(game.state) ? game.state : {};
  return { frozenNext: s.frozenNext === true, maxLoss: typeof s.maxLoss === "number" ? s.maxLoss : 0 };
}

// ---------------------------------------------------------------------------
// Déroulé automatique
// ---------------------------------------------------------------------------

/** Fin du choix des camps : les retardataires sont placés au hasard, dans un ordre tiré au sort. */
async function startGame(db: Db, game: Game): Promise<void> {
  const roster = await loadRoster(db, game.santa_id);
  if (roster.length !== PLAYERS) throw new Error("La Magie de Noël se joue à 12.");
  const joined = roster.flatMap((r) => (r.secret ? [r.secret] : []));
  const late = roster.filter((r) => !r.secret);
  for (let i = late.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [late[i], late[j]] = [late[j]!, late[i]!];
  }
  const players = late.map((r) => {
    const secret = assignJoin(joined, null, randomInt);
    joined.push(secret);
    return { id: r.id, secret: encryptSecret(scope(game.santa_id, r.id), secret) };
  });
  checkRoster(joined);
  await commit(db, game, {
    game: { status: "playing" },
    players,
    messages: [system("pn", { t: "start" }), system("gr", { t: "start" })],
  });
}

type Situation = {
  home: Record<Chat, string[]>;
  /** Pseudonymes présents dans chaque tchat : membres non partis, et visiteurs. */
  present: Record<Chat, string[]>;
  eligible: Record<Chat, string[]>;
  visitors: Record<Chat, string[]>;
  away: Set<string>;
  played: Set<string>;
};

async function situation(db: Db, santaId: string, roster: RosterEntry[]): Promise<Situation> {
  const [{ data: rounds }, { data: visits }] = await Promise.all([
    db.from("magic_rounds").select("pn_pseudo, gr_pseudo").eq("santa_id", santaId),
    db.from("magic_visits").select("pseudo, chat").eq("santa_id", santaId).is("to_message_id", null),
  ]);
  const played = new Set((rounds ?? []).flatMap((r) => [r.pn_pseudo, r.gr_pseudo]));
  const away = new Set((visits ?? []).map((v) => v.pseudo));
  const build = (chat: Chat) => {
    const home = roster.flatMap((r) => (r.secret && chatOf(r.secret.role) === chat ? [r.secret.pseudo] : []));
    const visitors = (visits ?? []).filter((v) => v.chat === chat).map((v) => v.pseudo);
    return {
      home,
      visitors,
      present: [...home.filter((p) => !away.has(p)), ...visitors],
      eligible: home.filter((p) => !played.has(p)),
    };
  };
  const pn = build("pn");
  const gr = build("gr");
  return {
    home: { pn: pn.home, gr: gr.home },
    present: { pn: pn.present, gr: gr.present },
    eligible: { pn: pn.eligible, gr: gr.eligible },
    visitors: { pn: pn.visitors, gr: gr.visitors },
    away,
    played,
  };
}

/** Fin d'un vote : un pouvoir par tchat, la jauge bouge, les gazettes partent, les visites tournent. */
async function resolveNext(db: Db, game: Game): Promise<void> {
  const round = game.round + 1;
  const roster = await loadRoster(db, game.santa_id);
  const sit = await situation(db, game.santa_id, roster);
  const { data: votes } = await db
    .from("magic_votes")
    .select("chat, voter, target")
    .eq("santa_id", game.santa_id)
    .eq("round", round);
  const pick = (chat: Chat) =>
    tally(
      (votes ?? []).filter((v) => v.chat === chat),
      sit.present[chat],
      sit.eligible[chat],
      randomInt,
    );
  const pn = pick("pn");
  const gr = pick("gr");
  const byPseudo = new Map(roster.flatMap((r) => (r.secret ? [[r.secret.pseudo, r] as const] : [])));
  const pnPlayer = byPseudo.get(pn.winner)!;
  const grPlayer = byPseudo.get(gr.winner)!;
  const state = stateOf(game);
  const res = resolveRound({
    round,
    gauge: game.gauge,
    frozen: state.frozenNext,
    maxLoss: state.maxLoss,
    pnCard: pnPlayer.secret!.card as PnCard | "espion",
    grCard: grPlayer.secret!.card as GrCard | "espion",
  });
  const over = res.grinchsWin || round >= ROUNDS;
  const winner: Chat | undefined = res.grinchsWin ? "gr" : round >= ROUNDS ? "pn" : undefined;

  const grinchs = roster.filter((r) => r.secret && campOf(r.secret.role) === "gr");
  const shared = {
    round,
    blocked: res.blocked,
    loss: res.loss,
    gain: res.gain,
    before: game.gauge,
    after: res.gaugeAfter,
  };
  const gazettePn: Gazette = {
    ...shared,
    camp: "pn",
    played: pn.winner,
    drawn: pn.tie || pn.noVote,
    frozen: state.frozenNext,
    nature: res.blocked ? res.nature : res.natureShown,
    ...(res.lanterne ? { lanterne: letterCount(grinchs[randomInt(grinchs.length)]!.firstName) } : {}),
    ...(res.corrupteur ? { corrupteur: letterCount(grPlayer.firstName) } : {}),
    ...(winner ? { winner } : {}),
  };
  const gazetteGr: Gazette = {
    ...shared,
    camp: "gr",
    played: gr.winner,
    drawn: gr.tie || gr.noVote,
    ...(winner ? { winner } : {}),
  };

  const messages: NonNullable<Commit["messages"]> = [];
  // Retour des visiteurs de la manche précédente, annoncé dans leur tchat.
  for (const chat of ["pn", "gr"] as const) {
    for (const pseudo of sit.visitors[chat]) messages.push(system(other(chat), { t: "retour", pseudo }));
  }
  messages.push({ chat: "pn", pseudo: null, kind: "gazette", body: JSON.stringify(gazettePn) });
  messages.push({ chat: "gr", pseudo: null, kind: "gazette", body: JSON.stringify(gazetteGr) });
  const visits: NonNullable<Commit["visits"]> = [];
  if (res.pnVisit) {
    messages.push(
      system("pn", { t: "depart", pseudo: pn.winner }),
      system("gr", { t: "arrive", pseudo: pn.winner }),
    );
    visits.push({ round, pseudo: pn.winner, chat: "gr" });
  }
  if (res.grVisit) {
    messages.push(
      system("gr", { t: "depart", pseudo: gr.winner }),
      system("pn", { t: "arrive", pseudo: gr.winner }),
    );
    visits.push({ round, pseudo: gr.winner, chat: "pn" });
  }

  await commit(db, game, {
    game: {
      gauge: res.gaugeAfter,
      round,
      state: { frozenNext: res.frozenNext, maxLoss: res.maxLossAfter },
      ...(over ? { status: "over", winner: winner ?? "pn" } : {}),
    },
    round: {
      round,
      pn_pseudo: pn.winner,
      gr_pseudo: gr.winner,
      data: { pnCard: pnPlayer.secret!.card, grCard: grPlayer.secret!.card, ...res } as Json,
    },
    closeVisits: true,
    messages,
    visits,
  });
}

/** Résout tout ce qui est échu. Sans effet s'il n'y a rien à faire. Ne lève pas. */
export async function advanceMagic(santaId: string, now = Date.now()): Promise<void> {
  const db = getServiceDb();
  try {
    for (let step = 0; step < 10; step++) {
      const game = await loadGame(db, santaId);
      if (!game) return;
      const start = new Date(game.starts_at).getTime();
      if (game.status === "joining" && now >= start) await startGame(db, game);
      else if (game.status === "playing" && now >= start + (game.round + 1) * game.round_days * DAY) {
        await resolveNext(db, game);
      } else return;
    }
  } catch (error) {
    console.error("advanceMagic", error instanceof Error ? error.message : error);
  }
}

// ---------------------------------------------------------------------------
// Joueur
// ---------------------------------------------------------------------------

export type JoinResult = "joined" | "closed" | "missing";

/** Rejoindre le jeu : l'ordre d'arrivée est l'ordre des écritures réussies. */
export async function joinMagic(
  santaId: string,
  participantId: string,
  choice: Role | null,
): Promise<JoinResult> {
  const db = getServiceDb();
  for (let attempt = 0; attempt < 8; attempt++) {
    const game = await loadGame(db, santaId);
    if (!game) return "missing";
    if (game.status !== "joining") return "closed";
    const roster = await loadRoster(db, santaId);
    const me = roster.find((r) => r.id === participantId);
    if (!me) return "missing";
    if (me.secret) return "joined";
    const joined = roster.flatMap((r) => (r.secret ? [r.secret] : []));
    const secret = assignJoin(joined, choice, randomInt);
    const done = await commit(db, game, {
      players: [{ id: participantId, secret: encryptSecret(scope(santaId, participantId), secret) }],
    });
    if (done) return "joined";
  }
  throw new Error("joinMagic : trop de tentatives");
}

function toMessage(row: Tables<"magic_messages">, myPseudo: string): MagicMessage | null {
  if (row.kind === "chat") {
    return {
      id: row.id,
      kind: "chat",
      pseudo: row.pseudo ?? "",
      text: row.body,
      mine: row.pseudo === myPseudo,
    };
  }
  try {
    const data = JSON.parse(row.body) as unknown;
    return row.kind === "gazette"
      ? { id: row.id, kind: "gazette", gazette: data as Gazette }
      : { id: row.id, kind: "system", note: data as SystemNote };
  } catch {
    return null;
  }
}

export type Seat = { game: Game; secret: PlayerSecret; chat: Chat; visiting: boolean; sit: Situation };

/** Où le joueur se trouve en ce moment : son tchat, ou celui qu'il visite. */
export async function seatOf(santaId: string, participantId: string): Promise<Seat | null> {
  const db = getServiceDb();
  const game = await loadGame(db, santaId);
  if (!game || game.status === "joining") return null;
  const roster = await loadRoster(db, santaId);
  const secret = roster.find((r) => r.id === participantId)?.secret;
  if (!secret) return null;
  const sit = await situation(db, santaId, roster);
  const visiting = sit.away.has(secret.pseudo);
  return { game, secret, sit, visiting, chat: visiting ? other(chatOf(secret.role)) : chatOf(secret.role) };
}

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
  const { data: mine } = await db
    .from("magic_accusations")
    .select("target, role")
    .eq("santa_id", santaId)
    .eq("accuser", participantId)
    .order("id");
  const nameOf = (r: RosterEntry) => `${r.firstName} ${r.lastName}`.trim();
  const names = new Map(roster.map((r) => [r.id, nameOf(r)]));
  const playing = game.status === "playing";
  const round = playing ? game.round + 1 : null;

  const view: MagicView = {
    title,
    status: game.status,
    startsAt: game.starts_at,
    roundDays: game.round_days,
    startGauge: game.start_gauge,
    gauge: game.gauge,
    round,
    deadline: round
      ? new Date(new Date(game.starts_at).getTime() + round * game.round_days * DAY).toISOString()
      : null,
    winner: game.winner,
    me: me.secret,
    joinOption:
      game.status === "joining" && !me.secret
        ? joinOption(roster.flatMap((r) => (r.secret ? [r.secret] : [])))
        : null,
    chat: null,
    accusations: {
      open: Boolean(me.secret) && (playing || game.status === "over"),
      left: Math.max(0, ACCUSATIONS - (mine?.length ?? 0)),
      mine: (mine ?? []).map((a) => ({ name: names.get(a.target) ?? "", role: a.role })),
      people: roster.filter((r) => r.id !== participantId).map((r) => ({ id: r.id, name: nameOf(r) })),
    },
    reveal:
      game.status === "revealed" && Array.isArray(game.reveal)
        ? (game.reveal as unknown as RevealRow[])
        : null,
  };
  if (!me.secret || game.status === "joining") return view;

  const sit = await situation(db, santaId, roster);
  const myPseudo = me.secret.pseudo;
  const visiting = sit.away.has(myPseudo);
  const chat = visiting ? other(chatOf(me.secret.role)) : chatOf(me.secret.role);
  let fromId = 0;
  if (visiting) {
    const { data: visit } = await db
      .from("magic_visits")
      .select("from_message_id")
      .eq("santa_id", santaId)
      .eq("pseudo", myPseudo)
      .is("to_message_id", null)
      .maybeSingle();
    fromId = visit?.from_message_id ?? Number.MAX_SAFE_INTEGER;
  }
  const { data: rows } = await db
    .from("magic_messages")
    .select("*")
    .eq("santa_id", santaId)
    .eq("chat", chat)
    .gt("id", fromId)
    .order("id", { ascending: false })
    .limit(300);
  const members: MagicMember[] = [
    ...sit.home[chat].map((pseudo) => ({
      pseudo,
      me: pseudo === myPseudo,
      played: sit.played.has(pseudo),
      away: sit.away.has(pseudo),
      visitor: false,
    })),
    ...sit.visitors[chat].map((pseudo) => ({
      pseudo,
      me: pseudo === myPseudo,
      played: true,
      away: false,
      visitor: true,
    })),
  ];
  let vote: NonNullable<MagicView["chat"]>["vote"] = null;
  if (round) {
    const { data: votes } = await db
      .from("magic_votes")
      .select("voter, target")
      .eq("santa_id", santaId)
      .eq("round", round)
      .eq("chat", chat);
    const valid = (votes ?? []).filter(
      (v) => sit.present[chat].includes(v.voter) && sit.eligible[chat].includes(v.target),
    );
    const counts: Record<string, number> = {};
    for (const v of valid) counts[v.target] = (counts[v.target] ?? 0) + 1;
    vote = {
      eligible: sit.eligible[chat],
      counts,
      mine: valid.find((v) => v.voter === myPseudo)?.target ?? null,
    };
  }
  view.chat = {
    id: chat,
    visiting,
    members,
    messages: (rows ?? []).reverse().flatMap((r) => toMessage(r, myPseudo) ?? []),
    canPost: playing || game.status === "over",
    vote,
  };
  return view;
}

// ---------------------------------------------------------------------------
// Organisation
// ---------------------------------------------------------------------------

export async function magicSummary(santaId: string): Promise<MagicSummary | null> {
  const game = await loadGame(getServiceDb(), santaId);
  if (!game) return null;
  return {
    status: game.status,
    startsAt: game.starts_at,
    roundDays: game.round_days,
    startGauge: game.start_gauge,
    gauge: game.gauge,
    round: game.round,
    winner: game.winner,
  };
}

export async function createMagic(
  santaId: string,
  options: { startsAt: string; roundDays: number; startGauge: number },
): Promise<"ok" | "exists" | "players"> {
  const db = getServiceDb();
  const { data: people } = await db.from("santa_participants").select("id").eq("santa_id", santaId);
  if ((people ?? []).length !== PLAYERS) return "players";
  const { error } = await db.from("magic_games").insert({
    santa_id: santaId,
    starts_at: options.startsAt,
    round_days: options.roundDays,
    start_gauge: options.startGauge,
    gauge: options.startGauge,
  });
  if (error) return "exists";
  const { error: playersError } = await db
    .from("magic_players")
    .insert((people ?? []).map((p) => ({ participant_id: p.id, santa_id: santaId })));
  if (playersError) {
    await db.from("magic_games").delete().eq("santa_id", santaId);
    throw new Error(playersError.message);
  }
  return "ok";
}

/** Fin de partie : rôles, pseudonymes, cartes et classement, écrits en clair pour tous. */
export async function revealMagic(santaId: string): Promise<boolean> {
  const db = getServiceDb();
  for (let attempt = 0; attempt < 5; attempt++) {
    const game = await loadGame(db, santaId);
    if (!game || game.status !== "over") return game?.status === "revealed";
    const roster = await loadRoster(db, santaId);
    const { data: accusations } = await db
      .from("magic_accusations")
      .select("accuser, target, role")
      .eq("santa_id", santaId);
    const players = roster.flatMap((r) => (r.secret ? [{ id: r.id, role: r.secret.role }] : []));
    const points = scores(
      players,
      (accusations ?? []) as { accuser: string; target: string; role: AccusedRole }[],
    );
    const rows: RevealRow[] = roster
      .flatMap((r) =>
        r.secret
          ? [
              {
                name: `${r.firstName} ${r.lastName}`.trim(),
                role: r.secret.role,
                pseudo: r.secret.pseudo,
                card: r.secret.card,
                ...points.get(r.id)!,
              },
            ]
          : [],
      )
      .sort((a, b) => b.points - a.points || a.name.localeCompare(b.name, "fr"));
    if (await commit(db, game, { game: { status: "revealed", reveal: rows as unknown as Json } }))
      return true;
  }
  return false;
}
