"use server";

import { randomInt } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { siteUrl } from "@/lib/siteUrl";
import { drawSanta, DrawError } from "@/lib/santa/draw";
import {
  createSantaSchema,
  draftSchema,
  launchProblems,
  participantSchema,
  profileSchema,
  settingsSchema,
  type DraftInput,
} from "@/lib/santa/schema";
import type { LutinProfile } from "@/lib/santa/types";
import { slugify } from "@/lib/text";
import { editKeysMatch, generateEditKey } from "@/server/auth/editKey";
import { hashPassword, verifyPassword } from "@/server/auth/password";
import { hitRateLimit, ipHash, unlockWindowSeconds } from "@/server/auth/rateLimit";
import { setEditCookie, setReadCookie } from "@/server/auth/session";
import { getServiceDb, type Db } from "@/server/db/client";
import { encryptAssignment, encryptToken, hashToken, newToken } from "@/server/santa/crypto";
import { loadLutinContext, type LutinContext } from "@/server/santa/db";
import { inviteMail, mailConfigured, sendMail } from "@/server/santa/mail";
import { hasOrganizerAccess, setOrganizerCookie } from "@/server/santa/session";
import type { Tables } from "@/types/database";
import { fail, GENERIC_ERROR, ok, type Result } from "./result";

// Secret Santa (docs/13-secret-santa.md). L'organisation ne lit jamais le tirage :
// aucune action ne le renvoie, sauf au lutin concerné, d'après son lien personnel.

const uuid = z.uuid();
const LOCKED = "L'organisation s'est verrouillée. Saisissez le mot de passe pour continuer.";
const NOT_FOUND = "Ce Secret Santa n'existe pas, ou plus.";
const LINK_EXPIRED = "Ce lien n'est plus valable.";
const UNIQUE_VIOLATION = "23505";

function logError(where: string, error: unknown) {
  console.error(where, error instanceof Error ? error.message : error);
}

type SantaRow = Tables<"santas">;

/** Secret Santa existant + accès de l'organisation sur cet appareil. */
async function guardSanta(
  santaId: string,
): Promise<{ ok: true; db: Db; santa: SantaRow } | { ok: false; result: Result<never> }> {
  if (!uuid.safeParse(santaId).success) return { ok: false, result: fail("NOT_FOUND", NOT_FOUND) };
  const db = getServiceDb();
  const { data: santa } = await db.from("santas").select("*").eq("id", santaId).maybeSingle();
  if (!santa) return { ok: false, result: fail("NOT_FOUND", NOT_FOUND) };
  if (!(await hasOrganizerAccess(santa.id))) return { ok: false, result: fail("EDIT_LOCKED", LOCKED) };
  return { ok: true, db, santa };
}

function revalidateSanta(slug: string) {
  revalidatePath(`/lutins/${slug}`);
}

// ---------------------------------------------------------------------------
// Création et accès
// ---------------------------------------------------------------------------

export type CreatedSanta = { slug: string; editKey: string };

export async function createSanta(input: z.input<typeof createSantaSchema>): Promise<Result<CreatedSanta>> {
  const parsed = createSantaSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return fail("VALIDATION", issue?.message ?? GENERIC_ERROR, String(issue?.path[0] ?? "title"));
  }
  const { title, password, website } = parsed.data;
  if (website && website.trim() !== "") return ok({ slug: "secret-santa", editKey: generateEditKey() });
  try {
    const limit = await hitRateLimit(`santa-create:${await ipHash()}`, 10, 60 * 60);
    if (!limit.allowed) return fail("RATE_LIMITED", "Trop de créations d'un coup. Réessayez dans une heure.");
    const db = getServiceDb();
    const stem = slugify(title, 70) || "secret-santa";
    let created: { id: string; slug: string } | null = null;
    for (let attempt = 0; attempt < 5 && !created; attempt++) {
      // Suffixe aléatoire : l'adresse de l'organisation ne se devine pas.
      const suffix = generateEditKey().replace(/-/g, "").slice(0, 6).toLowerCase();
      const { data, error } = await db
        .from("santas")
        .insert({ slug: `${stem}-${suffix}`, title })
        .select("id, slug")
        .single();
      if (data) created = data;
      else if (error?.code !== UNIQUE_VIOLATION) throw new Error(error?.message ?? "insertion impossible");
    }
    if (!created) throw new Error("aucune adresse libre");
    const editKey = generateEditKey();
    const { error } = await db
      .from("santa_secrets")
      .insert({ santa_id: created.id, password_hash: await hashPassword(password), edit_key: editKey });
    if (error) {
      await db.from("santas").delete().eq("id", created.id);
      throw new Error(error.message);
    }
    await setOrganizerCookie(created.id, 1);
    return ok({ slug: created.slug, editKey });
  } catch (error) {
    logError("createSanta", error);
    return fail("INTERNAL", GENERIC_ERROR);
  }
}

