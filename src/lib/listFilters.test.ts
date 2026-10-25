import { describe, expect, it } from "vitest";
import type { ItemInfo, ListContent } from "@/types/models";
import {
  EMPTY_FILTERS,
  UNCATEGORIZED,
  applyFilters,
  displayOrder,
  groupIntoSections,
  listStats,
  parseFilters,
  serializeFilters,
} from "./listFilters";

let seq = 0;
function item(partial: Partial<ItemInfo> & { title: string | null; position: string }): ItemInfo {
  seq += 1;
  return {
    id: `i${seq}`,
    ref: `ref${seq}`,
    url: null,
    domain: null,
    description: null,
    note: null,
    priceCents: null,
    currency: "EUR",
    priceSource: null,
    priceCheckedAt: null,
    imagePath: null,
    imageWidth: null,
    imageHeight: null,
    lightBackground: false,
    isFavorite: false,
    createdAt: `2026-10-${String(10 + seq).padStart(2, "0")}T10:00:00Z`,
    categoryId: null,
    tagIds: [],
    fetchStatus: "none",
    ...partial,
  };
}

// Calqué sur supabase/seed.sql (liste « Mes 30 ans »).
const content: ListContent = {
  categories: [
    { id: "c-lecture", ref: "lec", name: "Lecture & carnets", position: "a1" },
    { id: "c-maison", ref: "mai", name: "Maison & déco", position: "a0" },
    { id: "c-musique", ref: "mus", name: "Musique", position: "a2" },
    { id: "c-sport", ref: "spo", name: "Sport", position: "a3" },
  ],
  tags: [
    { id: "t-prio", name: "Priorité", color: "rouille", position: "a0", slug: "priorite" },
    { id: "t-petit", name: "Petit prix", color: "miel", position: "a1", slug: "petit-prix" },
    { id: "t-folle", name: "Envie folle", color: "prune", position: "a2", slug: "envie-folle" },
    { id: "t-occas", name: "Seconde main OK", color: "olive", position: "a3", slug: "seconde-main-ok" },
  ],
  items: [
    item({
      title: "Lampe champignon en verre soufflé",
      position: "a0",
      categoryId: "c-maison",
      priceCents: 8900,
      isFavorite: true,
      tagIds: ["t-prio"],
      domain: "etsy.com",
      note: "En vert sauge si possible",
    }),
    item({
      title: "Fauteuil en rotin",
      position: "a1",
      categoryId: "c-maison",
      priceCents: 24000,
      tagIds: ["t-occas"],
      domain: "leboncoin.fr",
    }),
    item({
      title: "Bougie figue et cèdre",
      position: "a2",
      categoryId: "c-maison",
      priceCents: 2800,
      tagIds: ["t-petit"],
    }),
    item({
      title: "Vase boule en céramique",
      position: "a3",
      categoryId: "c-maison",
      priceCents: 7400,
      isFavorite: true,
      tagIds: ["t-occas"],
    }),
    item({
      title: "Coffret BD, intégrale en 4 tomes",
      position: "a4",
      categoryId: "c-lecture",
      priceCents: 5900,
      isFavorite: true,
      tagIds: ["t-folle"],
    }),
    item({
      title: "Liseuse 7 pouces étanche",
      position: "a5",
      categoryId: "c-lecture",
      priceCents: 19900,
      tagIds: ["t-prio"],
    }),
    item({ title: "Carnet ligné A5 en lin", position: "a6", categoryId: "c-lecture", priceCents: 1800 }),
    item({
      title: "Marque-pages en laiton, lot de 3",
      position: "a7",
      categoryId: "c-lecture",
      priceCents: 1500,
    }),
    item({ title: "Vinyle d'occasion, n'importe quel Nina Simone", position: "a8", categoryId: "c-musique" }),
    item({ title: "Gourde isotherme 750 ml", position: "a9", categoryId: "c-sport", priceCents: 3500 }),
    item({ title: "Un bon pour un massage", position: "aA" }),
    item({ title: null, position: "aB", domain: "amazon.fr" }),
  ],
};

const titles = (items: ItemInfo[]) => items.map((i) => i.title);

