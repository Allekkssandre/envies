import { describe, expect, it } from "vitest";
import { amazonImageCandidates } from "./run";

describe("amazonImageCandidates", () => {
  it("photo publique d'après le code produit", () => {
    expect(amazonImageCandidates("https://www.amazon.fr/Sony-Casque/dp/B0DYFBHJ5H/ref=x")).toEqual([
      "https://images-na.ssl-images-amazon.com/images/P/B0DYFBHJ5H.01.LZZZZZZZ.jpg",
    ]);
  });
  it("lien court non résolu ou autre boutique : rien", () => {
    expect(amazonImageCandidates("https://amzn.eu/d/03vSKg80", "https://www.fnac.com/a1/x")).toEqual([]);
  });
});
