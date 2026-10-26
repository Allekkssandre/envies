import { describe, expect, it } from "vitest";
import { suggestCategory, words } from "./suggestCategory";

const CATEGORIES = [
  { id: "maison", name: "Maison & déco" },
  { id: "lecture", name: "Lecture & carnets" },
  { id: "musique", name: "Musique" },
  { id: "sport", name: "Sport" },
  { id: "mode", name: "Mode" },
];

describe("suggestCategory", () => {
  it("mots communs : Maison › Luminaires → Maison & déco", () => {
    expect(suggestCategory(["Accueil", "Maison", "Luminaires"], CATEGORIES)).toBe("maison");
  });

  it("synonymes : un fil « Livre › Roman » propose Lecture & carnets", () => {
    expect(suggestCategory(["Accueil", "Livre", "Roman Policier et Thriller"], CATEGORIES)).toBe("lecture");
  });

  it("vrais fils d'Ariane des fixtures", () => {
    expect(suggestCategory(["Livres et médias", "Musique", "CD"], CATEGORIES)).toBe("musique");
    expect(suggestCategory(["Femme", "Chaussures", "Bottes", "Bottes classiques"], CATEGORIES)).toBe("mode");
    expect(
      suggestCategory(["Produits", "Salle de bain", "Dessertes de salle de bain"], CATEGORIES),
    ).toBeNull();
  });

  it("égalité → aucune proposition", () => {
    const cats = [
      { id: "a", name: "Vélo" },
      { id: "b", name: "Running" },
    ];
    expect(suggestCategory(["Sport"], cats)).toBeNull();
  });

  it("bonus pour le dernier élément du fil, le plus précis", () => {
    const cats = [
      { id: "jardin", name: "Jardin" },
      { id: "cuisine", name: "Cuisine" },
    ];
    expect(suggestCategory(["Jardin", "Cuisine"], cats)).toBe("cuisine");
  });

  it("la marque ne compte pas", () => {
    expect(suggestCategory(["Sport", "Mode"], [{ id: "x", name: "Sport" }], "Mode Sport")).toBeNull();
  });

  it("sans fil ou sans catégories → null", () => {
    expect(suggestCategory([], CATEGORIES)).toBeNull();
    expect(suggestCategory(["Maison"], [])).toBeNull();
  });

  it("mots : sans accents, ponctuation, mots vides ni pluriel", () => {
    expect(words("Toutes les Décorations & Luminaires")).toEqual(["decoration", "luminaire"]);
    expect(words("Jeux et jouets")).toEqual(["jeu", "jouet"]);
  });
});
