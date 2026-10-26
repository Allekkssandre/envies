import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { assignTarget, detectHeader, guessColumns, isTruthy, normalizeHeader, type Target } from "./columns";
import { convertRows, splitTags } from "./convert";
import { decodeCsv, detectSeparator, readFile } from "./read";

const columnsOf = (rows: string[][]) => rows[0]!.map((_, c) => rows.slice(1).map((r) => r[c] ?? ""));

async function load(path: string, name = path) {
  const res = await readFile(new Uint8Array(readFileSync(path)), name);
  if (!res.ok) throw new Error(res.error);
  return res.sheets[0]!;
}

describe("import-45.xlsx (maquette ImportV4)", () => {
  it("correspondance devinée : celle de la maquette", async () => {
    const sheet = await load("tests/fixtures/import-45.xlsx");
    expect(sheet.name).toBe("Liste");
    expect(sheet.rows).toHaveLength(46);
    expect(sheet.letters).toEqual(["A", "B", "C", "D", "E", "F", "G", "H"]);
    expect(detectHeader(sheet.rows[0]!)).toBe(true);
    const guess = guessColumns(sheet.rows[0]!, columnsOf(sheet.rows));
    expect(guess.targets).toEqual(["title", "url", "price", "category", "favorite", "tags", "note", "skip"]);
    expect(guess.guessed).toEqual([true, true, true, true, true, true, true, false]);
  });

  it("43 articles, 2 doublons ; 2 nouvelles catégories quand Déco et Livres existent", async () => {
    const sheet = await load("tests/fixtures/import-45.xlsx");
    const guess = guessColumns(sheet.rows[0]!, columnsOf(sheet.rows));
    const result = convertRows(sheet.rows, sheet.links, guess.targets, sheet.rows[0]!, {
      headerRow: true,
      listCurrency: "EUR",
      existingKeys: new Set(),
      existingCategories: ["Déco", "Livres"],
      existingTags: ["Petit prix"],
    });
    expect(result.total).toBe(45);
    expect(result.duplicates).toBe(2);
    expect(result.empty).toBe(0);
    expect(result.rows).toHaveLength(43);
    expect(result.newCategories).toEqual(["Jardin", "Cuisine"]);
    expect(result.newTags).toEqual(["occasion", "cadeau commun"]);
    expect(result.rows[0]).toEqual({
      title: "Lampe champignon",
      url: "https://www.etsy.com/fr/listing/1290573870/lampe-champignon",
      priceCents: 8900,
      currency: "EUR",
      category: "Déco",
      tags: ["petit prix"],
      isFavorite: true,
      note: "vert sauge",
      imageUrl: null,
    });
    expect(result.rows[2]).toMatchObject({ title: "Liseuse 7 pouces", priceCents: 19990, isFavorite: true });
  });

  it("un lien déjà dans la liste compte comme doublon", async () => {
    const sheet = await load("tests/fixtures/import-45.xlsx");
    const guess = guessColumns(sheet.rows[0]!, columnsOf(sheet.rows));
    const result = convertRows(sheet.rows, sheet.links, guess.targets, sheet.rows[0]!, {
      headerRow: true,
      listCurrency: "EUR",
      existingKeys: new Set(["fnac.com/a17000001/liseuse"]),
      existingCategories: [],
      existingTags: [],
    });
    expect(result.duplicates).toBe(3);
    expect(result.rows).toHaveLength(42);
  });
});

describe("CSV", () => {
  it("séparateur ; et accents en Windows-1252", async () => {
    const text =
      "Nom;Prix;Catégorie;Coup de cœur\nThéière en fonte;45,90 €;Cuisine;oui\nPelle à tarte;12;Cuisine;\nRosier grimpant;29,5;Jardin;x\n";
    // Windows-1252 : « œ » est 0x9C, « € » 0x80, les lettres accentuées sont celles du latin-1.
    const cp1252: Record<string, number> = { œ: 0x9c, "€": 0x80 };
    const bytes = new Uint8Array([...text].map((ch) => cp1252[ch] ?? ch.charCodeAt(0)));
    expect(decodeCsv(bytes)).toBe(text);
    const res = await readFile(bytes, "envies.csv");
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const sheet = res.sheets[0]!;
    expect(sheet.rows[0]).toEqual(["Nom", "Prix", "Catégorie", "Coup de cœur"]);
    expect(sheet.rows[1]).toEqual(["Théière en fonte", "45,90 €", "Cuisine", "oui"]);
    const guess = guessColumns(sheet.rows[0]!, columnsOf(sheet.rows));
    expect(guess.targets).toEqual(["title", "price", "category", "favorite"]);
    const result = convertRows(sheet.rows, sheet.links, guess.targets, sheet.rows[0]!, {
      headerRow: true,
      listCurrency: "EUR",
      existingKeys: new Set(),
      existingCategories: [],
      existingTags: [],
    });
    expect(result.rows.map((r) => [r.title, r.priceCents, r.category, r.isFavorite])).toEqual([
      ["Théière en fonte", 4590, "Cuisine", true],
      ["Pelle à tarte", 1200, "Cuisine", false],
      ["Rosier grimpant", 2950, "Jardin", true],
    ]);
  });

  it("UTF-8 avec BOM, séparateur virgule et guillemets", async () => {
    const text = '﻿Name,Link,Price\n"Lamp, green",https://shop.example.com/lamp,"1,299.00"\n';
    const res = await readFile(new TextEncoder().encode(text), "list.csv");
    expect(res.ok && res.sheets[0]!.rows[1]).toEqual([
      "Lamp, green",
      "https://shop.example.com/lamp",
      "1,299.00",
    ]);
    expect(detectSeparator("a;b;c\n1;2;3")).toBe(";");
    expect(detectSeparator('"a,b";c\n1;2')).toBe(";");
  });
});