async function checkUnlockLimit(santaId: string): Promise<Result<never> | null> {
  const limit = await hitRateLimit(`santa-unlock:${santaId}:${await ipHash()}`, 10, unlockWindowSeconds());
  if (limit.allowed) return null;
  const n = limit.retryInMinutes;
  return fail("RATE_LIMITED", `Trop d'essais. Réessayez dans ${n} ${n > 1 ? "minutes" : "minute"}.`);
}

const unlockInput = z.object({
  santaId: uuid,
  password: z.string().max(200).optional(),
  key: z.string().max(40).optional(),
});

/** Mot de passe de l'organisation, ou clé du lien secret (`#cle=…`). */
export async function unlockSanta(input: z.input<typeof unlockInput>): Promise<Result<null>> {
  const parsed = unlockInput.safeParse(input);
  if (!parsed.success) return fail("VALIDATION", "Ce n'est pas le bon mot de passe.", "password");
  const { santaId, password, key } = parsed.data;
  try {
    const limited = await checkUnlockLimit(santaId);
    if (limited) return limited;
    const { data: secret } = await getServiceDb()
      .from("santa_secrets")
      .select("password_hash, edit_key, auth_version")
      .eq("santa_id", santaId)
      .maybeSingle();
    if (!secret) return fail("NOT_FOUND", NOT_FOUND);
    if (key !== undefined) {
      if (!editKeysMatch(key, secret.edit_key))
        return fail("VALIDATION", "Ce lien d'organisation n'est plus valable.");
    } else if (!password || !(await verifyPassword(password, secret.password_hash))) {
      return fail("VALIDATION", "Ce n'est pas le bon mot de passe.", "password");
    }
    await setOrganizerCookie(santaId, secret.auth_version);
    return ok(null);
  } catch (error) {
    logError("unlockSanta", error);
    return fail("INTERNAL", GENERIC_ERROR);
  }
}

/** Clé du lien secret de l'organisation (affichée à l'organisation déverrouillée). */
export async function getOrganizerKey(santaId: string): Promise<Result<string>> {
  const guard = await guardSanta(santaId);
  if (!guard.ok) return guard.result;
  const { data } = await guard.db.from("santa_secrets").select("edit_key").eq("santa_id", santaId).single();
  return data ? ok(data.edit_key) : fail("INTERNAL", GENERIC_ERROR);
}

// ---------------------------------------------------------------------------
// Préparation
// ---------------------------------------------------------------------------

/**
 * Enregistre les réglages et, tant que le tirage n'est pas lancé, les thèmes et les
 * participants (remplacés en entier). Après le lancement, seuls les réglages changent.
 */
