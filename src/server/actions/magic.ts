"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { MAX_PLAYERS, MIN_PLAYERS } from "@/lib/magic/engine";
import type { MagicView } from "@/lib/magic/types";
import { getServiceDb } from "@/server/db/client";
import {
  advanceMagic,
  buildMagicView,
  castVote,
  createMagic,
  playAtout,
  revealMagic,
  setNote,
  writeLetter,
} from "@/server/magic/game";
import { loadLutinContext } from "@/server/santa/db";
import { hasOrganizerAccess } from "@/server/santa/session";
import { fail, GENERIC_ERROR, ok, type Result } from "./result";

// La Magie de Noël (docs/14-magie-de-noel.md). Un joueur agit avec son lien personnel ;
// l'organisation règle le jeu sans jamais voir un rôle.

const LINK_EXPIRED = "Ce lien n'est plus valable.";

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

/** Désignation de la semaine : modifiable jusqu'à la fin de la semaine, `null` la retire. */
export async function voteMagic(token: string, targetId: string | null): Promise<Result<null>> {
  if (targetId !== null && !z.uuid().safeParse(targetId).success) return fail("VALIDATION", GENERIC_ERROR);
  const me = await player(token);
  if (!me) return fail("NOT_FOUND", LINK_EXPIRED);
  try {
    await advanceMagic(me.santaId);
    const result = await castVote(me.santaId, me.id, targetId);
    if (result === "closed") return fail("CONFLICT", "La désignation est fermée.");
    if (result === "invalid") return fail("VALIDATION", "Cette personne ne peut plus être désignée.");
    return ok(null);
  } catch (error) {
    logError("voteMagic", error);
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
  level: z.enum(["pn", "balanced", "gr"]),
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
  // Une date déjà passée de quelques minutes vaut « maintenant ».
  if (new Date(parsed.data.startsAt).getTime() < Date.now() - 60 * 60 * 1000) {
    return fail("VALIDATION", "La date de début est passée.");
  }
  try {
    const result = await createMagic(santa.id, parsed.data);
    if (result === "players") {
      return fail("VALIDATION", `Le jeu se joue de ${MIN_PLAYERS} à ${MAX_PLAYERS} participants.`);
    }
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

// ---------------------------------------------------------------------------
// Facultatif : atout, courrier des lecteurs, carnet d'enquête
// ---------------------------------------------------------------------------

const atoutInput = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("loupe"), targets: z.tuple([z.uuid(), z.uuid()]) }),
  z.object({ kind: z.literal("fausse_piste"), option: z.number().int().min(0).max(2) }),
  z.object({ kind: z.literal("alibi") }),
]);

export async function playAtoutMagic(
  token: string,
  input: z.input<typeof atoutInput>,
): Promise<Result<null>> {
  const parsed = atoutInput.safeParse(input);
  const me = await player(token);
  if (!me || !parsed.success) return fail("VALIDATION", GENERIC_ERROR);
  try {
    await advanceMagic(me.santaId);
    const result = await playAtout(me.santaId, me.id, parsed.data);
    if (result === "closed") return fail("CONFLICT", "Les atouts se jouent pendant la partie.");
    if (result === "used") return fail("CONFLICT", "Vous avez déjà joué votre atout.");
    if (result === "taken") {
      return fail("CONFLICT", "Un autre Krampus a déjà préparé une fausse piste cette semaine.");
    }
    if (result === "invalid") return fail("VALIDATION", "Ce choix n'est plus possible. Rechargez la page.");
    return ok(null);
  } catch (error) {
    logError("playAtoutMagic", error);
    return fail("INTERNAL", GENERIC_ERROR);
  }
}

const LETTER_CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;

export async function writeLetterMagic(token: string, text: string | null): Promise<Result<null>> {
  const body = typeof text === "string" ? text.trim().replace(/\s+/g, " ") : null;
  if (body !== null && (body.length > 280 || LETTER_CONTROL.test(body))) {
    return fail("VALIDATION", "280 caractères au plus.");
  }
  const me = await player(token);
  if (!me) return fail("NOT_FOUND", LINK_EXPIRED);
  try {
    await advanceMagic(me.santaId);
    const done = await writeLetter(me.santaId, me.id, body || null);
    return done ? ok(null) : fail("CONFLICT", "La boîte aux lettres est fermée.");
  } catch (error) {
    logError("writeLetterMagic", error);
    return fail("INTERNAL", GENERIC_ERROR);
  }
}

const noteInput = z.object({ targetId: z.uuid(), mark: z.enum(["suspect", "innocent"]).nullable() });

export async function noteMagic(token: string, input: z.input<typeof noteInput>): Promise<Result<null>> {
  const parsed = noteInput.safeParse(input);
  const me = await player(token);
  if (!me || !parsed.success) return fail("VALIDATION", GENERIC_ERROR);
  try {
    const done = await setNote(me.santaId, me.id, parsed.data.targetId, parsed.data.mark);
    return done ? ok(null) : fail("VALIDATION", GENERIC_ERROR);
  } catch (error) {
    logError("noteMagic", error);
    return fail("INTERNAL", GENERIC_ERROR);
  }
}
