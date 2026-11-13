import { describe, expect, it } from "vitest";
import { sharedLine } from "./shareTarget";

describe("sharedLine", () => {
  it("prend le paramètre url, précédé du titre partagé", () => {
    expect(sharedLine({ url: "https://www.etsy.com/listing/123", title: "Lampe" })).toBe(
      "Lampe https://www.etsy.com/listing/123",
    );
    expect(sharedLine({ url: "https://www.etsy.com/listing/123", title: "La" })).toBe(
      "https://www.etsy.com/listing/123",
    );
  });

  it("trouve le lien glissé dans le texte (Chrome Android)", () => {
    expect(
      sharedLine({ title: "Lampe champignon", text: "Regarde ça https://www.ikea.com/fr/fr/p/lampe-123/." }),
    ).toBe("Lampe champignon https://www.ikea.com/fr/fr/p/lampe-123/");
    expect(sharedLine({ text: "(https://exemple.fr/a?b=1)" })).toBe("https://exemple.fr/a?b=1");
  });

  it("partage d'une appli : le texte autour du lien devient le nom", () => {
    expect(sharedLine({ text: "Amazon.fr : Sony WH-CH720N, casque https://amzn.eu/d/03vSKg80" })).toBe(
      "Sony WH-CH720N, casque https://amzn.eu/d/03vSKg80",
    );
  });

  it("sans lien : le titre, sinon le texte, comme nom", () => {
    expect(sharedLine({ title: "  Un   carnet ", text: "autre" })).toBe("Un carnet");
    expect(sharedLine({ text: "Des chaussettes" })).toBe("Des chaussettes");
    expect(sharedLine({ url: "exemple.fr/produit" })).toBe("exemple.fr/produit");
  });

  it("rien d'utilisable", () => {
    expect(sharedLine({})).toBeNull();
    expect(sharedLine({ url: "", text: "   ", title: null })).toBeNull();
  });

  it("nom tronqué à 200 caractères", () => {
    expect(sharedLine({ title: "a".repeat(300) })).toHaveLength(200);
  });
});