export async function saveSantaDraft(santaId: string, input: DraftInput): Promise<Result<null>> {
  const parsed = draftSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return fail("VALIDATION", issue?.message ?? GENERIC_ERROR, issue?.path.join(".") || undefined);
  }
  const guard = await guardSanta(santaId);
  if (!guard.ok) return guard.result;
  const { db, santa } = guard;
  const { title, message, budget, exchangeDate, themes, participants } = parsed.data;
  try {
    const { error: settingsError } = await db
      .from("santas")
      .update({
        title,
        message: message || null,
        budget: budget || null,
        exchange_date: exchangeDate || null,
      })
      .eq("id", santa.id);
    if (settingsError) throw new Error(settingsError.message);
    if (santa.status === "launched") {
      revalidateSanta(santa.slug);
      return ok(null);
    }

    // Thèmes : sans vide ni doublon (casse et espaces ignorés).
    const seen = new Set<string>();
    const cleanThemes = themes.filter((t) => {
      const k = t.toLowerCase();
      if (!t || seen.has(k)) return false;
      seen.add(k);
      return true;
    });
    const emails = participants.map((p) => p.email);
    if (new Set(emails).size !== emails.length) {
      return fail("DUPLICATE", "Deux participants ont la même adresse mail.");
    }

    // Recharger le statut juste avant d'écrire : un lancement concurrent l'emporte.
    const { data: fresh } = await db.from("santas").select("status").eq("id", santa.id).single();
    if (fresh?.status !== "draft") return fail("CONFLICT", "Le tirage vient d'être lancé.");

    await db.from("santa_themes").delete().eq("santa_id", santa.id);
    if (cleanThemes.length) {
      const { error } = await db
        .from("santa_themes")
        .insert(cleanThemes.map((label, position) => ({ santa_id: santa.id, label, position })));
      if (error) throw new Error(error.message);
    }

    const { data: existing } = await db.from("santa_participants").select("id").eq("santa_id", santa.id);
    const keep = new Set(participants.map((p) => p.id).filter(Boolean));
    const removed = (existing ?? []).map((r) => r.id).filter((id) => !keep.has(id));
    if (removed.length) await db.from("santa_participants").delete().in("id", removed);
    // Adresses libérées d'abord (contrainte d'unicité), puis écriture dans l'ordre affiché.
    for (const p of participants) {
      if (p.id) {
        await db
          .from("santa_participants")
          .update({ email: `tmp-${p.id}` })
          .eq("id", p.id)
          .eq("santa_id", santa.id);
      }
    }
    for (const [position, p] of participants.entries()) {
      const row = { first_name: p.firstName, last_name: p.lastName, email: p.email, position };
      const { error } = p.id
        ? await db.from("santa_participants").update(row).eq("id", p.id).eq("santa_id", santa.id)
        : await db.from("santa_participants").insert({ ...row, santa_id: santa.id });
      if (error) throw new Error(error.message);
    }
    revalidateSanta(santa.slug);
    return ok(null);
  } catch (error) {
    logError("saveSantaDraft", error);
    return fail("INTERNAL", GENERIC_ERROR);
  }
}

// ---------------------------------------------------------------------------
// Lancement
// ---------------------------------------------------------------------------

type Recipient = { id: string; first_name: string; last_name: string; email: string };

async function sendInvite(db: Db, santa: SantaRow, person: Recipient, token: string): Promise<boolean> {
  const mail = inviteMail(person.email, `${person.first_name} ${person.last_name}`.trim(), {
    firstName: person.first_name,
    title: santa.title,
    url: `${siteUrl()}/lutins/moi/${token}`,
    message: santa.message,
    budget: santa.budget,
    exchangeDate: santa.exchange_date
      ? new Date(`${santa.exchange_date}T12:00:00Z`).toLocaleDateString("fr-FR", {
          day: "numeric",
          month: "long",
          year: "numeric",
          timeZone: "UTC",
        })
      : null,
  });
  const result = await sendMail(mail);
  await db
    .from("santa_participants")
    .update(
      result.ok
        ? { mailed_at: new Date().toISOString(), mail_error: null }
        : { mail_error: result.error.slice(0, 300) },
    )
    .eq("id", person.id);
  return result.ok;
}

export type LaunchReport = { sent: number; failed: number };