describe("sections", () => {
  it("4 sections dans l'ordre des catégories, puis « Non classé »", () => {
    const sections = groupIntoSections(applyFilters(content, EMPTY_FILTERS), content.categories);
    expect(sections.map((s) => s.category?.name ?? "Non classé")).toEqual([
      "Maison & déco",
      "Lecture & carnets",
      "Musique",
      "Sport",
      "Non classé",
    ]);
    expect(sections.at(-1)?.items).toHaveLength(2);
  });

  it("une section vide n'apparaît pas", () => {
    const sections = groupIntoSections(
      applyFilters(content, { ...EMPTY_FILTERS, favorites: true }),
      content.categories,
    );
    expect(sections.map((s) => s.category?.ref)).toEqual(["mai", "lec"]);
  });
});

describe("chiffres", () => {
  it("3 coups de cœur et ≈ 757 € (des prix manquent)", () => {
    expect(listStats(content.items, "EUR")).toEqual({
      count: 12,
      favorites: 3,
      totalCents: 75700,
      approximate: true,
    });
  });

  it("ignore les autres devises dans le total", () => {
    const usd = item({ title: "Import", position: "b0", priceCents: 1000, currency: "USD" });
    expect(listStats([usd], "EUR")).toEqual({ count: 1, favorites: 0, totalCents: 0, approximate: true });
  });
});

describe("filtres", () => {
  it("catégorie ET tag : Maison & déco + Seconde main OK → 2 articles", () => {
    const f = { ...EMPTY_FILTERS, category: "mai", tags: ["seconde-main-ok"] };
    expect(titles(applyFilters(content, f))).toEqual(["Fauteuil en rotin", "Vase boule en céramique"]);
  });

  it("+ coups de cœur → seulement le vase", () => {
    const f = { ...EMPTY_FILTERS, category: "mai", tags: ["seconde-main-ok"], favorites: true };
    expect(titles(applyFilters(content, f))).toEqual(["Vase boule en céramique"]);
  });

  it("tags en OU", () => {
    const f = { ...EMPTY_FILTERS, tags: ["priorite", "petit-prix"] };
    expect(titles(applyFilters(content, f))).toEqual([
      "Lampe champignon en verre soufflé",
      "Bougie figue et cèdre",
      "Liseuse 7 pouces étanche",
    ]);
  });

  it("« Non classé »", () => {
    const f = { ...EMPTY_FILTERS, category: UNCATEGORIZED };
    expect(titles(applyFilters(content, f))).toEqual(["Un bon pour un massage", null]);
  });

  it("recherche dans le nom, la note et la boutique, sans accents", () => {
    expect(titles(applyFilters(content, { ...EMPTY_FILTERS, query: "CERAMIQUE" }))).toEqual([
      "Vase boule en céramique",
    ]);
    expect(titles(applyFilters(content, { ...EMPTY_FILTERS, query: "sauge" }))).toEqual([
      "Lampe champignon en verre soufflé",
    ]);
    expect(applyFilters(content, { ...EMPTY_FILTERS, query: "leboncoin" })).toHaveLength(1);
  });

  it("prix croissant, sans prix à la fin", () => {
    const sorted = applyFilters(content, { ...EMPTY_FILTERS, order: "prix-asc" });
    expect(sorted[0]?.priceCents).toBe(1500);
    expect(sorted.slice(-3).every((i) => i.priceCents == null)).toBe(true);
  });

  it("prix décroissant, sans prix à la fin", () => {
    const sorted = applyFilters(content, { ...EMPTY_FILTERS, order: "prix-desc" });
    expect(sorted[0]?.priceCents).toBe(24000);
    expect(sorted.at(-1)?.priceCents).toBeNull();
  });

  it("ordre affiché à plat : section par section", () => {
    const order = displayOrder(content, EMPTY_FILTERS);
    expect(order[0]?.title).toBe("Lampe champignon en verre soufflé");
    expect(order[4]?.title).toBe("Coffret BD, intégrale en 4 tomes");
    expect(order).toHaveLength(12);
  });
});

describe("URL", () => {
  it("aller-retour des paramètres", () => {
    const f = {
      category: "mai",
      tags: ["priorite", "petit-prix"],
      favorites: true,
      order: "prix-asc" as const,
      query: "vase",
    };
    const params = serializeFilters(f);
    expect(params.toString()).toBe("c=mai&t=priorite%2Cpetit-prix&fav=1&o=prix-asc&q=vase");
    expect(parseFilters(params)).toEqual(f);
  });

  it("valeurs par défaut absentes de l'URL", () => {
    expect(serializeFilters(EMPTY_FILTERS).toString()).toBe("");
    expect(parseFilters(new URLSearchParams("o=nimporte"))).toEqual(EMPTY_FILTERS);
  });
});
