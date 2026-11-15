import "server-only";
import { cookies } from "next/headers";
import { signEditToken, verifyEditToken } from "@/server/auth/token";
import { getServiceDb } from "@/server/db/client";

// Accès de l'organisation d'un Secret Santa : même jeton signé que les listes, préfixé `s:`
// (un jeton d'organisation ne vaut jamais pour une liste, et l'inverse). 30 jours.

const LIFETIME = 30 * 24 * 60 * 60;
const cookieName = (santaId: string) => `envies_santa_${santaId}`;
const nowSeconds = () => Math.floor(Date.now() / 1000);

function secret(): string {
  const value = process.env.EDIT_TOKEN_SECRET;
  if (!value || value.length < 32) throw new Error("EDIT_TOKEN_SECRET manquant ou trop court");
  return value;
}

export async function setOrganizerCookie(santaId: string, authVersion: number): Promise<void> {
  const token = signEditToken(
    { l: `s:${santaId}`, v: authVersion, e: nowSeconds() + LIFETIME, r: 1 },
    secret(),
  );
  (await cookies()).set(cookieName(santaId), token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: LIFETIME,
  });
}

export async function clearOrganizerCookie(santaId: string): Promise<void> {
  (await cookies()).delete({ name: cookieName(santaId), path: "/" });
}

/** L'appareil a-t-il accès à l'organisation de ce Secret Santa ? */
export async function hasOrganizerAccess(santaId: string): Promise<boolean> {
  const raw = (await cookies()).get(cookieName(santaId))?.value;
  if (!raw) return false;
  const payload = verifyEditToken(raw, secret(), nowSeconds());
  if (!payload || payload.l !== `s:${santaId}`) return false;
  const { data } = await getServiceDb()
    .from("santa_secrets")
    .select("auth_version")
    .eq("santa_id", santaId)
    .maybeSingle();
  return data !== null && data.auth_version === payload.v;
}
