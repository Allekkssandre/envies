import { describe, expect, it } from "vitest";
import { looksLikeUrl, normalizeUrl } from "./normalizeUrl";
import { parseManualPrice, priceToInput } from "./price";

describe("parseManualPrice", () => {
  it.each([
    ["89", 8900],
    ["89,9", 8990],
    ["89.90", 8990],
    ["1 299,99", 129999],
    ["1 299,99", 129999],
    ["1299.99 €", 129999],
    ["1.299,99", 129999],
    ["1,299.99", 129999],
    ["1.299", 129900],
    ["0,5", 50],
    ["12 €", 1200],
  ])("%s → %i", (input, cents) => {
    expect(parseManualPrice(input)).toBe(cents);
  });

  it.each(["", "-5", "abc", "1,2,3,4", "1.29,99", "10000001"])("refuse %s", (input) => {
    expect(parseManualPrice(input)).toBeNull();
  });

  it("aller-retour pour l'affichage", () => {
    expect(priceToInput(8900)).toBe("89");
    expect(priceToInput(8990)).toBe("89,90");
    expect(priceToInput(null)).toBe("");
  });
});

describe("normalizeUrl", () => {
  it("ajoute https, retire www, le fragment et le suivi, trie les paramètres", () => {
    expect(normalizeUrl("www.etsy.com/fr/listing/123/lampe/?utm_source=x&b=2&a=1&gclid=z#avis")).toEqual({
      url: "https://www.etsy.com/fr/listing/123/lampe?a=1&b=2",
      urlKey: "etsy.com/fr/listing/123/lampe?a=1&b=2",
      domain: "etsy.com",
    });
  });

  it("réduit Amazon à /dp/<ASIN>", () => {
    const n = normalizeUrl("https://www.amazon.fr/Lampe-Champignon/dp/B0C7XQ0000/ref=sr_1_1?tag=abc&psc=1");
    expect(n?.urlKey).toBe("amazon.fr/dp/b0c7xq0000");
    expect(n?.url).toBe("https://www.amazon.fr/dp/B0C7XQ0000");
    expect(normalizeUrl("amazon.fr/gp/product/B0C7XQ0000")?.urlKey).toBe("amazon.fr/dp/b0c7xq0000");
  });

  it("deux écritures du même lien ont la même clé", () => {
    const a = normalizeUrl("https://m.leboncoin.fr/ad/deco/42/");
    const b = normalizeUrl("leboncoin.fr/ad/deco/42?utm_medium=share");
    expect(a?.urlKey).toBe(b?.urlKey);
  });

  it.each(["ftp://x.fr/a", "javascript:alert(1)", "https://user:pass@x.fr", "pas un lien", "localhost/a"])(
    "refuse %s",
    (input) => {
      expect(normalizeUrl(input)).toBeNull();
    },
  );
});

describe("looksLikeUrl", () => {
  it.each([
    ["https://www.etsy.com/fr/listing/1", true],
    ["etsy.com/fr/listing/1", true],
    ["fnac.com", true],
    ["Un bon pour un massage", false],
    ["Livre de cuisine", false],
    ["12.50", false],
  ])("%s → %s", (line, expected) => {
    expect(looksLikeUrl(line)).toBe(expected);
  });
});