/** Tire au sort, enregistre tout d'un bloc, puis envoie un mail à chaque participant. */
export async function launchSanta(santaId: string): Promise<Result<LaunchReport>> {
  const guard = await guardSanta(santaId);
  if (!guard.ok) return guard.result;
  const { db, santa } = guard;
  if (santa.status !== "draft") return fail("CONFLICT", "Le tirage est déjà lancé.");
  if (!mailConfigured()) return fail("INTERNAL", "L'envoi des mails n'est pas configuré.");
  try {
    const [{ data: people }, { data: themes }] = await Promise.all([
      db
        .from("santa_participants")
        .select("id, first_name, last_name, email")
        .eq("santa_id", santa.id)
        .order("position"),
      db.from("santa_themes").select("id, label").eq("santa_id", santa.id).order("position"),
    ]);
    const participants = people ?? [];
    const themeRows = themes ?? [];
    const problems = launchProblems(
      themeRows.map((t) => t.label),
      participants.map((p) => p.email),
    );
    if (problems.length) return fail("VALIDATION", problems[0]!);

    let draw;
    try {
      draw = drawSanta(
        participants.map((p) => p.id),
        themeRows.map((t) => t.id),
        randomInt,
      );
    } catch (error) {
      return fail("VALIDATION", error instanceof DrawError ? error.message : GENERIC_ERROR);
    }
    const tokens = new Map(participants.map((p) => [p.id, newToken()]));
    const rows = draw.map((d) => ({
      id: d.giverId,
      token_hash: hashToken(tokens.get(d.giverId)!),
      token_enc: encryptToken(santa.id, d.giverId, tokens.get(d.giverId)!),
      assignment: encryptAssignment(santa.id, d.giverId, { receiverId: d.receiverId, themeId: d.themeId }),
    }));
    const { error } = await db.rpc("santa_launch", { p_santa: santa.id, p_rows: rows });
    if (error) {
      logError("launchSanta rpc", error.message);
      return fail("CONFLICT", "Le tirage n'a pas pu être enregistré. Rien n'a été envoyé.");
    }

    let sent = 0;
    for (const person of participants) {
      if (await sendInvite(db, santa, person, tokens.get(person.id)!)) sent++;
    }
    revalidateSanta(santa.slug);
    return ok({ sent, failed: participants.length - sent });
  } catch (error) {
    logError("launchSanta", error);
    return fail("INTERNAL", GENERIC_ERROR);
  }
}

const resendInput = z.object({ santaId: uuid, participantId: uuid, email: z.string().optional() });

/**
 * Nouveau lien pour un participant (mail perdu ou adresse corrigée). L'ancien lien ne vaut
 * plus. Son tirage ne change pas, et l'organisation ne le voit toujours pas.
 */
export async function resendInvite(input: z.input<typeof resendInput>): Promise<Result<null>> {
  const parsed = resendInput.safeParse(input);
  if (!parsed.success) return fail("VALIDATION", GENERIC_ERROR);
  const guard = await guardSanta(parsed.data.santaId);
  if (!guard.ok) return guard.result;
  const { db, santa } = guard;
  if (santa.status !== "launched") return fail("CONFLICT", "Le tirage n'est pas encore lancé.");
  try {
    let email: string | undefined;
    if (parsed.data.email !== undefined) {
      const checked = participantSchema.shape.email.safeParse(parsed.data.email);
      if (!checked.success) return fail("VALIDATION", "Cette adresse mail n'est pas valable.", "email");
      email = checked.data;
    }
    const token = newToken();
    const { data: person, error } = await db
      .from("santa_participants")
      .update({
        token_hash: hashToken(token),
        token_enc: encryptToken(santa.id, parsed.data.participantId, token),
        opened_at: null,
        ...(email ? { email } : {}),
      })
      .eq("id", parsed.data.participantId)
      .eq("santa_id", santa.id)
      .not("assignment", "is", null)
      .select("id, first_name, last_name, email")
      .maybeSingle();
    if (error?.code === UNIQUE_VIOLATION)
      return fail("DUPLICATE", "Un autre participant a déjà cette adresse.", "email");
    if (!person) return fail("NOT_FOUND", GENERIC_ERROR);
    const sentOk = await sendInvite(db, santa, person, token);
    revalidateSanta(santa.slug);
    return sentOk ? ok(null) : fail("INTERNAL", "Le mail n'est pas parti. Réessayez plus tard.");
  } catch (error) {
    logError("resendInvite", error);
    return fail("INTERNAL", GENERIC_ERROR);
  }
}

