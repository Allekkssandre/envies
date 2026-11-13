"use server";

import { z } from "zod";
import { editKeysMatch } from "@/server/auth/editKey";
import { verifyPassword } from "@/server/auth/password";
import { hitRateLimit, ipHash, unlockWindowSeconds } from "@/server/auth/rateLimit";
import { clearEditCookie, clearReadCookie, setEditCookie, setReadCookie } from "@/server/auth/session";
import { getServiceDb } from "@/server/db/client";
import { fail, GENERIC_ERROR, ok, type Result } from "./result";

const UNLOCK_MAX = 10;

const listIdSchema = z.uuid();

type Secret = { password_hash: string; edit_key: string; auth_version: number };

async function loadSecret(listId: string): Promise<Secret | null> {
  const { data } = await getServiceDb()
    .from("list_secrets")
    .select("password_hash, edit_key, auth_version, lists!inner(deleted_at)")
    .eq("list_id", listId)
    .is("lists.deleted_at", null)
    .maybeSingle();
  return data
    ? { password_hash: data.password_hash, edit_key: data.edit_key, auth_version: data.auth_version }
    : null;
}

/** Même limite pour le mot de passe et le lien secret : 10 essais par liste et par adresse. */
async function checkUnlockLimit(listId: string): Promise<Result<never> | null> {
  const limit = await hitRateLimit(`unlock:${listId}:${await ipHash()}`, UNLOCK_MAX, unlockWindowSeconds());
  if (limit.allowed) return null;
  const n = limit.retryInMinutes;
  return fail("RATE_LIMITED", `Trop d'essais. Réessayez dans ${n} ${n > 1 ? "minutes" : "minute"}.`);
}

const passwordInput = z.object({
  listId: listIdSchema,
  password: z.string().max(200),
  remember: z.boolean(),
});

export async function unlockWithPassword(input: z.input<typeof passwordInput>): Promise<Result<null>> {
  const parsed = passwordInput.safeParse(input);
  if (!parsed.success) return fail("VALIDATION", "Ce n'est pas le bon mot de passe.", "password");
  const { listId, password, remember } = parsed.data;
  try {
    const limited = await checkUnlockLimit(listId);
    if (limited) return limited;
    const secret = await loadSecret(listId);
    if (!secret) return fail("NOT_FOUND", "Cette liste n'existe pas, ou plus.");
    if (!(await verifyPassword(password, secret.password_hash))) {
      return fail("VALIDATION", "Ce n'est pas le bon mot de passe.", "password");
    }
    await setEditCookie(listId, secret.auth_version, remember);
    return ok(null);
  } catch (error) {
    console.error("unlockWithPassword", error instanceof Error ? error.message : error);
    return fail("INTERNAL", GENERIC_ERROR);
  }
}

const keyInput = z.object({ listId: listIdSchema, key: z.string().max(40) });

/** Lien secret : la clé vient du fragment `#cle=…`, lu côté navigateur. */
export async function unlockWithKey(input: z.input<typeof keyInput>): Promise<Result<null>> {
  const parsed = keyInput.safeParse(input);
  if (!parsed.success) return fail("VALIDATION", "Ce lien de modification n'est plus valable.");
  const { listId, key } = parsed.data;
  try {
    const limited = await checkUnlockLimit(listId);
    if (limited) return limited;
    const secret = await loadSecret(listId);
    if (!secret || !editKeysMatch(key, secret.edit_key)) {
      return fail("VALIDATION", "Ce lien de modification n'est plus valable.");
    }
    await setEditCookie(listId, secret.auth_version, true);
    return ok(null);
  } catch (error) {
    console.error("unlockWithKey", error instanceof Error ? error.message : error);
    return fail("INTERNAL", GENERIC_ERROR);
  }
}

/** « Verrouiller cet appareil » : supprime les cookies d'édition et de lecture de cette liste. */
export async function lockDevice(input: { listId: string }): Promise<Result<null>> {
  const parsed = listIdSchema.safeParse(input.listId);
  if (!parsed.success) return fail("VALIDATION", GENERIC_ERROR);
  await clearEditCookie(parsed.data);
  await clearReadCookie(parsed.data);
  return ok(null);
}

// ---------------------------------------------------------------------------
// Lecture d'une liste privée
// ---------------------------------------------------------------------------

type ReadSecret = Secret & { read_password_hash: string | null; read_key: string; read_version: number };

async function loadReadSecret(listId: string): Promise<ReadSecret | null> {
  const { data } = await getServiceDb()
    .from("list_secrets")
    .select(
      "password_hash, edit_key, auth_version, read_password_hash, read_key, read_version, lists!inner(deleted_at)",
    )
    .eq("list_id", listId)
    .is("lists.deleted_at", null)
    .maybeSingle();
  if (!data) return null;
  return {
    password_hash: data.password_hash,
    edit_key: data.edit_key,
    auth_version: data.auth_version,
    read_password_hash: data.read_password_hash,
    read_key: data.read_key,
    read_version: data.read_version,
  };
}

/** Résultat d'une ouverture en lecture : `edit` si c'était le mot de passe de modification. */
export type ReadUnlock = { access: "read" | "edit" };

/**
 * Ouvrir une liste privée : le mot de passe de lecture donne la lecture seule, le mot de
 * passe de modification donne la lecture et la modification.
 */
export async function unlockForReading(input: z.input<typeof passwordInput>): Promise<Result<ReadUnlock>> {
  const parsed = passwordInput.safeParse(input);
  if (!parsed.success) return fail("VALIDATION", "Ce n'est pas le bon mot de passe.", "password");
  const { listId, password, remember } = parsed.data;
  try {
    const limited = await checkUnlockLimit(listId);
    if (limited) return limited;
    const secret = await loadReadSecret(listId);
    if (!secret) return fail("NOT_FOUND", "Cette liste n'existe pas, ou plus.");
    if (secret.read_password_hash && (await verifyPassword(password, secret.read_password_hash))) {
      await setReadCookie(listId, secret.read_version, remember);
      return ok({ access: "read" });
    }
    if (await verifyPassword(password, secret.password_hash)) {
      await setEditCookie(listId, secret.auth_version, remember);
      return ok({ access: "edit" });
    }
    return fail("VALIDATION", "Ce n'est pas le bon mot de passe.", "password");
  } catch (error) {
    console.error("unlockForReading", error instanceof Error ? error.message : error);
    return fail("INTERNAL", GENERIC_ERROR);
  }
}

/** Lien de lecture : la clé vient du fragment `#acces=…`, lu côté navigateur. */
export async function unlockWithReadKey(input: z.input<typeof keyInput>): Promise<Result<null>> {
  const parsed = keyInput.safeParse(input);
  if (!parsed.success) return fail("VALIDATION", "Ce lien n'est plus valable.");
  const { listId, key } = parsed.data;
  try {
    const limited = await checkUnlockLimit(listId);
    if (limited) return limited;
    const secret = await loadReadSecret(listId);
    if (!secret || !editKeysMatch(key, secret.read_key)) {
      return fail("VALIDATION", "Ce lien n'est plus valable.");
    }
    await setReadCookie(listId, secret.read_version, true);
    return ok(null);
  } catch (error) {
    console.error("unlockWithReadKey", error instanceof Error ? error.message : error);
    return fail("INTERNAL", GENERIC_ERROR);
  }
}
