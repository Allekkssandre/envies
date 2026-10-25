import { z } from "zod";

// Partagé entre le formulaire (validation à la sortie des champs) et l'action serveur.

// Caractères de contrôle (sauf saut de ligne et tabulation) refusés partout.
const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;

const singleLine = (min: number, max: number, messages: { empty: string; long: string }) =>
  z
    .string()
    .transform((s) => s.trim().replace(/\s+/g, " "))
    .pipe(
      z
        .string()
        .min(min, messages.empty)
        .max(max, messages.long)
        .refine((s) => !CONTROL.test(s), messages.empty),
    );

export const TITLE_MAX = 80;
export const OWNER_MAX = 40;
export const DESCRIPTION_MAX = 500;
export const PASSWORD_MIN = 4;
export const PASSWORD_MAX = 200;

export const AMBIANCES = ["feuillage", "ciel", "ambre"] as const;

export const createListSchema = z.object({
  title: singleLine(1, TITLE_MAX, {
    empty: "Donnez un nom à la liste.",
    long: `${TITLE_MAX} caractères au plus.`,
  }),
  ownerName: singleLine(1, OWNER_MAX, {
    empty: "Indiquez votre prénom.",
    long: `${OWNER_MAX} caractères au plus.`,
  }),
  password: z
    .string()
    .min(PASSWORD_MIN, "4 caractères au moins.")
    .max(PASSWORD_MAX, `${PASSWORD_MAX} caractères au plus.`),
  description: z
    .string()
    .transform((s) => s.trim())
    .pipe(
      z
        .string()
        .max(DESCRIPTION_MAX, `${DESCRIPTION_MAX} caractères au plus.`)
        .refine((s) => !CONTROL.test(s), `${DESCRIPTION_MAX} caractères au plus.`),
    ),
  ambiance: z.enum(AMBIANCES),
  /** Champ piège, invisible : rempli par les robots seulement. */
  website: z.string().optional(),
});

export type CreateListInput = z.input<typeof createListSchema>;
export type CreateListField = "title" | "ownerName" | "password" | "description";

/** Premier message d'erreur par champ. */
export function fieldErrors(error: z.ZodError): Partial<Record<CreateListField, string>> {
  const out: Partial<Record<CreateListField, string>> = {};
  for (const issue of error.issues) {
    const key = issue.path[0] as CreateListField | undefined;
    if (key && !out[key]) out[key] = issue.message;
  }
  return out;
}