/** Tout annuler : les liens envoyés ne valent plus, le Secret Santa redevient modifiable. */
export async function cancelSanta(santaId: string): Promise<Result<null>> {
  const guard = await guardSanta(santaId);
  if (!guard.ok) return guard.result;
  const { error } = await guard.db.rpc("santa_cancel", { p_santa: guard.santa.id });
  if (error) {
    logError("cancelSanta", error.message);
    return fail("INTERNAL", GENERIC_ERROR);
  }
  revalidateSanta(guard.santa.slug);
  return ok(null);
}

/** Suppression définitive : il faut retaper le nom. Les listes d'idées des lutins partent aussi. */
export async function deleteSanta(input: { santaId: string; confirmTitle: string }): Promise<Result<null>> {
  const guard = await guardSanta(input.santaId);
  if (!guard.ok) return guard.result;
  const { db, santa } = guard;
  if (input.confirmTitle.trim() !== santa.title.trim()) {
    return fail("VALIDATION", "Le nom ne correspond pas.", "confirmTitle");
  }
  try {
    const { data: lists } = await db
      .from("santa_participants")
      .select("list_id")
      .eq("santa_id", santa.id)
      .not("list_id", "is", null);
    const listIds = (lists ?? []).map((r) => r.list_id).filter((id): id is string => Boolean(id));
    if (listIds.length) {
      await db.from("lists").update({ deleted_at: new Date().toISOString() }).in("id", listIds);
    }
    const { error } = await db.from("santas").delete().eq("id", santa.id);
    if (error) throw new Error(error.message);
    return ok(null);
  } catch (error) {
    logError("deleteSanta", error);
    return fail("INTERNAL", GENERIC_ERROR);
  }
}

export async function saveSantaSettings(
  santaId: string,
  input: z.input<typeof settingsSchema>,
): Promise<Result<null>> {
  const parsed = settingsSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return fail("VALIDATION", issue?.message ?? GENERIC_ERROR, String(issue?.path[0] ?? ""));
  }
  const guard = await guardSanta(santaId);
  if (!guard.ok) return guard.result;
  const { title, message, budget, exchangeDate } = parsed.data;
  const { error } = await guard.db
    .from("santas")
    .update({ title, message: message || null, budget: budget || null, exchange_date: exchangeDate || null })
    .eq("id", guard.santa.id);
  if (error) return fail("INTERNAL", GENERIC_ERROR);
  revalidateSanta(guard.santa.slug);
  return ok(null);
}

// ---------------------------------------------------------------------------
// Lutins (lien personnel)
// ---------------------------------------------------------------------------

async function lutin(
  token: string,
): Promise<{ ok: true; ctx: LutinContext } | { ok: false; result: Result<never> }> {
  const ctx = await loadLutinContext(token).catch(() => null);
  return ctx ? { ok: true, ctx } : { ok: false, result: fail("NOT_FOUND", LINK_EXPIRED) };
}

/** « J'ai bien noté » : seule information que l'organisation voit de la page du lutin. */
export async function confirmLutin(token: string): Promise<Result<null>> {
  const found = await lutin(token);
  if (!found.ok) return found.result;
  const { ctx } = found;
  await getServiceDb()
    .from("santa_participants")
    .update({ confirmed_at: new Date().toISOString() })
    .eq("id", ctx.me.id)
    .is("confirmed_at", null);
  revalidateSanta(ctx.santa.slug);
  return ok(null);
}

