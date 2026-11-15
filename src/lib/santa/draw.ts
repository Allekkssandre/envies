// Tirage du Secret Santa (docs/13-secret-santa.md § Tirage). Pur : le hasard est injecté.
//
// Règles, toutes vérifiées par `checkDraw` avant tout enregistrement :
// - chaque participant offre à exactement une personne, et en reçoit exactement une ;
// - personne ne se tire soi-même ;
// - chaque participant reçoit un thème différent ; un thème n'est donné qu'une fois.
//
// Méthode : mélange de Fisher-Yates, recommencé tant qu'une personne se tire elle-même
// (rejet). Chaque tirage valide a exactement la même probabilité. En moyenne, il faut
// e ≈ 2,7 mélanges ; la boucle est bornée pour ne jamais tourner sans fin.

/** Entier aléatoire dans [0, max). En production : `crypto.randomInt`. */
export type RandomInt = (max: number) => number;

export type DrawEntry = { giverId: string; receiverId: string; themeId: string };

export const MIN_PARTICIPANTS = 3;
const MAX_ATTEMPTS = 10_000;

/** Mélange de Fisher-Yates (copie). */
export function shuffle<T>(items: readonly T[], randomInt: RandomInt): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

export class DrawError extends Error {}

/**
 * Tire qui offre à qui, et le thème de chacun. Lève `DrawError` si les données ne
 * permettent pas un tirage (moins de 3 personnes, pas assez de thèmes, doublons).
 */
export function drawSanta(
  participantIds: readonly string[],
  themeIds: readonly string[],
  randomInt: RandomInt,
): DrawEntry[] {
  const n = participantIds.length;
  if (n < MIN_PARTICIPANTS) throw new DrawError("Il faut au moins 3 participants.");
  if (new Set(participantIds).size !== n) throw new DrawError("Participant en double.");
  if (new Set(themeIds).size !== themeIds.length) throw new DrawError("Thème en double.");
  if (themeIds.length < n) throw new DrawError("Il faut au moins autant de thèmes que de participants.");

  let receivers: string[] | null = null;
  for (let attempt = 0; attempt < MAX_ATTEMPTS && !receivers; attempt++) {
    const candidate = shuffle(participantIds, randomInt);
    if (candidate.every((r, i) => r !== participantIds[i])) receivers = candidate;
  }
  if (!receivers) throw new DrawError("Tirage impossible.");
  const themes = shuffle(themeIds, randomInt).slice(0, n);

  const draw = participantIds.map((giverId, i) => ({
    giverId,
    receiverId: receivers[i]!,
    themeId: themes[i]!,
  }));
  checkDraw(draw, participantIds, themeIds);
  return draw;
}

/**
 * Vérifie un tirage complet. Lève `DrawError` à la première règle non respectée.
 * Sert avant l'enregistrement, et à chaque affichage de la page de l'organisation.
 */
export function checkDraw(
  draw: readonly DrawEntry[],
  participantIds: readonly string[],
  themeIds: readonly string[],
): void {
  const people = new Set(participantIds);
  const themes = new Set(themeIds);
  if (people.size < MIN_PARTICIPANTS) throw new DrawError("Il faut au moins 3 participants.");
  if (draw.length !== people.size) throw new DrawError("Chaque participant doit avoir un tirage.");
  const givers = new Set<string>();
  const receivers = new Set<string>();
  const given = new Set<string>();
  for (const { giverId, receiverId, themeId } of draw) {
    if (!people.has(giverId) || !people.has(receiverId)) throw new DrawError("Participant inconnu.");
    if (!themes.has(themeId)) throw new DrawError("Thème inconnu.");
    if (giverId === receiverId) throw new DrawError("Quelqu'un se tire lui-même.");
    if (givers.has(giverId)) throw new DrawError("Quelqu'un offre deux fois.");
    if (receivers.has(receiverId)) throw new DrawError("Quelqu'un reçoit deux fois.");
    if (given.has(themeId)) throw new DrawError("Un thème est donné deux fois.");
    givers.add(giverId);
    receivers.add(receiverId);
    given.add(themeId);
  }
  if (givers.size !== people.size || receivers.size !== people.size) {
    throw new DrawError("Chaque participant doit offrir et recevoir une fois.");
  }
}
