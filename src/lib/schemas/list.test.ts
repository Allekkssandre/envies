import { describe, expect, it } from "vitest";
import { createListSchema, fieldErrors } from "./list";

const valid = {
  title: "  Noël   2026 ",
  ownerName: " Merin ",
  password: "abcd",
  description: "",
  ambiance: "feuillage" as const,
};

describe("createListSchema", () => {
  it("nettoie les espaces", () => {
    const parsed = createListSchema.parse(valid);
    expect(parsed.title).toBe("Noël 2026");
    expect(parsed.ownerName).toBe("Merin");
  });

  it("messages de 12-textes.md", () => {
    const result = createListSchema.safeParse({ ...valid, title: "  ", ownerName: "", password: "abc" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(fieldErrors(result.error)).toEqual({
        title: "Donnez un nom à la liste.",
        ownerName: "Indiquez votre prénom.",
        password: "4 caractères au moins.",
      });
    }
  });

  it("limites de longueur (titre 80, prénom 40, petit mot 500)", () => {
    expect(createListSchema.safeParse({ ...valid, title: "a".repeat(80) }).success).toBe(true);
    expect(createListSchema.safeParse({ ...valid, title: "a".repeat(81) }).success).toBe(false);
    expect(createListSchema.safeParse({ ...valid, ownerName: "a".repeat(41) }).success).toBe(false);
    expect(createListSchema.safeParse({ ...valid, description: "a".repeat(501) }).success).toBe(false);
  });

  it("refuse les caractères de contrôle et une ambiance inconnue", () => {
    expect(createListSchema.safeParse({ ...valid, title: "Noël\u0007" }).success).toBe(false);
    expect(createListSchema.safeParse({ ...valid, ambiance: "neige" }).success).toBe(false);
  });

  it("4 caractères suffisent, sans autre règle", () => {
    expect(createListSchema.safeParse({ ...valid, password: "aaaa" }).success).toBe(true);
  });
});
