/** Prix maximal accepté : 10 000 000 (en unités), soit 1 milliard de centimes. */
export const PRICE_MAX_CENTS = 10_000_000 * 100;

/**
 * Prix saisi à la main → centimes. Accepte `89`, `89,9`, `89.90`, `1 299,99`, `1299.99 €`, `1.299,99`.
 * `null` si la saisie n'est pas un prix valide (vide, négatif, trop grand, illisible).
 */
export function parseManualPrice(input: string): number | null {
  let s = input.replace(/[  \s]/g, "").replace(/(€|eur|euros?|\$|usd|£|gbp|chf)/gi, "");
  if (s === "" || s.startsWith("-")) return null;
  if (!/^[\d.,]+$/.test(s)) return null;

  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");
  const sep = Math.max(lastComma, lastDot);
  if (sep !== -1) {
    const decimals = s.length - sep - 1;
    const both = lastComma !== -1 && lastDot !== -1;
    // « 1.299 » ou « 1,299 » seuls : séparateur de milliers (3 chiffres après, un seul séparateur).
    const thousandsOnly = !both && decimals === 3 && s.split(/[.,]/).length === 2 && sep > 0;
    const integer = thousandsOnly ? s : s.slice(0, sep);
    // Séparateurs de milliers : groupes de 3 chiffres après le premier.
    const groups = integer.split(/[.,]/);
    if (groups.length > 1 && groups.slice(1).some((g) => g.length !== 3)) return null;
    if (thousandsOnly) s = s.replace(/[.,]/g, "");
    else s = integer.replace(/[.,]/g, "") + "." + s.slice(sep + 1);
  }
  if (!/^\d+(\.\d{0,2})?$/.test(s)) return null;
  const [whole = "0", frac = ""] = s.split(".");
  const cents = Number(whole) * 100 + Number(frac.padEnd(2, "0"));
  if (!Number.isFinite(cents) || cents > PRICE_MAX_CENTS) return null;
  return cents;
}

/** Centimes → texte modifiable : 8900 → « 89 », 8990 → « 89,90 ». */
export function priceToInput(cents: number | null): string {
  if (cents == null) return "";
  return cents % 100 === 0 ? String(cents / 100) : (cents / 100).toFixed(2).replace(".", ",");
}
