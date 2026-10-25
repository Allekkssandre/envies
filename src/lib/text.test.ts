import { describe, expect, it } from "vitest";
import { formatRelative, formatDayMonth } from "./relativeDate";
import { buildSearchQuery } from "./searchQuery";
import { normalizeText, plural, slugify } from "./text";
import { encodeQuery, SEARCH_SITES } from "@/config/search-sites";
import { formatTotal } from "./format";

const plain = (s: string) => s.replace(/[  ]/g, " ");

describe("texte", () => {
  it("normalise sans accents", () => {
    expect(normalizeText("  Noël  ÉTÉ ")).toBe("noel ete");
  });

  it("slugifie", () => {
    expect(slugify("Mes 30 ans")).toBe("mes-30-ans");
    expect(slugify("Seconde main OK")).toBe("seconde-main-ok");
    expect(slugify("Appart à Lyon")).toBe("appart-a-lyon");
    expect(slugify("Jo & Sam’s")).toBe("jo-et-sams");
    expect(slugify("!!!")).toBe("");
  });

  it("accorde le pluriel", () => {
    expect(plain(plural(1, "article", "articles"))).toBe("1 article");
    expect(plain(plural(1240, "article", "articles"))).toBe("1 240 articles");
  });

  it("total arrondi, avec ≈", () => {
    expect(plain(formatTotal(75700, "EUR", true))).toBe("≈ 757 €");
    expect(plain(formatTotal(124049))).toBe("1 240 €");
  });
});

describe("dates relatives", () => {
  const now = new Date(2026, 9, 25, 15, 0);
  it.each([
    [new Date(2026, 9, 25, 14, 59, 40), "à l'instant"],
    [new Date(2026, 9, 25, 14, 58), "il y a 2 min"],
    [new Date(2026, 9, 25, 12, 0), "il y a 3 h"],
    [new Date(2026, 9, 24, 23, 0), "hier"],
    [new Date(2026, 9, 23, 9, 0), "il y a 2 jours"],
    [new Date(2026, 9, 12, 9, 0), "le 12 octobre"],
    [new Date(2025, 9, 12, 9, 0), "le 12 octobre 2025"],
  ])("%s → %s", (date, expected) => {
    expect(formatRelative(date, now)).toBe(expected);
  });

  it("jour et mois", () => {
    expect(formatDayMonth(new Date(2026, 9, 12), now)).toBe("le 12 octobre");
  });
});

describe("buildSearchQuery", () => {
  it.each([
    ["Lampe champignon en verre soufflé", "lampe champignon en verre soufflé"],
    ["La Bougie figue (édition limitée)", "bougie figue"],
    ["Robe lin taille M [réf. 42]", "robe lin"],
    ["Écouteurs B0C7XQ0000 sans fil", "écouteurs sans fil"],
    ["Marque-pages en laiton, lot de 3", "marque pages en laiton lot de 3"],
    ["Gourde isotherme 750 ml", "gourde isotherme 750 ml"],
    [
      "Un très long nom avec beaucoup trop de mots pour une recherche",
      "très long nom avec beaucoup trop de mots",
    ],
  ])("%s", (title, expected) => {
    expect(buildSearchQuery({ title })).toBe(expected);
  });

  it("sans nom : les mots du lien", () => {
    expect(buildSearchQuery({ url: "https://www.etsy.com/fr/listing/123/lampe-champignon-verre" })).toBe(
      "lampe champignon verre",
    );
  });
});

describe("liens de recherche", () => {
  it("encode avec des +", () => {
    expect(encodeQuery("lampe champignon soufflé")).toBe("lampe+champignon+souffl%C3%A9");
  });

  it("9 sites, URL https", () => {
    expect(SEARCH_SITES).toHaveLength(9);
    for (const site of SEARCH_SITES) expect(site.url("a+b")).toMatch(/^https:\/\/[^ ]+a\+b/);
  });
});
