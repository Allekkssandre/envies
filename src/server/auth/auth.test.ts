import { describe, expect, it } from "vitest";
import {
  EDIT_KEY_ALPHABET,
  editKeysMatch,
  formatEditKey,
  generateEditKey,
  normalizeEditKey,
} from "./editKey";
import { hashPassword, verifyPassword } from "./password";
import { signEditToken, verifyEditToken } from "./token";

// Hachages de supabase/seed.sql.
const SEED_BOULEAU = "scrypt$16384$8$1$ZW52aWVzLWRlbW8tc2FsdA$d9HRTj0BPKg7n7nG1nGpbdD1ZcRnj0OZcz1EZse-ho4";
const SEED_SAPIN = "scrypt$16384$8$1$ZW52aWVzLWRlbW8tc2FsdA$2ybqcXL12HynbuL-o_SYzssw-T01m3UUNkTkNgdophk";

describe("scrypt", () => {
  it("reconnaît les mots de passe du seed", async () => {
    expect(await verifyPassword("bouleau", SEED_BOULEAU)).toBe(true);
    expect(await verifyPassword("sapin", SEED_SAPIN)).toBe(true);
    expect(await verifyPassword("sapin", SEED_BOULEAU)).toBe(false);
  });

  it("hache au bon format, avec un sel différent à chaque fois", async () => {
    const a = await hashPassword("bouleau");
    const b = await hashPassword("bouleau");
    expect(a).toMatch(/^scrypt\$16384\$8\$1\$[\w-]{22}\$[\w-]{43}$/);
    expect(a).not.toBe(b);
    expect(await verifyPassword("bouleau", a)).toBe(true);
    expect(await verifyPassword("Bouleau", a)).toBe(false);
  });

  it("refuse un format inconnu", async () => {
    expect(await verifyPassword("x", "bcrypt$abc")).toBe(false);
    expect(await verifyPassword("x", "scrypt$16384$8$1$sel$")).toBe(false);
  });
});

describe("clé de modification", () => {
  it("génère XXXX-XXXX-XXXX dans l'alphabet sans ambiguïté", () => {
    for (let i = 0; i < 50; i++) {
      const key = generateEditKey();
      expect(key).toMatch(/^[2-9A-HJKMNP-Z]{4}-[2-9A-HJKMNP-Z]{4}-[2-9A-HJKMNP-Z]{4}$/);
    }
    expect(EDIT_KEY_ALPHABET).not.toMatch(/[01ILO]/);
  });

  it("normalise casse, tirets et espaces", () => {
    expect(normalizeEditKey("q8wn-4tze-k7hc")).toBe("Q8WN4TZEK7HC");
    expect(normalizeEditKey(" Q8WN 4TZE K7HC ")).toBe("Q8WN4TZEK7HC");
    expect(formatEditKey("Q8WN4TZEK7HC")).toBe("Q8WN-4TZE-K7HC");
  });

  it("refuse une clé trop courte ou avec des caractères ambigus", () => {
    expect(normalizeEditKey("Q8WN-4TZE")).toBeNull();
    expect(normalizeEditKey("Q8WN-4TZE-K7H0")).toBeNull();
    expect(normalizeEditKey("Q8WN-4TZE-K7HI")).toBeNull();
  });

  it("compare sans tenir compte de la casse ni des tirets", () => {
    expect(editKeysMatch("q8wn4tzek7hc", "Q8WN-4TZE-K7HC")).toBe(true);
    expect(editKeysMatch("Q8WN-4TZE-K7HD", "Q8WN-4TZE-K7HC")).toBe(false);
    expect(editKeysMatch("", "Q8WN-4TZE-K7HC")).toBe(false);
  });
});

describe("jeton d'édition", () => {
  const secret = "secret-de-test-secret-de-test-32";
  const now = 1_800_000_000;
  const payload = { l: "liste-1", v: 3, e: now + 3600, r: 1 as const };

  it("signe puis vérifie", () => {
    const token = signEditToken(payload, secret);
    expect(token.split(".")).toHaveLength(2);
    expect(verifyEditToken(token, secret, now)).toEqual(payload);
  });

  it("refuse un jeton expiré", () => {
    const token = signEditToken({ ...payload, e: now - 1 }, secret);
    expect(verifyEditToken(token, secret, now)).toBeNull();
  });

  it("refuse une signature altérée ou un autre secret", () => {
    const token = signEditToken(payload, secret);
    const [body, sig] = token.split(".") as [string, string];
    const flipped = sig.slice(0, -1) + (sig.endsWith("A") ? "B" : "A");
    expect(verifyEditToken(`${body}.${flipped}`, secret, now)).toBeNull();
    expect(verifyEditToken(token, "un-autre-secret-un-autre-secret", now)).toBeNull();
  });

  it("refuse une charge utile modifiée (autre liste, autre version)", () => {
    const token = signEditToken(payload, secret);
    const [, sig] = token.split(".") as [string, string];
    const forged = Buffer.from(JSON.stringify({ ...payload, l: "liste-2" })).toString("base64url");
    expect(verifyEditToken(`${forged}.${sig}`, secret, now)).toBeNull();
  });

  it("garde la version pour la comparer à auth_version", () => {
    const token = signEditToken({ l: "liste-1", v: 1, e: now + 10 }, secret);
    expect(verifyEditToken(token, secret, now)?.v).toBe(1);
  });

  it("refuse les jetons mal formés", () => {
    expect(verifyEditToken("", secret, now)).toBeNull();
    expect(verifyEditToken("abc", secret, now)).toBeNull();
    expect(verifyEditToken("a.b.c", secret, now)).toBeNull();
  });
});
