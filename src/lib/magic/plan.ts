import { z } from "zod";
import { MAX_PLAYERS, MIN_PLAYERS } from "./engine";

// La Magie de Noël prévue avant le tirage (docs/14-magie-de-noel.md § Ouverture). Les réglages
// sont gardés avec le Secret Santa ; le jeu s'ouvre au lancement du tirage.

export const magicSettingsSchema = z.object({
  roundDays: z.number().int().min(1).max(14),
  level: z.enum(["pn", "balanced", "gr"]),
});

export const magicPlanSchema = magicSettingsSchema.extend({
  /** Début de la partie (ISO), vide tant que l'organisation ne l'a pas choisi. */
  startsAt: z.union([z.literal(""), z.iso.datetime()]),
  /** La même date telle que saisie (heure locale), pour la réafficher dans le champ. */
  startsLocal: z.string().max(20),
});

export type MagicPlan = z.output<typeof magicPlanSchema>;

export function parseMagicPlan(value: unknown): MagicPlan | null {
  const parsed = magicPlanSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

/** Une date passée de moins d'une heure vaut « maintenant ». */
export const START_GRACE_MS = 60 * 60 * 1000;

/** Ce qui empêche de lancer le tirage avec le jeu, dans l'ordre où le corriger. */
export function magicPlanProblems(plan: MagicPlan | null, players: number, now = Date.now()): string[] {
  if (!plan) return [];
  const problems: string[] = [];
  if (players < MIN_PLAYERS || players > MAX_PLAYERS) {
    problems.push(
      `La Magie de Noël se joue de ${MIN_PLAYERS} à ${MAX_PLAYERS} participants. Ajustez la liste ou décochez le jeu.`,
    );
  }
  if (!plan.startsAt) problems.push("Choisissez la date de début de La Magie de Noël.");
  else if (new Date(plan.startsAt).getTime() < now - START_GRACE_MS) {
    problems.push("La date de début de La Magie de Noël est passée.");
  }
  return problems;
}
