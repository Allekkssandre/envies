// Prix lu sur une page (docs/07-extraction-liens.md § 5). Pure.

import { PRICE_MAX_CENTS } from "@/lib/price";

export type ParsedPrice = { cents: number; currency: string | null };

const SYMBOLS: [RegExp, string][] = [
  [/US\s?\$|\$\s?US/i, "USD"],
  [/C\$|CA\$/i, "CAD"],
  [/€/, "EUR"],
  [/£/, "GBP"],
  [/\$/, "USD"],
  [/¥/, "JPY"],
];
const CODES = /\b(EUR|USD|GBP|CHF|CAD|JPY|SEK|DKK|NOK|PLN|AUD|CZK)\b/i;

/** Devise reconnue dans un texte de prix (« 45 CHF », « £45 », « 89,90 € »), sinon null. */
export function currencyFromText(text: string): string | null {
  const code = CODES.exec(text);
  if (code?.[1]) return code[1].toUpperCase();
  for (const [re, iso] of SYMBOLS) if (re.test(text)) return iso;
  return null;
}

/**
 * `89` → 8900 ; `"1 299,99 €"` → 129999 EUR ; `"$1,299.99"` → 129999 USD ; `"199,-"` → 19900.
 * Le dernier `,` ou `.` suivi d'exactement 1 ou 2 chiffres est décimal, les autres sont des milliers.
 * 0, « Gratuit », vide → null (0 n'est pas un prix d'envie).
 */
export function parsePrice(
  input: string | number | null | undefined,
  hintCurrency?: string | null,
): ParsedPrice | null {
  const hint = hintCurrency ?? null;
  if (input === null || input === undefined) return null;
  if (typeof input === "number") {
    if (!Number.isFinite(input) || input <= 0) return null;
    const cents = Math.round(input * 100);
    return cents > 0 && cents <= PRICE_MAX_CENTS ? { cents, currency: hint } : null;
  }

  const text = input.replace(/[    ]/g, " ").trim();
  const match = /\d[\d '.,]*/.exec(text);
  if (!match) return null;
  // « 199,- » ou « 89. » : séparateur final sans chiffres.
  const raw = match[0].replace(/[\s'.,]+$/, "");
  const compact = raw.replace(/[\s']/g, "");
  if (!compact) return null;

  let amount: number;
  const last = Math.max(compact.lastIndexOf(","), compact.lastIndexOf("."));
  const decimals = last >= 0 ? compact.slice(last + 1) : "";
  if (last >= 0 && /^\d{1,2}$/.test(decimals)) {
    const integer = compact.slice(0, last).replace(/[.,]/g, "");
    amount = Number(`${integer || "0"}.${decimals}`);
  } else {
    amount = Number(compact.replace(/[.,]/g, ""));
  }
  if (!Number.isFinite(amount) || amount <= 0) return null;
  const cents = Math.round(amount * 100);
  if (cents <= 0 || cents > PRICE_MAX_CENTS) return null;
  return { cents, currency: currencyFromText(text) ?? hint };
}
