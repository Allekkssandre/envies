"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ACCUSATIONS, PLAYERS } from "@/lib/magic/engine";
import type { MagicView } from "@/lib/magic/types";
import { hitRateLimit } from "@/server/auth/rateLimit";
import { getServiceDb } from "@/server/db/client";
import {
  advanceMagic,
  buildMagicView,
  createMagic,
  joinMagic,
  revealMagic,
  seatOf,
} from "@/server/magic/game";
import { loadLutinContext } from "@/server/santa/db";
import { hasOrganizerAccess } from "@/server/santa/session";
import { fail, GENERIC_ERROR, ok, type Result } from "./result";

// La Magie de Noël (docs/14-magie-de-noel.md). Un joueur agit avec son lien personnel ;
// l'organisation règle le jeu sans jamais voir un rôle.

const LINK_EXPIRED = "Ce lien n'est plus valable.";
const UNIQUE_VIOLATION = "23505";

function logError(where: string, error: unknown) {
  console.error(where, error instanceof Error ? error.message : error);
}

async function player(token: string) {
  const ctx = await loadLutinContext(token).catch(() => null);
  return ctx ? { santaId: ctx.santa.id, title: ctx.santa.title, id: ctx.me.id } : null;
}

/** État du jeu pour ce joueur, après avoir résolu ce qui est échu. */
export async function getMagicView(token: string): Promise<Result<MagicView>> {
  const me = await player(token);
  if (!me) return fail("NOT_FOUND", LINK_EXPIRED);
  try {
    await advanceMagic(me.santaId);
    const view = await buildMagicView(me.santaId, me.title, me.id);
    return view ? ok(view) : fail("NOT_FOUND", "Le jeu n'est pas ouvert.");
  } catch (error) {
    logError("getMagicView", error);
    return fail("INTERNAL", GENERIC_ERROR);
  }
}

const joinInput = z.enum(["pn", "gr", "inf_gr", "inf_pn"]).nullable();

export async function joinMagicGame(token: string, choice: z.input<typeof joinInput>): Promise<Result<null>> {
  const parsed = joinInput.safeParse(choice);
  const me = await player(token);
  if (!me || !parsed.success) return fail("NOT_FOUND", LINK_EXPIRED);
  try {
    await advanceMagic(me.santaId);
    const result = await joinMagic(me.santaId, me.id, parsed.data);
    return result === "missing" ? fail("NOT_FOUND", "Le jeu n'est pas ouvert.") : ok(null);
  } catch (error) {
    logError("joinMagicGame", error);
    return fail("INTERNAL", GENERIC_ERROR);
  }
}

const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;

export async function postMagicMessage(token: string, text: string): Promise<Result<null>> {
  const me = await player(token);
  if (!me) return fail("NOT_FOUND", LINK_EXPIRED);
  const body = typeof text === "string" ? text.trim() : "";
  if (!body || body.length > 1000 || CONTROL.test(body)) {
    return fail("VALIDATION", "1 000 caractères au plus.");
  }
  try {
    await advanceMagic(me.santaId);
    const seat = await seatOf(me.santaId, me.id);
    if (!seat || (seat.game.status !== "playing" && seat.game.status !== "over")) {
      return fail("CONFLICT", "Le tchat est fermé.");
    }
    const limit = await hitRateLimit(`magic-msg:${me.id}`, 40, 60);
    if (!limit.allowed) return fail("RATE_LIMITED", "Trop de messages d'un coup. Attendez une minute.");
    const { error } = await getServiceDb()
      .from("magic_messages")
      .insert({ santa_id: me.santaId, chat: seat.chat, pseudo: seat.secret.pseudo, kind: "chat", body });
    if (error) throw new Error(error.message);
    return ok(null);
  } catch (error) {
    logError("postMagicMessage", error);
    return fail("INTERNAL", GENERIC_ERROR);
  }
}

/** Vote de la manche en cours, dans le tchat où le joueur se trouve. Modifiable jusqu'à la fin du vote. */
export async function voteMagic(token: string, target: string): Promise<Result<null>> {
  const me = await player(token);
  if (!me || typeof target !== "string") return fail("NOT_FOUND", LINK_EXPIRED);
  try {
    await advanceMagic(me.santaId);
    const seat = await seatOf(me.santaId, me.id);
    if (!seat || seat.game.status !== "playing") return fail("CONFLICT", "Le vote est fermé.");
    if (!seat.sit.eligible[seat.chat].includes(target)) {
      return fail("VALIDATION", "Ce pouvoir a déjà été joué.");
    }
    const { error } = await getServiceDb()
      .from("magic_votes")
      .upsert({
        santa_id: me.santaId,
        round: seat.game.round + 1,
        chat: seat.chat,
        voter: seat.secret.pseudo,
        target,
      });
    if (error) throw new Error(error.message);
    return ok(null);
  } catch (error) {
    logError("voteMagic", error);
    return fail("INTERNAL", GENERIC_ERROR);
  }
}

