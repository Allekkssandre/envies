import { describe, expect, it } from "vitest";
import { byPosition, keyBetween, keysAtEndOf, keysAtStart, type Positioned } from "./positions";

// Positions du seed : a0…a9, aA, aB.
const items: Positioned[] = [
  { id: "lampe", position: "a0", categoryId: "maison" },
  { id: "fauteuil", position: "a1", categoryId: "maison" },
  { id: "bd", position: "a4", categoryId: "lecture" },
  { id: "liseuse", position: "a5", categoryId: "lecture" },
  { id: "massage", position: "aA", categoryId: null },
];

const order = (list: Positioned[]) => [...list].sort(byPosition).map((i) => i.id);

describe("positions", () => {
  it("ajout en tête : avant la première clé, dans l'ordre des lignes", () => {
    const keys = keysAtStart("a0", 5);
    expect(keys).toHaveLength(5);
    expect([...keys].sort()).toEqual(keys);
    expect(keys.at(-1)! < "a0").toBe(true);
  });

  it("ajout en tête d'une liste vide", () => {
    expect(keysAtStart(null, 2)).toHaveLength(2);
  });

  it("ajout « ici » : après le dernier article de la catégorie", () => {
    const [key] = keysAtEndOf(items, "maison", 1);
    const next = order([...items, { id: "nouveau", position: key!, categoryId: "maison" }]);
    expect(next.indexOf("nouveau")).toBe(next.indexOf("fauteuil") + 1);
  });

  it("ajout dans une catégorie vide : à la fin", () => {
    const [key] = keysAtEndOf(items, "sport", 1);
    expect(key! > "aA").toBe(true);
  });

  it("déplacer entre deux voisins", () => {
    const key = keyBetween(items, items[2], items[3]);
    expect(key > "a4" && key < "a5").toBe(true);
  });

  it("déplacer en premier ou en dernier d'une catégorie", () => {
    const first = keyBetween(items, null, items[2]);
    expect(first < "a4" && first > "a1").toBe(true);
    const last = keyBetween(items, items[3], null);
    expect(last > "a5" && last < "aA").toBe(true);
  });

  it("sans voisin : fin de la liste", () => {
    expect(keyBetween(items, null, null) > "aA").toBe(true);
  });

  it("voisins inversés : reste après `before`", () => {
    const key = keyBetween(items, items[3], items[2]);
    expect(key > "a5").toBe(true);
  });

  it("insertions répétées au même endroit : les clés restent ordonnées", () => {
    let low = "a0";
    const high = "a1";
    const list: Positioned[] = [
      { id: "x", position: low, categoryId: null },
      { id: "y", position: high, categoryId: null },
    ];
    for (let i = 0; i < 30; i++) {
      const key = keyBetween(list, { id: "x", position: low, categoryId: null }, list[1]);
      expect(key > low && key < high).toBe(true);
      low = key;
    }
  });
});
