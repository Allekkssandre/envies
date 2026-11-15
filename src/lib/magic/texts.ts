import { CATCH_GAIN, CERT_ROUND, ROUNDS, SABOTAGE, WRONG_LOSS, type Clue, type Role } from "./engine";
import type { Gazette } from "./types";

// Textes du jeu (docs/14-magie-de-noel.md § Textes). Chaleureux, simples, sans point
// d'exclamation ni tiret long. On raconte une histoire de Noël, on ne lit pas un règlement.

export const ROLE_LABEL: Record<Role, string> = { pn: "Père Noël", gr: "Krampus" };
export const CAMP_LABEL: Record<Role, string> = { pn: "les Pères Noël", gr: "les Krampus" };

/** Sous le nom du rôle, sur la carte. */
export const ROLE_MISSION: Record<Role, string> = {
  pn: "Protégez la Magie de Noël et trouvez qui sont les Krampus.",
  gr: "Faites tomber la Magie de Noël à zéro sans que l'on découvre qui vous êtes.",
};

/** Sous la carte, une fois retournée. */
export const ROLE_HINT: Record<Role, string> = {
  pn: `Quelques Krampus se cachent parmi les joueurs, et chacun d'eux éteint ${SABOTAGE} point de Magie à la fin de chaque semaine. Si vous pensez savoir qui est un Krampus, désignez cette personne ci-dessous. Plus vite les Krampus sont démasqués, plus la Magie est sauve.`,
  gr: `Vous n'avez rien à faire pour éteindre la Magie : tant que personne n'a découvert que vous êtes un Krampus, vous lui retirez ${SABOTAGE} point à la fin de chaque semaine, automatiquement. Vous pouvez aussi désigner un Père Noël, pour qu'on le prenne pour un Krampus à votre place.`,
};

export function clueText(clue: Clue): string {
  switch (clue.t) {
    case "letters":
      return `Des traces dans la neige : le prénom d'un Krampus compte ${clue.n} lettres.`;
    case "range":
      return `Une lettre oubliée près de la cheminée : le prénom d'un Krampus commence par une lettre entre ${clue.from} et ${clue.to}.`;
    case "innocent":
      return `Les lutins ont vérifié : ni ${clue.names[0]} ni ${clue.names[1]} ne sont des Krampus.`;
    case "among":
      return `Les lutins ont flairé une piste : un Krampus se cache parmi ${clue.names[0]}, ${clue.names[1]} et ${clue.names[2]}.`;
  }
}

const points = (n: number) => (n > 1 ? `${n} points` : `${n} point`);

export type Story = {
  /** « Ouverture » ou « Semaine 3 ». */
  when: string;
  headline: string;
  paragraphs: string[];
};

/** La gazette racontée : un gros titre, puis quelques phrases. */
export function gazetteStory(g: Gazette): Story {
  if (g.round === 0) {
    return {
      when: "Ouverture",
      headline: "La Magie de Noël s'allume",
      paragraphs: [
        "Cette année encore, des Krampus se sont glissés parmi les joueurs. Chaque semaine où ils restent cachés, ils éteignent un peu de Magie. Personne ne sait qui ils sont, sauf eux.",
        `La Magie de Noël brille à ${g.after}. Aux Pères Noël de la protéger en démasquant les Krampus.`,
      ],
    };
  }
  const end = endText(g);
  let headline: string;
  const paragraphs: string[] = [];
  if (g.unmasked?.role === "gr") {
    headline = "Un Krampus démasqué";
    paragraphs.push(
      g.accusation > 0
        ? `Le masque de ${g.unmasked.name} est tombé : c'était bien un Krampus. Il ne pourra plus éteindre de Magie, et la Magie reprend des couleurs (+${g.accusation}).`
        : `Le masque de ${g.unmasked.name} est tombé : c'était bien un Krampus. Il ne pourra plus éteindre de Magie.`,
    );
  } else if (g.unmasked) {
    headline = "Erreur sur la personne";
    paragraphs.push(
      `Le masque de ${g.unmasked.name} est tombé, mais c'était un Père Noël. Cette erreur coûte de la Magie (−${-g.accusation || WRONG_LOSS}).`,
    );
  } else if (g.missed === "tie") {
    headline = "Les avis sont partagés";
    paragraphs.push("Égalité dans les désignations : personne n'a été démasqué cette semaine.");
  } else if (g.missed === "threshold") {
    headline = "Les soupçons s'éparpillent";
    paragraphs.push(
      "Les désignations se sont trop dispersées : aucun nom n'a réuni assez de voix pour être démasqué.",
    );
  } else {
    headline = "Une semaine bien calme";
    paragraphs.push("Personne n'a désigné de Krampus présumé cette semaine.");
  }
  if (g.sabotage) {
    paragraphs.push(
      g.sabotage === SABOTAGE
        ? `Pendant ce temps, le Krampus encore caché a éteint ${points(g.sabotage)} de Magie.`
        : `Pendant ce temps, dans l'ombre, les Krampus encore cachés ont éteint ${points(g.sabotage)} de Magie.`,
    );
  }
  if (g.certs) {
    paragraphs.push(
      "Les lutins ont confié à chaque Père Noël le nom d'un joueur qui n'est pas un Krampus. Regardez sous votre carte.",
    );
  }
  return { when: `Semaine ${g.round}`, headline: end ?? headline, paragraphs };
}

export function endText(g: Pick<Gazette, "winner" | "end">): string | null {
  if (g.end === "zero") return "La dernière étincelle s'est éteinte. Les Krampus ont gagné.";
  if (g.end === "all-caught") return "Tous les Krampus sont démasqués. Les Pères Noël ont sauvé Noël.";
  if (g.end === "last-round") return "La Magie a tenu jusqu'au bout. Les Pères Noël ont sauvé Noël.";
  return null;
}

export const RULES: string[] = [
  "Au début de la partie, le sort désigne en secret quelques Krampus, environ un joueur sur quatre. Tous les autres sont des Pères Noël. Les Krampus savent qui sont les autres Krampus. Les Pères Noël, eux, ne savent rien.",
  `La Magie de Noël est un compteur commun à tous. Chaque Krampus que personne n'a encore démasqué lui retire ${SABOTAGE} point à la fin de chaque semaine.`,
  `La partie dure ${ROUNDS} semaines. Chaque semaine, vous pouvez désigner la personne que vous soupçonnez d'être un Krampus. Rien n'est obligatoire, et vous pouvez changer d'avis jusqu'à la fin de la semaine.`,
  `À la fin de la semaine, la personne la plus désignée est démasquée : son vrai rôle est révélé à tous. Il faut qu'elle ait réuni assez de voix, et qu'il n'y ait pas d'égalité. Si c'est un Krampus, il cesse de retirer de la Magie et la Magie regagne ${CATCH_GAIN} points. Si c'est un Père Noël, la Magie perd ${WRONG_LOSS} point.`,
  "À la fin de chaque semaine, la Gazette du Pôle Nord raconte ce qui s'est passé, donne un indice sur l'identité d'un Krampus et montre qui a désigné qui.",
  `À la fin de la semaine ${CERT_ROUND}, chaque Père Noël reçoit en secret le nom d'un joueur qui n'est pas un Krampus. Les Krampus ne reçoivent rien, mais ils peuvent prétendre le contraire.`,
  "Si la Magie tombe à zéro, les Krampus ont gagné. Si elle tient jusqu'à la fin de la dernière semaine, ou si tous les Krampus sont démasqués avant, les Pères Noël ont sauvé Noël.",
  "Parlez-en autour de vous, au dîner ou par message. Chacun a le droit de bluffer.",
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
