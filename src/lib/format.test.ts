import { describe, expect, it } from "vitest";
import { formatPrice } from "./format";

// Intl insère des espaces insécables (U+00A0 / U+202F) : on les normalise pour comparer.
const plain = (s: string) => s.replace(/[\u00A0\u202F]/g, " ");

describe("formatPrice", () => {
  it("n'affiche pas de décimales pour un montant rond", () => {
    expect(plain(formatPrice(8900))).toBe("89 €");
    expect(plain(formatPrice(124000))).toBe("1 240 €");
  });

  it("affiche les centimes sinon", () => {
    expect(plain(formatPrice(19990))).toBe("199,90 €");
    expect(plain(formatPrice(5))).toBe("0,05 €");
  });

  it("respecte la devise", () => {
    expect(plain(formatPrice(2500, "USD"))).toBe("25 $US");
  });
});