export async function saveLutinProfile(token: string, input: LutinProfile): Promise<Result<null>> {
  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) return fail("VALIDATION", parsed.error.issues[0]?.message ?? GENERIC_ERROR);
  const found = await lutin(token);
  if (!found.ok) return found.result;
  const p = parsed.data;
  const { error } = await getServiceDb()
    .from("santa_participants")
    .update({
      age: p.age || null,
      shoe_size: p.shoeSize || null,
      clothing_size: p.clothingSize || null,
      tastes: p.tastes || null,
    })
    .eq("id", found.ctx.me.id);
  return error ? fail("INTERNAL", GENERIC_ERROR) : ok(null);
}

/** Liste encore là (une liste supprimée depuis ses réglages ne compte plus). */
async function liveList(db: Db, listId: string | null) {
  if (!listId) return null;
  const { data } = await db
    .from("lists")
    .select("id, slug, list_secrets(auth_version, read_version)")
    .eq("id", listId)
    .is("deleted_at", null)
    .maybeSingle();
  return data;
}

/**
 * Ma liste d'idées : créée au premier clic (liste privée, masquée de l'accueil), puis
 * ouverte en modification sur cet appareil. Renvoie son adresse.
 */
export async function openMyList(token: string): Promise<Result<{ slug: string }>> {
  const found = await lutin(token);
  if (!found.ok) return found.result;
  const { ctx } = found;
  const db = getServiceDb();
  try {
    const existing = await liveList(db, ctx.me.list_id);
    if (existing) {
      const secrets = Array.isArray(existing.list_secrets) ? existing.list_secrets[0] : existing.list_secrets;
      await setEditCookie(existing.id, secrets?.auth_version ?? 1, true);
      return ok({ slug: existing.slug });
    }
    let created: { id: string; slug: string } | null = null;
    for (let attempt = 0; attempt < 5 && !created; attempt++) {
      const suffix = generateEditKey().replace(/-/g, "").slice(0, 8).toLowerCase();
      const { data, error } = await db
        .from("lists")
        .insert({
          slug: `idees-${slugify(ctx.me.first_name, 30) || "lutin"}-${suffix}`,
          title: "Mes idées",
          owner_name: ctx.me.first_name,
          description: `Pour mon Santa de « ${ctx.santa.title} ».`.slice(0, 500),
          ambiance: "ambre",
          is_private: true,
          hidden: true,
        })
        .select("id, slug")
        .single();
      if (data) created = data;
      else if (error?.code !== UNIQUE_VIOLATION) throw new Error(error?.message ?? "insertion impossible");
    }
    if (!created) throw new Error("aucune adresse libre");
    // Mot de passe aléatoire jamais montré : la liste s'ouvre par le lien personnel du lutin.
    const { error } = await db.from("list_secrets").insert({
      list_id: created.id,
      password_hash: await hashPassword(generateEditKey() + generateEditKey()),
      edit_key: generateEditKey(),
    });
    if (error) {
      await db.from("lists").delete().eq("id", created.id);
      throw new Error(error.message);
    }
    await db.from("santa_participants").update({ list_id: created.id }).eq("id", ctx.me.id);
    await setEditCookie(created.id, 1, true);
    return ok({ slug: created.slug });
  } catch (error) {
    logError("openMyList", error);
    return fail("INTERNAL", GENERIC_ERROR);
  }
}

/** La liste d'idées de la personne tirée : ouverte en lecture pour son Santa seulement. */
export async function openTargetList(token: string): Promise<Result<{ slug: string }>> {
  const found = await lutin(token);
  if (!found.ok) return found.result;
  const list = await liveList(getServiceDb(), found.ctx.target.list_id);
  if (!list) return fail("NOT_FOUND", `${found.ctx.target.first_name} n'a pas encore fait sa liste.`);
  const secrets = Array.isArray(list.list_secrets) ? list.list_secrets[0] : list.list_secrets;
  await setReadCookie(list.id, secrets?.read_version ?? 1, true);
  return ok({ slug: list.slug });
}
