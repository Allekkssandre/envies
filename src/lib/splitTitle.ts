/**
 * Règle des titres : premier mot en romain, la suite en italique.
 * « Mes 30 ans » → { first: "Mes", rest: "30 ans" }.
 */
export function splitTitle(title: string): { first: string; rest: string } {
  const words = title.trim().split(/\s+/).filter(Boolean);
  const [first = "", ...rest] = words;
  return { first, rest: rest.join(" ") };
}
