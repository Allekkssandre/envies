import { z } from "zod";
import { SANTA_LIMITS as L } from "./types";

// Validation partagée (formulaire et actions serveur) du Secret Santa.

const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;

const line = (max: number, empty?: string) =>
  z
    .string()
    .transform((s) => s.trim().replace(/\s+/g, " "))
    .pipe(
      empty
        ? z
            .string()
            .min(1, empty)
            .max(max, `${max} caractères au plus.`)
            .refine((s) => !CONTROL.test(s), empty)
        : z
            .string()
            .max(max, `${max} caractères au plus.`)
            .refine((s) => !CONTROL.test(s)),
    );

const text = (max: number) =>
  z
    .string()
    .transform((s) => s.trim())
    .pipe(
      z
        .string()
        .max(max, `${max} caractères au plus.`)
        .refine((s) => !CONTROL.test(s.replace(/[\n\r\t]/g, " "))),
    );

export const santaTitle = line(L.title, "Donnez un nom au Secret Santa.");

export const createSantaSchema = z.object({
  title: santaTitle,
  password: z.string().min(4, "4 caractères au moins.").max(200, "200 caractères au plus."),
  website: z.string().optional(),
});

export const participantSchema = z.object({
  id: z.uuid().optional(),
  firstName: line(L.firstName, "Indiquez le prénom."),
  lastName: line(L.lastName),
  email: z
    .string()
    .transform((s) => s.trim().toLowerCase())
    .pipe(z.email("Cette adresse mail n'est pas valable.").max(L.email)),
});

export const settingsSchema = z.object({
  title: santaTitle,
  message: text(L.message),
  budget: line(L.budget),
  exchangeDate: z.union([z.literal(""), z.iso.date()]),
});

export const draftSchema = settingsSchema.extend({
  themes: z.array(line(L.theme)).max(L.themes, `${L.themes} thèmes au plus.`),
  participants: z.array(participantSchema).max(L.participants, `${L.participants} participants au plus.`),
});

export type DraftInput = z.input<typeof draftSchema>;
export type ParticipantInput = z.input<typeof participantSchema>;

export const profileSchema = z.object({
  age: line(L.age),
  shoeSize: line(L.shoeSize),
  clothingSize: line(L.clothingSize),
  tastes: text(L.tastes),
});

/** Raisons qui empêchent de lancer le tirage, dans l'ordre où les corriger. */
export function launchProblems(themes: string[], emails: string[]): string[] {
  const problems: string[] = [];
  const n = emails.length;
  if (n < 3) problems.push("Il faut au moins 3 participants.");
  const distinctThemes = new Set(themes.map((t) => t.trim().toLowerCase()).filter(Boolean));
  if (distinctThemes.size < n) {
    const missing = n - distinctThemes.size;
    problems.push(
      `Il manque ${missing} ${missing > 1 ? "thèmes" : "thème"} : il en faut un différent par participant.`,
    );
  }
  if (new Set(emails.map((e) => e.trim().toLowerCase())).size !== n) {
    problems.push("Deux participants ont la même adresse mail.");
  }
  return problems;
}
