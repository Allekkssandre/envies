import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

// Secret du tirage (docs/13-secret-santa.md § Secret) :
// - le tirage de chaque participant est chiffré en AES-256-GCM avec SANTA_SECRET_KEY,
//   et lié à ce participant (données associées) : une ligne recopiée sur une autre ne se lit pas ;
// - le lien personnel n'est gardé qu'en empreinte SHA-256.

export type Assignment = { receiverId: string; themeId: string };

const VERSION = "v1";

function key(): Buffer {
  const value = process.env.SANTA_SECRET_KEY;
  if (!value || value.length < 32) throw new Error("SANTA_SECRET_KEY manquant ou trop court");
  // Toute chaîne d'au moins 32 caractères : dérivée en 32 octets.
  return createHash("sha256").update(`envies-santa:${value}`).digest();
}

const context = (santaId: string, participantId: string) => Buffer.from(`${santaId}:${participantId}`);

export function encryptAssignment(santaId: string, participantId: string, value: Assignment): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  cipher.setAAD(context(santaId, participantId));
  const body = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
  return [
    VERSION,
    iv.toString("base64url"),
    body.toString("base64url"),
    cipher.getAuthTag().toString("base64url"),
  ].join(".");
}

/** Tirage déchiffré, ou `null` si la valeur est illisible, modifiée ou d'un autre participant. */
export function decryptAssignment(santaId: string, participantId: string, stored: string): Assignment | null {
  const [version, iv, body, tag] = stored.split(".");
  if (version !== VERSION || !iv || !body || !tag) return null;
  try {
    const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64url"));
    decipher.setAAD(context(santaId, participantId));
    decipher.setAuthTag(Buffer.from(tag, "base64url"));
    const text = Buffer.concat([decipher.update(Buffer.from(body, "base64url")), decipher.final()]).toString(
      "utf8",
    );
    const data: unknown = JSON.parse(text);
    if (typeof data !== "object" || data === null) return null;
    const { receiverId, themeId } = data as Record<string, unknown>;
    return typeof receiverId === "string" && typeof themeId === "string" ? { receiverId, themeId } : null;
  } catch {
    return null;
  }
}

/** Nouveau lien personnel : 32 caractères base64url (192 bits). */
export function newToken(): string {
  return randomBytes(24).toString("base64url");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Forme d'un lien personnel, avant toute lecture en base. */
export function looksLikeToken(token: string): boolean {
  return /^[A-Za-z0-9_-]{32}$/.test(token);
}

/**
 * Chiffrement d'une valeur liée à un contexte (La Magie de Noël : rôle d'un joueur).
 * Même clé et même algorithme que le tirage ; le contexte empêche de recopier une ligne ailleurs.
 */
export function encryptSecret(scope: string, value: unknown): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  cipher.setAAD(Buffer.from(scope));
  const body = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
  return [
    VERSION,
    iv.toString("base64url"),
    body.toString("base64url"),
    cipher.getAuthTag().toString("base64url"),
  ].join(".");
}

export function decryptSecret(scope: string, stored: string): unknown {
  const [version, iv, body, tag] = stored.split(".");
  if (version !== VERSION || !iv || !body || !tag) return null;
  try {
    const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64url"));
    decipher.setAAD(Buffer.from(scope));
    decipher.setAuthTag(Buffer.from(tag, "base64url"));
    const text = Buffer.concat([decipher.update(Buffer.from(body, "base64url")), decipher.final()]);
    return JSON.parse(text.toString("utf8")) as unknown;
  } catch {
    return null;
  }
}
