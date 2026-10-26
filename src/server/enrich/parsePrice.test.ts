import { describe, expect, it } from "vitest";
import { currencyFromText, parsePrice } from "./parsePrice";

// Tous les cas du tableau de docs/07-extraction-liens.md § 5.
describe("parsePrice", () => {
  it.each([89, "89", 89.0])("%s → 8900", (input) => {
    expect(parsePrice(input)?.cents).toBe(8900);
  });

  it.each(["89,90 €", "89,90 EUR", "€89.90"])("%s → 8990 EUR", (input) => {
    expect(parsePrice(input)).toEqual({ cents: 8990, currency: "EUR" });
  });

  it("espace fine insécable (U+202F) et insécable (U+00A0) comme séparateurs de milliers", () => {
    expect(parsePrice("1 299,99 €")).toEqual({ cents: 129999, currency: "EUR" });
    expect(parsePrice("1 299,99")?.cents).toBe(129999);
  });

  it("1.299,99 → 129999", () => {
    expect(parsePrice("1.299,99")?.cents).toBe(129999);
  });

  it("1,299.99 et $1,299.99 → 129999 (USD)", () => {
    expect(parsePrice("1,299.99")?.cents).toBe(129999);
    expect(parsePrice("$1,299.99")).toEqual({ cents: 129999, currency: "USD" });
  });

  it("199,- → 19900", () => {
    expect(parsePrice("199,-")?.cents).toBe(19900);
  });

  it("À partir de 24,90 € → 2490", () => {
    expect(parsePrice("À partir de 24,90 €")).toEqual({ cents: 2490, currency: "EUR" });
  });

  it.each(["Gratuit", "", "0", 0, "0,00 €"])("%s → null (0 n'est pas un prix d'envie)", (input) => {
    expect(parsePrice(input)).toBeNull();
  });

  it("£45 → GBP, 45 CHF → CHF", () => {
    expect(parsePrice("£45")).toEqual({ cents: 4500, currency: "GBP" });
    expect(parsePrice("45 CHF")).toEqual({ cents: 4500, currency: "CHF" });
  });

  it("devise indicative quand le texte n'en donne pas", () => {
    expect(parsePrice("89", "EUR")).toEqual({ cents: 8900, currency: "EUR" });
    expect(parsePrice(12.5, "USD")).toEqual({ cents: 1250, currency: "USD" });
    expect(parsePrice("45 CHF", "EUR")?.currency).toBe("CHF");
  });

  it("milliers seuls et décimale à un chiffre", () => {
    expect(parsePrice("1,299")?.cents).toBe(129900);
    expect(parsePrice("1.299")?.cents).toBe(129900);
    expect(parsePrice("89,9")?.cents).toBe(8990);
  });

  it("refuse les montants absurdes", () => {
    expect(parsePrice("999 999 999 €")).toBeNull();
    expect(parsePrice(-5)).toBeNull();
    expect(parsePrice(Number.NaN)).toBeNull();
  });

  it("currencyFromText", () => {
    expect(currencyFromText("US$ 12")).toBe("USD");
    expect(currencyFromText("12 €")).toBe("EUR");
    expect(currencyFromText("12")).toBeNull();
  });
});