const accuseInput = z.object({ targetId: z.uuid(), role: z.enum(["pn", "gr", "inf"]) });

/** Identification : définitive, deux par joueur sur toute la partie. */
export async function accuseMagic(token: string, input: z.input<typeof accuseInput>): Promise<Result<null>> {
  const parsed = accuseInput.safeParse(input);
  const me = await player(token);
  if (!me || !parsed.success) return fail("VALIDATION", GENERIC_ERROR);
  try {
    await advanceMagic(me.santaId);
    const db = getServiceDb();
    const seat = await seatOf(me.santaId, me.id);
    if (!seat || (seat.game.status !== "playing" && seat.game.status !== "over")) {
      return fail("CONFLICT", "Les identifications sont fermées.");
    }
    if (parsed.data.targetId === me.id) return fail("VALIDATION", GENERIC_ERROR);
    const [{ count }, { data: target }] = await Promise.all([
      db.from("magic_accusations").select("id", { count: "exact", head: true }).eq("accuser", me.id),
      db
        .from("magic_players")
        .select("participant_id")
        .eq("santa_id", me.santaId)
        .eq("participant_id", parsed.data.targetId)
        .maybeSingle(),
    ]);
    if (!target) return fail("NOT_FOUND", GENERIC_ERROR);
    if ((count ?? 0) >= ACCUSATIONS) return fail("CONFLICT", "Vous avez utilisé vos deux identifications.");
    const { error } = await db.from("magic_accusations").insert({
      santa_id: me.santaId,
      accuser: me.id,
      target: parsed.data.targetId,
      role: parsed.data.role,
    });
    if (error?.code === UNIQUE_VIOLATION)
      return fail("DUPLICATE", "Vous avez déjà identifié cette personne.");
    if (error) throw new Error(error.message);
    return ok(null);
  } catch (error) {
    logError("accuseMagic", error);
    return fail("INTERNAL", GENERIC_ERROR);
  }
}

// ---------------------------------------------------------------------------
// Organisation
// ---------------------------------------------------------------------------

async function organizer(santaId: string) {
  if (!z.uuid().safeParse(santaId).success) return null;
  const { data: santa } = await getServiceDb()
    .from("santas")
    .select("id, slug, status")
    .eq("id", santaId)
    .maybeSingle();
  if (!santa || !(await hasOrganizerAccess(santa.id))) return null;
  return santa;
}

const createInput = z.object({
  startsAt: z.iso.datetime(),
  roundDays: z.number().int().min(1).max(14),
  startGauge: z.number().int().min(3).max(5),
});

export async function createMagicGame(
  santaId: string,
  input: z.input<typeof createInput>,
): Promise<Result<null>> {
  const parsed = createInput.safeParse(input);
  if (!parsed.success) return fail("VALIDATION", "Vérifiez la date de début.");
  const santa = await organizer(santaId);
  if (!santa) return fail("EDIT_LOCKED", "L'organisation s'est verrouillée.");
  if (santa.status !== "launched") return fail("CONFLICT", "Lancez d'abord le tirage.");
  if (new Date(parsed.data.startsAt).getTime() <= Date.now()) {
    return fail("VALIDATION", "La date de début doit être à venir.");
  }
  try {
    const result = await createMagic(santa.id, parsed.data);
    if (result === "players") return fail("VALIDATION", `Le jeu se joue à ${PLAYERS} participants.`);
    if (result === "exists") return fail("CONFLICT", "Le jeu est déjà ouvert.");
    revalidatePath(`/lutins/${santa.slug}`);
    return ok(null);
  } catch (error) {
    logError("createMagicGame", error);
    return fail("INTERNAL", GENERIC_ERROR);
  }
}

export async function deleteMagicGame(santaId: string): Promise<Result<null>> {
  const santa = await organizer(santaId);
  if (!santa) return fail("EDIT_LOCKED", "L'organisation s'est verrouillée.");
  const { error } = await getServiceDb().from("magic_games").delete().eq("santa_id", santa.id);
  if (error) return fail("INTERNAL", GENERIC_ERROR);
  revalidatePath(`/lutins/${santa.slug}`);
  return ok(null);
}

export async function revealMagicGame(santaId: string): Promise<Result<null>> {
  const santa = await organizer(santaId);
  if (!santa) return fail("EDIT_LOCKED", "L'organisation s'est verrouillée.");
  try {
    await advanceMagic(santa.id);
    if (!(await revealMagic(santa.id))) return fail("CONFLICT", "La partie n'est pas terminée.");
    revalidatePath(`/lutins/${santa.slug}`);
    return ok(null);
  } catch (error) {
    logError("revealMagicGame", error);
    return fail("INTERNAL", GENERIC_ERROR);
  }
}