describe("devinette des colonnes", () => {
  it("titres normalisés (accents, ponctuation, symboles)", () => {
    expect(normalizeHeader("Prix (€)")).toBe("prix €");
    expect(normalizeHeader("Mots-clés")).toBe("mots cles");
    expect(normalizeHeader("  Acheté ? ")).toBe("achete");
  });

  it("d'après le contenu quand les titres ne disent rien", () => {
    const rows = [
      ["Colonne 1", "Colonne 2", "Colonne 3", "Colonne 4", "Colonne 5"],
      ["Vase boule en céramique", "https://a.fr/1", "45", "oui", "https://cdn.a.fr/1.jpg"],
      ["Plaid en laine", "https://a.fr/2", "89,90", "non", "https://cdn.a.fr/2.png"],
      ["Bougie", "https://a.fr/3", "12", "x", "https://cdn.a.fr/3.webp"],
    ];
    expect(guessColumns(rows[0]!, columnsOf(rows)).targets).toEqual([
      "title",
      "url",
      "price",
      "favorite",
      "image",
    ]);
  });

  it("une cible ne va qu'à une colonne", () => {
    const g = guessColumns(["Nom", "Titre", "Prix"], [["a"], ["b"], ["1"]]);
    expect(g.targets).toEqual(["title", "skip", "price"]);
    const next = assignTarget(g, 1, "title");
    expect(next.targets).toEqual(["skip", "title", "price"]);
    expect(next.guessed).toEqual([false, false, true]);
  });

  it("titres de l'export reconnus (Devise et Ajouté le ne sont pas importés)", () => {
    const headers = [
      "Nom",
      "Lien",
      "Prix",
      "Devise",
      "Catégorie",
      "Tags",
      "Coup de cœur",
      "Note",
      "Photo",
      "Ajouté le",
    ];
    const expected: Target[] = [
      "title",
      "url",
      "price",
      "skip",
      "category",
      "tags",
      "favorite",
      "note",
      "image",
      "skip",
    ];
    expect(
      guessColumns(
        headers,
        headers.map(() => []),
      ).targets,
    ).toEqual(expected);
  });

  it("première ligne de titres", () => {
    expect(detectHeader(["Article", "URL", "Prix"])).toBe(true);
    expect(detectHeader(["Lampe", "https://a.fr/1", "45"])).toBe(false);
    expect(detectHeader(["oui", "oui"])).toBe(false);
  });
});

describe("conversions", () => {
  it("coup de cœur, tags, note tronquée, nom et lien", () => {
    for (const v of ["oui", "O", "yes", "x", "1", "VRAI", "true", "✓", "✔", "♥", "❤", "*"])
      expect(isTruthy(v), v).toBe(true);
    for (const v of ["non", "0", "", "peut-être"]) expect(isTruthy(v), v).toBe(false);
    expect(splitTags("petit prix, occasion; Petit Prix / cadeau | ")).toEqual([
      "petit prix",
      "occasion",
      "cadeau",
    ]);

    const rows = [
      ["Nom", "Lien", "Note", "Photo"],
      ["", "fnac.com/a1/livre", "x".repeat(600), "https://cdn.a.fr/p.jpg"],
      ["", "pas un lien", "", ""],
      ["Carnet", "", "", "pas une url"],
    ];
    const r = convertRows(
      rows,
      rows.map((row) => row.map(() => null)),
      ["title", "url", "note", "image"],
      rows[0]!,
      {
        headerRow: true,
        listCurrency: "EUR",
        existingKeys: new Set(),
        existingCategories: [],
        existingTags: [],
      },
    );
    expect(r.empty).toBe(1);
    expect(r.rows[0]).toMatchObject({
      title: null,
      url: "https://fnac.com/a1/livre",
      imageUrl: "https://cdn.a.fr/p.jpg",
    });
    expect(r.rows[0]!.note).toHaveLength(500);
    expect(r.rows[0]!.note!.endsWith("…")).toBe(true);
    expect(r.rows[1]).toMatchObject({ title: "Carnet", url: null, imageUrl: null });
  });

  it("lien hypertexte de la cellule Nom quand il n'y a pas de colonne Lien", () => {
    const rows = [["Nom"], ["Lampe"]];
    const r = convertRows(rows, [[null], ["https://www.etsy.com/fr/listing/1/lampe"]], ["title"], rows[0]!, {
      headerRow: true,
      listCurrency: "EUR",
      existingKeys: new Set(),
      existingCategories: [],
      existingTags: [],
    });
    expect(r.rows[0]).toMatchObject({ title: "Lampe", url: "https://www.etsy.com/fr/listing/1/lampe" });
  });

  it("devise lue dans la colonne Devise de l'export", () => {
    const rows = [
      ["Nom", "Prix", "Devise"],
      ["Sac", "120", "CHF"],
    ];
    const g = guessColumns(rows[0]!, columnsOf(rows));
    const r = convertRows(
      rows,
      rows.map((row) => row.map(() => null)),
      g.targets,
      rows[0]!,
      {
        headerRow: true,
        listCurrency: "EUR",
        existingKeys: new Set(),
        existingCategories: [],
        existingTags: [],
      },
    );
    expect(r.rows[0]).toMatchObject({ priceCents: 12000, currency: "CHF" });
  });

  it("erreurs de lecture : format, taille, vide", async () => {
    expect(await readFile(new Uint8Array([1]), "photo.png")).toEqual({ ok: false, error: "format" });
    expect(await readFile(new Uint8Array(6 * 1024 * 1024), "gros.csv")).toEqual({ ok: false, error: "size" });
    expect(await readFile(new TextEncoder().encode("\n;\n"), "vide.csv")).toEqual({
      ok: false,
      error: "empty",
    });
  });
});
