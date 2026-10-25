const cache = new Map<string, { whole: Intl.NumberFormat; cents: Intl.NumberFormat }>();

function formatters(currency: string) {
  let f = cache.get(currency);
  if (!f) {
    f = {
      whole: new Intl.NumberFormat("fr-FR", {
        style: "currency",
        currency,
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }),
      cents: new Intl.NumberFormat("fr-FR", {
        style: "currency",
        currency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }),
    };
    cache.set(currency, f);
  }
  return f;
}

/**
 * Prix en centimes → texte français, sans décimales quand le montant est rond.
 * 8900 → « 89 € », 19990 → « 199,90 € ».
 */
export function formatPrice(cents: number, currency = "EUR"): string {
  const f = formatters(currency);
  return cents % 100 === 0 ? f.whole.format(cents / 100) : f.cents.format(cents / 100);
}

/** Total arrondi à l'unité, précédé de « ≈ » s'il manque des prix : « ≈ 1 240 € ». */
export function formatTotal(cents: number, currency = "EUR", approximate = false): string {
  const value = formatters(currency).whole.format(Math.round(cents / 100));
  return approximate ? `≈ ${value}` : value;
}
