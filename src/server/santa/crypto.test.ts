import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

beforeAll(() => {
  process.env.SANTA_SECRET_KEY = "test-test-test-test-test-test-test-test";
});

const { decryptAssignment, encryptAssignment, hashToken, looksLikeToken, newToken } =
  await import("./crypto");

describe("tirage chiffré", () => {
  const value = { receiverId: "r-1", themeId: "t-1" };

  it("se relit pour le même participant", () => {
    const stored = encryptAssignment("s", "p", value);
    expect(stored).not.toContain("r-1");
    expect(decryptAssignment("s", "p", stored)).toEqual(value);
  });

  it("ne se lit pas pour un autre participant ou un autre Secret Santa", () => {
    const stored = encryptAssignment("s", "p", value);
    expect(decryptAssignment("s", "autre", stored)).toBeNull();
    expect(decryptAssignment("autre", "p", stored)).toBeNull();
  });

  it("refuse une valeur modifiée", () => {
    const stored = encryptAssignment("s", "p", value);
    const parts = stored.split(".");
    const body = Buffer.from(parts[2]!, "base64url");
    body[0] = body[0]! ^ 1;
    parts[2] = body.toString("base64url");
    expect(decryptAssignment("s", "p", parts.join("."))).toBeNull();
    expect(decryptAssignment("s", "p", "n'importe quoi")).toBeNull();
  });

  it("deux chiffrements du même tirage diffèrent", () => {
    expect(encryptAssignment("s", "p", value)).not.toBe(encryptAssignment("s", "p", value));
  });
});

describe("liens personnels", () => {
  it("32 caractères, uniques, gardés en empreinte", () => {
    const a = newToken();
    expect(looksLikeToken(a)).toBe(true);
    expect(newToken()).not.toBe(a);
    expect(hashToken(a)).toMatch(/^[0-9a-f]{64}$/);
    expect(looksLikeToken("trop-court")).toBe(false);
  });
});
