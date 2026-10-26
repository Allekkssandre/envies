import { describe, expect, it } from "vitest";
import { breadcrumbLabel, categoryIndex, keyLabel, tagIndex, tagLegend } from "./sortKeys";

describe("raccourcis du tri rapide", () => {
  it("légende des tags : A Z E R en AZERTY, Q W E R en QWERTY", () => {
    expect(tagLegend(4, null, "fr-FR")).toBe("A Z E R");
    expect(tagLegend(4, null, "en-US")).toBe("Q W E R");
    expect(tagLegend(12, null, "fr")).toBe("A Z E R T Y U I O P");
    expect(tagLegend(2, null, "de-DE")).toBe("Q W");
  });

  it("la disposition réelle du clavier passe avant la langue", () => {
    const azerty = new Map([
      ["KeyQ", "a"],
      ["KeyW", "z"],
      ["KeyE", "e"],
      ["KeyR", "r"],
    ]);
    expect(tagLegend(4, azerty, "en-US")).toBe("A Z E R");
    const qwertz = new Map([["KeyY", "z"]]);
    expect(keyLabel("KeyY", qwertz, "de-DE")).toBe("Z");
    // Une touche qui ne donne pas une lettre (disposition exotique) : repli sur la langue.
    expect(keyLabel("KeyQ", new Map([["KeyQ", "'"]]), "fr")).toBe("A");
  });

  it("touches physiques : chiffres 1–9 et rangée du haut", () => {
    expect(categoryIndex("Digit1")).toBe(0);
    expect(categoryIndex("Numpad9")).toBe(8);
    expect(categoryIndex("Digit0")).toBeNull();
    expect(tagIndex("KeyQ")).toBe(0);
    expect(tagIndex("KeyP")).toBe(9);
    expect(tagIndex("KeyA")).toBeNull();
  });

  it("fil d'Ariane de la catégorie proposée", () => {
    expect(breadcrumbLabel(["Accueil", "Maison", "Luminaires"])).toBe("Maison › Luminaires");
    expect(breadcrumbLabel(["Home", "Livre", "Roman", "Policier"])).toBe("Roman › Policier");
    expect(breadcrumbLabel([])).toBe("");
  });
});
