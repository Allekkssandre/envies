import { randomInt } from "node:crypto";
import { describe, expect, it } from "vitest";
import { checkDraw, drawSanta, DrawError, shuffle, type DrawEntry } from "./draw";

const ids = (prefix: string, n: number) => Array.from({ length: n }, (_, i) => `${prefix}${i + 1}`);

describe("drawSanta", { timeout: 60_000 }, () => {
  it("respecte toutes les règles sur 20 000 tirages (3 à 30 personnes)", () => {
    for (let run = 0; run < 20_000; run++) {
      const n = 3 + (run % 28);
      const people = ids("p", n);
      const themes = ids("t", n + (run % 4));
      const draw = drawSanta(people, themes, randomInt);
      // checkDraw est déjà appelé dans drawSanta ; on revérifie à la main.
      expect(draw).toHaveLength(n);
      expect(new Set(draw.map((d) => d.giverId)).size).toBe(n);
      expect(new Set(draw.map((d) => d.receiverId)).size).toBe(n);
      expect(new Set(draw.map((d) => d.themeId)).size).toBe(n);
      for (const d of draw) expect(d.receiverId).not.toBe(d.giverId);
      checkDraw(draw, people, themes);
    }
  });

  it("chaque tirage valide a la même chance (3 personnes : 2 tirages, 4 personnes : 9)", () => {
    for (const [n, expected] of [
      [3, 2],
      [4, 9],
    ] as const) {
      const people = ids("p", n);
      const counts = new Map<string, number>();
      const runs = 45_000;
      for (let i = 0; i < runs; i++) {
        const key = drawSanta(people, ids("t", n), randomInt)
          .map((d) => d.receiverId)
          .join(",");
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
      expect(counts.size).toBe(expected);
      const mean = runs / expected;
      // Écart de ±6 % : très large devant l'écart attendu (≈ 1 à 2 %).
      for (const c of counts.values()) expect(Math.abs(c - mean) / mean).toBeLessThan(0.06);
    }
  });

  it("chaque thème a la même chance d'aller à chacun", () => {
    const people = ids("p", 3);
    const themes = ids("t", 5);
    const counts = new Map<string, number>();
    const runs = 30_000;
    for (let i = 0; i < runs; i++) {
      const first = drawSanta(people, themes, randomInt)[0]!;
      counts.set(first.themeId, (counts.get(first.themeId) ?? 0) + 1);
    }
    expect(counts.size).toBe(5);
    for (const c of counts.values()) expect(Math.abs(c - runs / 5) / (runs / 5)).toBeLessThan(0.06);
  });

  it("refuse les données qui ne permettent pas un tirage", () => {
    expect(() => drawSanta(ids("p", 2), ids("t", 2), randomInt)).toThrow(DrawError);
    expect(() => drawSanta(ids("p", 4), ids("t", 3), randomInt)).toThrow(DrawError);
    expect(() => drawSanta(["a", "a", "b"], ids("t", 3), randomInt)).toThrow(DrawError);
    expect(() => drawSanta(ids("p", 3), ["t", "t", "u"], randomInt)).toThrow(DrawError);
  });

  it("un hasard défaillant ne produit jamais un tirage invalide", () => {
    // Toujours le dernier indice : le mélange garde l'ordre d'origine, tout le monde se tire
    // lui-même à chaque essai → abandon, jamais de tirage enregistré.
    expect(() => drawSanta(ids("p", 4), ids("t", 4), (max) => max - 1)).toThrow(DrawError);
  });
});

describe("checkDraw", () => {
  const people = ids("p", 3);
  const themes = ids("t", 3);
  const valid: DrawEntry[] = [
    { giverId: "p1", receiverId: "p2", themeId: "t1" },
    { giverId: "p2", receiverId: "p3", themeId: "t2" },
    { giverId: "p3", receiverId: "p1", themeId: "t3" },
  ];

  it("accepte un tirage valide", () => {
    expect(() => checkDraw(valid, people, themes)).not.toThrow();
  });

  it.each([
    ["soi-même", [{ ...valid[0]!, receiverId: "p1" }, valid[1]!, valid[2]!]],
    ["reçu deux fois", [{ ...valid[0]!, receiverId: "p3" }, valid[1]!, valid[2]!]],
    ["thème en double", [valid[0]!, { ...valid[1]!, themeId: "t1" }, valid[2]!]],
    ["incomplet", [valid[0]!, valid[1]!]],
    ["inconnu", [valid[0]!, valid[1]!, { ...valid[2]!, receiverId: "x" }]],
  ])("refuse : %s", (_, draw) => {
    expect(() => checkDraw(draw, people, themes)).toThrow(DrawError);
  });
});

describe("shuffle", () => {
  it("garde les mêmes éléments", () => {
    const items = ids("x", 50);
    expect(shuffle(items, randomInt).sort()).toEqual([...items].sort());
  });
});
