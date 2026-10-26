export type ErrorCode =
  "VALIDATION" | "EDIT_LOCKED" | "RATE_LIMITED" | "NOT_FOUND" | "DUPLICATE" | "CONFLICT" | "INTERNAL";

export type ActionError = { code: ErrorCode; message: string; field?: string };

/** Résultat d'une action serveur : jamais d'exception jusqu'au client. */
export type Result<T> = { ok: true; data: T; at?: number } | { ok: false; error: ActionError };

/** Succès, daté par l'horloge du serveur (`at`, ms) : l'édition s'en sert pour écarter un contenu plus ancien. */
export const ok = <T>(data: T): Result<T> => ({ ok: true, data, at: Date.now() });

export const fail = (code: ErrorCode, message: string, field?: string): Result<never> => ({
  ok: false,
  error: field ? { code, message, field } : { code, message },
});

export const GENERIC_ERROR = "Quelque chose n'a pas marché. Réessayez.";
export const LOCKED_ERROR = "La modification s'est verrouillée. Saisissez le mot de passe pour continuer.";
