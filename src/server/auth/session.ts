import "server-only";
import { cookies } from "next/headers";
import { getServiceDb } from "@/server/db/client";
import { signEditToken, verifyEditToken, type EditTokenPayload } from "./token";

const DAY = 24 * 60 * 60;
const REMEMBER_SECONDS = 30 * DAY;
const SESSION_SECONDS = 12 * 60 * 60;
const RENEW_BELOW_SECONDS = 7 * DAY;

export const cookieName = (listId: string) => `envies_edit_${listId}`;

function secret(): string {
  const value = process.env.EDIT_TOKEN_SECRET;
  if (!value || value.length < 32) throw new Error("EDIT_TOKEN_SECRET manquant ou trop court");
  return value;
}

const nowSeconds = () => Math.floor(Date.now() / 1000);

/**
 * Pose le cookie d'édition. Coché : 30 jours, persistant. Décoché : jeton de 12 h,
 * cookie de session (effacé à la fermeture du navigateur). À appeler depuis une action serveur.
 */
export async function setEditCookie(listId: string, authVersion: number, remember: boolean): Promise<void> {
  const lifetime = remember ? REMEMBER_SECONDS : SESSION_SECONDS;
  const payload: EditTokenPayload = { l: listId, v: authVersion, e: nowSeconds() + lifetime };
  if (remember) payload.r = 1;
  (await cookies()).set(cookieName(listId), signEditToken(payload, secret()), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    ...(remember ? { maxAge: lifetime } : {}),
  });
}

/**
 * Après un changement de mot de passe ou de lien secret : nouveau cookie pour cet appareil,
 * à la nouvelle version d'accès, en gardant son choix « rester déverrouillé ».
 */
export async function reissueEditCookie(listId: string, authVersion: number): Promise<void> {
  const raw = (await cookies()).get(cookieName(listId))?.value;
  const payload = raw ? verifyEditToken(raw, secret(), nowSeconds()) : null;
  await setEditCookie(listId, authVersion, payload ? payload.r === 1 : true);
}

export async function clearEditCookie(listId: string): Promise<void> {
  (await cookies()).delete({ name: cookieName(listId), path: "/" });
}

async function currentAuthVersion(listId: string): Promise<number | null> {
  const { data } = await getServiceDb()
    .from("list_secrets")
    .select("auth_version, lists!inner(deleted_at)")
    .eq("list_id", listId)
    .is("lists.deleted_at", null)
    .maybeSingle();
  return data?.auth_version ?? null;
}

/** Jeton valide pour cette liste : signature, expiration, version d'accès. */
async function validPayload(listId: string): Promise<EditTokenPayload | null> {
  const raw = (await cookies()).get(cookieName(listId))?.value;
  if (!raw) return null;
  const payload = verifyEditToken(raw, secret(), nowSeconds());
  if (!payload || payload.l !== listId) return null;
  const version = await currentAuthVersion(listId);
  return version !== null && version === payload.v ? payload : null;
}

/** Lecture seule (rendu des pages) : l'appareil peut-il modifier cette liste ? */
export async function hasEditAccess(listId: string): Promise<boolean> {
  return (await validPayload(listId)) !== null;
}

/**
 * Pour les actions serveur : `true` si l'accès est valide. Renouvelle un jeton
 * « rester déverrouillé » qui expire dans moins de 7 jours (accès glissant).
 */
export async function requireEdit(listId: string): Promise<boolean> {
  const payload = await validPayload(listId);
  if (!payload) return false;
  if (payload.r === 1 && payload.e - nowSeconds() < RENEW_BELOW_SECONDS) {
    await setEditCookie(listId, payload.v, true);
  }
  return true;
}
