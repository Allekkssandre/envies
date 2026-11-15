import type { AccusedRole, Card, Chat, Nature, Role } from "./engine";
import type { Gazette, SystemNote } from "./types";

// Textes du jeu (docs/14-magie-de-noel.md § Textes). Courts, sans effet de style.

export const ROLE_LABEL: Record<Role, string> = {
  pn: "Père Noël",
  gr: "Grinch",
  inf_gr: "Grinch infiltré",
  inf_pn: "Père Noël infiltré",
};

export const ROLE_TEXT: Record<Role, string> = {
  pn: "Vous défendez la Magie de Noël. Elle ne doit pas tomber à 0.",
  gr: "Vous voulez faire tomber la Magie de Noël à 0.",
  inf_gr:
    "Vous jouez pour les Grinchs, mais vous êtes dans le tchat des Pères Noël. Ils ne doivent pas le deviner.",
  inf_pn:
    "Vous jouez pour les Pères Noël, mais vous êtes dans le tchat des Grinchs. Ils ne doivent pas le deviner.",
};

export const CHAT_LABEL: Record<Chat, string> = { pn: "Tchat des Pères Noël", gr: "Tchat des Grinchs" };
export const CAMP_LABEL: Record<Chat, string> = { pn: "les Pères Noël", gr: "les Grinchs" };
export const ACCUSED_LABEL: Record<AccusedRole, string> = { pn: "Père Noël", gr: "Grinch", inf: "Infiltré" };

export const CARD_NAME: Record<Card, string> = {
  facteur: "Facteur",
  lanterne: "Lanterne",
  parefeu: "Pare-feu",
  bouclier: "Bouclier",
  fee: "Fée du sapin",
  cyber: "CyberGrinch",
  brouilleur: "Brouilleur",
  siphon: "Siphon",
  corrupteur: "Corrupteur",
  givre: "Givré",
  espion: "Espion",
};

const VISIT = "Vous y lisez, vous y écrivez et vous votez avec eux au vote suivant.";

/** Ce que fait le pouvoir du joueur quand son tchat le vote. */
export function cardText(card: Card, role: Role): string {
  switch (card) {
    case "facteur":
      return `La Magie gagne 1. Vous passez une manche dans le tchat des Grinchs. ${VISIT}`;
    case "lanterne":
      return "La Magie gagne 1. La gazette donne le nombre de lettres du prénom d'un Grinch, tiré au sort.";
    case "parefeu":
      return "Bloque l'attaque de la manche si elle est numérique. Sinon, sans effet.";
    case "bouclier":
      return "Bloque l'attaque de la manche si elle est magique. Sinon, sans effet.";
    case "fee":
      return "Rend à la Magie la plus grosse perte subie en une manche depuis le début. Au moins 1.";
    case "cyber":
      return `Attaque numérique : la Magie perd 1. Vous passez une manche dans le tchat des Pères Noël. ${VISIT}`;
    case "brouilleur":
      return "Attaque numérique : la Magie perd 1. Les Pères Noël ne sauront pas la nature de cette attaque.";
    case "siphon":
      return "Attaque magique : la Magie perd 2.";
    case "corrupteur":
      return "Attaque magique : la Magie perd 3. En échange, les Pères Noël apprennent le nombre de lettres de votre prénom.";
    case "givre":
      return "Attaque de glace : la Magie perd 1 et le prochain pouvoir des Pères Noël est annulé. À la dernière manche : la Magie perd 2. Rien ne bloque cette attaque.";
    case "espion":
      return role === "inf_gr"
        ? "Si les Pères Noël votent pour vous : la Magie gagne 1 et vous passez une manche dans le tchat des Grinchs, votre vrai camp. Un Père Noël a le même pouvoir : vous pouvez l'annoncer sans vous trahir."
        : "Si les Grinchs votent pour vous : attaque numérique, la Magie perd 1, et vous passez une manche dans le tchat des Pères Noël, votre vrai camp. Un Grinch a le même pouvoir : vous pouvez l'annoncer sans vous trahir.";
  }
}

const NATURE: Record<Nature, string> = { num: "numérique", mag: "magique", glace: "de glace" };

/** Lignes d'une gazette, dans l'ordre : pouvoir joué, attaque, défense, jauge, indices, fin. */
export function gazetteLines(g: Gazette): string[] {
  const lines = [`Pouvoir joué : celui de ${g.played}${g.drawn ? " (tiré au sort)" : ""}.`];
  if (g.camp === "pn") {
    if (g.frozen) lines.push("Il a été gelé par une attaque précédente : il est perdu, sans effet.");
    if (g.blocked) lines.push("Attaque bloquée.");
    else lines.push(`Attaque ${g.nature ? NATURE[g.nature] : "de nature inconnue"} : −${g.loss}.`);
    lines.push(g.gain > 0 ? `Défense : +${g.gain}.` : "Défense : aucun point.");
  } else {
    lines.push(g.blocked ? "Votre attaque a été bloquée." : `Votre attaque : −${g.loss}.`);
    lines.push(g.gain > 0 ? `Défense des Pères Noël : +${g.gain}.` : "Défense des Pères Noël : aucun point.");
  }
  lines.push(`Magie de Noël : ${g.before} → ${g.after}.`);
  if (g.lanterne) lines.push(`Indice : le prénom d'un Grinch compte ${g.lanterne} lettres.`);
  if (g.corrupteur) lines.push(`Indice : le prénom de l'attaquant compte ${g.corrupteur} lettres.`);
  if (g.winner)
    lines.push(
      g.winner === "gr"
        ? "La Magie est tombée à 0. Les Grinchs ont gagné."
        : "La Magie a tenu. Les Pères Noël ont gagné.",
    );
  return lines;
}

export function systemText(note: SystemNote): string {
  switch (note.t) {
    case "start":
      return "La partie commence. Annoncez votre pouvoir si vous le souhaitez, puis votez.";
    case "depart":
      return `${note.pseudo} part en visite dans l'autre tchat. Retour après le prochain vote.`;
    case "arrive":
      return `${note.pseudo} est présent dans le tchat en raison de son pouvoir d'espionnage. Il peut être un infiltré de votre camp, ou un membre du camp adverse.`;
    case "retour":
      return `${note.pseudo} est de retour.`;
  }
}

export const RULES = [
  "Deux camps de 5 : les Pères Noël et les Grinchs. Chaque tchat compte aussi un infiltré du camp adverse.",
  "La Magie de Noël baisse avec les attaques des Grinchs. À 0, les Grinchs gagnent. Si elle tient 5 manches, les Pères Noël gagnent.",
  "À chaque manche, votre tchat vote pour un pseudonyme. Son pouvoir est joué aussitôt le vote fini. Chaque pouvoir ne sert qu'une fois.",
  "Vous ne connaissez que votre pouvoir. Vous pouvez l'annoncer ou vous taire. Seul l'infiltré a le droit de mentir.",
  "Égalité ou aucun vote : le site tire au sort.",
  "Identifications : deux par joueur, définitives. Juste : Père Noël +1, Grinch +2, infiltré +4. Faux : −1, −2, −1. Être identifié : −1.",
  "Ne parlez pas du jeu en dehors des tchats, et ne dites à personne qui vous êtes.",
];

export function formatMoment(iso: string): string {
  return new Date(iso).toLocaleString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Paris",
  });
}
