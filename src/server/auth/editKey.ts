import { randomInt, timingSafeEqual } from "node:crypto";

/** Chiffres 2–9 et majuscules sans I, L, O : rien à confondre en recopiant. */
export const EDIT_KEY_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
const LENGTH = 12;

/** Nouvelle clé `XXXX-XXXX-XXXX`. */
export function generateEditKey(): string {
  let raw = "";
  for (let i = 0; i < LENGTH; i++) raw += EDIT_KEY_ALPHABET[randomInt(EDIT_KEY_ALPHABET.length)];
  return formatEditKey(raw);
}

export function formatEditKey(raw: string): string {
  return raw.match(/.{1,4}/g)?.join("-") ?? raw;
}

/** Majuscules, sans tirets ni espaces. `null` si la saisie ne peut pas être une clé. */
export function normalizeEditKey(input: string): string | null {
  const raw = input.toUpperCase().replace(/[\s-]/g, "");
  if (raw.length !== LENGTH) return null;
  for (const c of raw) if (!EDIT_KEY_ALPHABET.includes(c)) return null;
  return raw;
}

/** Compare deux clés, insensible à la casse et aux tirets, à temps constant. */
export function editKeysMatch(input: string, stored: string): boolean {
  const a = normalizeEditKey(input);
  const b = normalizeEditKey(stored);
  if (!a || !b) return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}
