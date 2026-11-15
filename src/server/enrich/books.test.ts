import { describe, expect, it } from "vitest";
import { bookFromOpenLibrary, isbnFromUrl } from "./books";

describe("isbnFromUrl", () => {
  it("lit un ISBN-10 dans une adresse Amazon", () => {
    expect(isbnFromUrl("https://www.amazon.fr/dp/2290385646")).toBe("2290385646");
  });
  it("ignore un code produit Amazon qui n'est pas un ISBN", () => {
    expect(isbnFromUrl("https://www.amazon.fr/dp/B0B2TVHPZT")).toBeNull();
    expect(isbnFromUrl("https://www.amazon.fr/dp/2290385647")).toBeNull();
  });
  it("lit un ISBN-13 valide n'importe où dans l'adresse", () => {
    expect(isbnFromUrl("https://www.librairie.fr/livre/9782290385646-morsures")).toBeNull();
    expect(isbnFromUrl("https://www.decitre.fr/livres/morsures-9782226474421.html")).toBe("9782226474421");
    expect(isbnFromUrl("https://exemple.fr/p?isbn=978-2-226-47442-1")).toBe("9782226474421");
  });
});

describe("bookFromOpenLibrary", () => {
  it("donne titre, sous-titre et couverture", async () => {
    const book = await bookFromOpenLibrary("2290385646", async () => ({ title: "Titre", subtitle: "Suite" }));
    expect(book.title).toBe("Titre : Suite");
    expect(book.images[0]).toContain("covers.openlibrary.org/b/isbn/2290385646-L.jpg");
  });
  it("sans réponse : couverture seule", async () => {
    const book = await bookFromOpenLibrary("2290385646", async () => null);
    expect(book.title).toBeNull();
    expect(book.images).toHaveLength(1);
  });
});
