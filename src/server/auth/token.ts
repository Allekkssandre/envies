import { createHmac, timingSafeEqual } from "node:crypto";

/** Charge utile du cookie d'édition : liste, version d'accès, expiration (secondes Unix), « rester déverrouillé ». */
export type EditTokenPayload = { l: string; v: number; e: number; r?: 1 };

function mac(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

/** `base64url(JSON) + "." + base64url(HMAC-SHA256)` (docs/06-api-et-securite.md). */
export function signEditToken(payload: EditTokenPayload, secret: string): string {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${mac(body, secret)}`;
}

/** Charge utile si la signature est bonne et le jeton non expiré, sinon `null`. */
export function verifyEditToken(token: string, secret: string, nowSeconds: number): EditTokenPayload | null {
  const [body, signature, extra] = token.split(".");
  if (!body || !signature || extra !== undefined) return null;
  const expected = Buffer.from(mac(body, secret));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  try {
    const data: unknown = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if (typeof data !== "object" || data === null) return null;
    const { l, v, e, r } = data as Record<string, unknown>;
    if (typeof l !== "string" || typeof v !== "number" || typeof e !== "number") return null;
    if (e <= nowSeconds) return null;
    return r === 1 ? { l, v, e, r: 1 } : { l, v, e };
  } catch {
    return null;
  }
}
