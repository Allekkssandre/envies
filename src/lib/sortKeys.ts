// Raccourcis du tri rapide (docs/03-ecrans.md, « Tri rapide »). On écoute `KeyboardEvent.code`
// (position physique de la touche) et on affiche la lettre réelle de la disposition du clavier.

/** Rangée du haut, de gauche à droite : les 10 premiers tags. */
export const TAG_CODES = [
  "KeyQ",
  "KeyW",
  "KeyE",
  "KeyR",
  "KeyT",
  "KeyY",
  "KeyU",
  "KeyI",
  "KeyO",
  "KeyP",
] as const;

/** Chiffres 1 à 9 (rangée du haut ou pavé numérique) : les 9 premières catégories. */
export function categoryIndex(code: string): number | null {
  const m = /^(?:Digit|Numpad)([1-9])$/.exec(code);
  return m ? Number(m[1]) - 1 : null;
}

export function tagIndex(code: string): number | null {
  const i = (TAG_CODES as readonly string[]).indexOf(code);
  return i >= 0 ? i : null;
}

const AZERTY: Record<string, string> = { KeyQ: "A", KeyW: "Z", KeyA: "Q", KeyZ: "W", Semicolon: "M" };

/** Disposition lue par `navigator.keyboard.getLayoutMap()` (code → caractère), si le navigateur la donne. */
export type LayoutMap = Pick<Map<string, string>, "get">;

/**
 * Lettre affichée pour une touche physique : celle de la disposition réelle si elle est connue,
 * sinon AZERTY quand la langue du navigateur est le français, QWERTY ailleurs.
 */
export function keyLabel(code: string, layout: LayoutMap | null, language: string): string {
  const fromLayout = layout?.get(code);
  if (fromLayout && /^\p{L}$/u.test(fromLayout)) return fromLayout.toUpperCase();
  const qwerty = code.replace(/^Key/, "");
  if (language.toLowerCase().startsWith("fr")) return AZERTY[code] ?? qwerty;
  return qwerty;
}

/** Les lettres des tags pour la légende : « A Z E R » (AZERTY) ou « Q W E R » (QWERTY). */
export function tagLegend(count: number, layout: LayoutMap | null, language: string): string {
  return TAG_CODES.slice(0, Math.min(count, TAG_CODES.length))
    .map((code) => keyLabel(code, layout, language))
    .join(" ");
}

/** Un champ de saisie a le focus : les raccourcis sont inactifs. */
export function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}

/** Fil d'Ariane affiché avec la catégorie proposée : sans « Accueil », les 2 derniers niveaux. */
export function breadcrumbLabel(crumbs: string[]): string {
  const useful = crumbs.filter((c) => !/^(accueil|home|tous les produits|produits)$/i.test(c.trim()));
  return useful.slice(-2).join(" › ");
}
