import { CATCH_GAIN, ROUNDS, SABOTAGE, WRONG_LOSS, type Clue, type Role } from "./engine";
import type { Gazette } from "./types";

// Textes du jeu (docs/14-magie-de-noel.md § Textes). Courts, sans effet de style.

export const ROLE_LABEL: Record<Role, string> = { pn: "Père Noël", gr: "Grinch" };
export const CAMP_LABEL: Record<Role, string> = { pn: "les Pères Noël", gr: "les Grinchs" };

export const ROLE_MISSION: Record<Role, string> = {
  pn: "Gardez la Magie de Noël allumée jusqu'au bout. Trouvez les Grinchs.",
  gr: "Faites tomber la Magie de Noël à 0 sans vous faire démasquer.",
};

export const ROLE_HINT: Record<Role, string> = {
  pn: "Chaque semaine, désignez la personne que vous soupçonnez.",
  gr: `Vous n'avez rien à faire : chaque semaine, chaque Grinch caché retire ${SABOTAGE} de Magie. Désignez un Père Noël pour brouiller les pistes.`,
};

export function clueText(clue: Clue): string {
  switch (clue.t) {
    case "letters":
      return `Le prénom d'un Grinch compte ${clue.n} lettres.`;
    case "range":
      return `Le prénom d'un Grinch commence par une lettre entre ${clue.from} et ${clue.to}.`;
    case "innocent":
      return `Ni ${clue.names[0]} ni ${clue.names[1]} ne sont des Grinchs.`;
    case "among":
      return `Un Grinch se cache parmi ${clue.names[0]}, ${clue.names[1]} et ${clue.names[2]}.`;
  }
}

const signed = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : "0");

/** Lignes de la gazette, dans l'ordre de lecture. */
export function gazetteLines(g: Gazette): { title: string; lines: string[] } {
  if (g.round === 0) {
    return {
      title: "Ouverture",
      lines: [`La Magie de Noël est à ${g.after}.`],
    };
  }
  const lines: string[] = [];
  if (g.unmasked) {
    lines.push(
      g.unmasked.role === "gr"
        ? `Le masque de ${g.unmasked.name} est tombé : c'était un Grinch. Magie ${signed(g.accusation)}.`
        : `Le masque de ${g.unmasked.name} est tombé : c'était un Père Noël. Magie ${signed(g.accusation)}.`,
    );
  } else {
    lines.push(
      g.missed === "tie"
        ? "Égalité : personne n'est démasqué."
        : g.missed === "threshold"
          ? "Pas assez de voix sur un même nom : personne n'est démasqué."
          : "Personne n'a été désigné.",
    );
  }
  if (g.sabotage) {
    lines.push(
      g.sabotage === 1
        ? `Le Grinch caché a frappé : Magie −${g.sabotage}.`
        : `Les Grinchs cachés ont frappé : Magie −${g.sabotage}.`,
    );
  }
  lines.push(`La Magie de Noël passe de ${g.before} à ${g.after}.`);
  if (g.certs) lines.push("Les secrets personnels sont arrivés. Regardez votre carte.");
  return { title: `Semaine ${g.round}`, lines };
}

export function endText(g: Pick<Gazette, "winner" | "end">): string | null {
  if (g.end === "zero") return "La Magie est éteinte. Les Grinchs ont gagné.";
  if (g.end === "all-caught") return "Tous les Grinchs sont démasqués. Les Pères Noël ont gagné.";
  if (g.end === "last-round") return "La Magie a tenu jusqu'au bout. Les Pères Noël ont gagné.";
  return null;
}

export const RULES: string[] = [
  "Environ un joueur sur quatre est un Grinch, tiré au sort. Les autres sont Pères Noël. Les Grinchs se connaissent entre eux.",
  `La partie dure ${ROUNDS} semaines. Chaque semaine, vous pouvez désigner une personne. C'est facultatif et modifiable jusqu'à la fin de la semaine.`,
  `La personne la plus désignée est démasquée, s'il y a assez de voix et pas d'égalité. Un Grinch démasqué : Magie +${CATCH_GAIN}, et il ne nuit plus. Un Père Noël démasqué : Magie −${WRONG_LOSS}.`,
  `Chaque Grinch encore caché retire ${SABOTAGE} de Magie à la fin de chaque semaine.`,
  "Chaque semaine, la gazette donne un indice et montre qui a désigné qui.",
  "À la fin de la semaine 2, chaque Père Noël reçoit en secret le nom d'un autre Père Noël. Les Grinchs ne reçoivent rien, mais peuvent faire semblant.",
  "Les Grinchs gagnent si la Magie tombe à 0. Les Pères Noël gagnent si elle tient jusqu'au bout, ou s'ils démasquent tous les Grinchs.",
  "Parlez-en entre vous si vous voulez : au repas, par message. Tout le monde peut mentir.",
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
