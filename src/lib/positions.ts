import { generateKeyBetween, generateNKeysBetween } from "fractional-indexing";

// Ordre manuel : clés `fractional-indexing` comparées en binaire (collation "C").

export type Positioned = { id: string; position: string; categoryId: string | null };

export const byPosition = (a: { position: string }, b: { position: string }) =>
  a.position < b.position ? -1 : a.position > b.position ? 1 : 0;

/** Clés pour `n` articles ajoutés en tête de la liste (avant la première clé existante). */
export function keysAtStart(first: string | null, n: number): string[] {
  return generateNKeysBetween(null, first, n);
}

/** Clés pour `n` articles ajoutés à la fin d'une catégorie (après son dernier article). */
export function keysAtEndOf(items: Positioned[], categoryId: string | null, n: number): string[] {
  const sorted = [...items].sort(byPosition);
  const inCategory = sorted.filter((i) => i.categoryId === categoryId);
  const last = inCategory.at(-1);
  if (!last) return generateNKeysBetween(sorted.at(-1)?.position ?? null, null, n);
  const next = sorted[sorted.indexOf(last) + 1];
  return generateNKeysBetween(last.position, next?.position ?? null, n);
}

/**
 * Nouvelle clé pour un article placé entre deux voisins de sa catégorie de destination
 * (`before` = celui qui le précède, `after` = celui qui le suit). Sans voisin : fin de la liste.
 */
export function keyBetween(
  items: Positioned[],
  before: Positioned | null | undefined,
  after: Positioned | null | undefined,
): string {
  if (before && after) {
    // Garde-fou : voisins dans le mauvais ordre → se placer juste après `before`.
    if (before.position < after.position) return generateKeyBetween(before.position, after.position);
  }
  const sorted = [...items].sort(byPosition);
  if (before) {
    const next = sorted[sorted.findIndex((i) => i.id === before.id) + 1];
    return generateKeyBetween(
      before.position,
      next && next.position > before.position ? next.position : null,
    );
  }
  if (after) {
    const prev = sorted[sorted.findIndex((i) => i.id === after.id) - 1];
    return generateKeyBetween(prev && prev.position < after.position ? prev.position : null, after.position);
  }
  return generateKeyBetween(sorted.at(-1)?.position ?? null, null);
}

/** Clé trop longue (cas pathologique) : il faudra renuméroter les positions de la liste. */
export const needsRebalance = (key: string) => key.length > 50;
