import {
  alibiWeeks,
  CATCH_GAIN,
  CERT_ROUND,
  POINTS,
  ROUNDS,
  SABOTAGE,
  WRONG_LOSS,
  type AtoutKind,
  type Clue,
  type PointKind,
  type Role,
} from "./engine";
import type { Gazette } from "./types";

// Textes du jeu (docs/14-magie-de-noel.md § Textes). Chaleureux, simples, sans point
// d'exclamation ni tiret long. On raconte une histoire de Noël, on ne lit pas un règlement.

/** Part de la Magie de départ sous laquelle elle vacille (boule à neige et gazette). */
export const SERENE_RATIO = 0.6;

export const ROLE_LABEL: Record<Role, string> = { pn: "Père Noël", gr: "Krampus" };
export const CAMP_LABEL: Record<Role, string> = { pn: "les Pères Noël", gr: "les Krampus" };

/** Sous le nom du rôle, sur la carte. */
export const ROLE_MISSION: Record<Role, string> = {
  pn: "Protégez la Magie de Noël et trouvez qui sont les Krampus.",
  gr: "Faites tomber la Magie de Noël à zéro sans que l'on découvre qui vous êtes.",
};

/** La lettre du Pôle Nord, en tête de page : la même pour tous, elle ne trahit aucun rôle. */
export const INTRO_LETTER: string[] = [
  `Cette année, des Krampus (saboteurs anti-Noël) se sont cachés parmi les Pères Noël, et chacun d'eux, tant qu'il n'est pas démasqué, éteindra ${SABOTAGE} point de la Magie de Noël à la fin de chaque semaine.`,
  "Désignez une personne que vous suspectez d'être un Krampus sur cette page chaque semaine. Plus vite les Krampus sont démasqués, plus la Magie de Noël a de chances d'être sauvée.",
];

/** Sous la carte, une fois retournée : comment jouer, en une phrase. */
export const ROLE_HOWTO: Record<Role, string> = {
  pn: "Chaque semaine, désignez la personne que vous soupçonnez d'être un Krampus, en vous aidant des indices de la gazette et de votre pouvoir.",
  gr: "Ne vous faites pas démasquer : vous éteignez la Magie sans rien faire, et vous pouvez désigner des Pères Noël pour détourner les soupçons sur eux.",
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
        "Cette année, des Krampus (saboteurs de Noël) se sont glissés parmi les joueurs. Chaque semaine où ils restent cachés, ils éteignent un peu de Magie. Personne ne sait qui ils sont, sauf eux.",
        `La Magie de Noël brille à ${g.after}. En dessous de ${Math.ceil(g.after * SERENE_RATIO)}, elle commence à vaciller. Aux Pères Noël de la protéger en démasquant les Krampus.`,
        "Un conseil des lutins : ne croyez pas tout ce que vous lisez. Une fois dans la partie, chaque Krampus peut glisser un faux indice dans ces colonnes.",
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
  "Au début de la partie, le hasard désigne quelques Krampus, environ un joueur sur quatre. Tous les autres sont des Pères Noël. L'objectif des Krampus est simple : saboter la Magie de Noël.",
  "Les Krampus savent qui sont les autres Krampus. Les Pères Noël, eux, ne savent rien.",
  `La Magie de Noël est un compteur commun. Chaque Krampus que personne n'a encore démasqué retire ${SABOTAGE} point de Magie à la fin de chaque semaine.`,
  `La partie dure ${ROUNDS} semaines. Chaque semaine, vous pouvez désigner une personne que vous soupçonnez d'être un Krampus.`,
  "À la fin de la semaine, la personne la plus désignée est démasquée : son vrai rôle est révélé à tous.",
  `Si c'est un Krampus, il cesse de retirer de la Magie et la Magie regagne ${CATCH_GAIN} points. Si c'est un Père Noël, la Magie perd ${WRONG_LOSS} point.`,
  "À la fin de chaque semaine, la Gazette du Pôle Nord raconte ce qui s'est passé, donne un indice sur l'identité d'un Krampus et montre qui a désigné qui : ce sont des indices précieux.",
  `À la fin de la semaine ${CERT_ROUND}, chaque Père Noël reçoit en secret le nom d'un joueur qui n'est pas un Krampus. Les Krampus, eux, peuvent prétendre avoir reçu un nom aussi…`,
  "Si la Magie tombe à zéro, les Krampus ont gagné. Si elle tient jusqu'à la fin de la dernière semaine, ou si tous les Krampus sont démasqués avant, les Pères Noël ont sauvé Noël.",
  "Chaque joueur a aussi un pouvoir, à jouer une seule fois s'il le souhaite. Les Pères Noël ont la Loupe : ils choisissent deux joueurs et apprennent en secret si au moins l'un des deux est un Krampus.",
  "Les Krampus choisissent entre la Fausse piste, qui remplace l'indice d'une gazette par un faux, et l'Alibi, qui fait que pendant deux semaines une Loupe ne trouve rien de suspect chez eux. Les indices ne sont donc pas toujours vrais.",
  `Chacun marque aussi des points personnels, pour le classement général publié à la révélation des rôles. Père Noël : ${POINTS.flair} points chaque semaine où vous désignez un Krampus encore caché, ${POINTS.catch} de plus s'il est démasqué, ${-POINTS.wrong} de moins si la personne que vous désignez est démasquée et se révèle Père Noël. Krampus : ${POINTS.camouflage} points chaque semaine traversée sans être démasqué, ${POINTS.scheme} si vous faites démasquer un Père Noël en le désignant, ${-POINTS.caught} de moins la semaine où vous êtes démasqué. Ces points ne changent rien à la Magie.`,
  "À vous de jouer.",
];

/** Nom court d'une ligne du barème. */
export const POINT_LABEL: Record<PointKind, string> = {
  flair: "Bon flair",
  catch: "Krampus démasqué",
  wrong: "Erreur sur la personne",
  camouflage: "Camouflage",
  caught: "Démasqué",
  scheme: "Manigance réussie",
};

/** Le barème, ligne par ligne, pour un rôle. */
export const POINT_RULES: Record<Role, { kind: PointKind; text: string }[]> = {
  pn: [
    { kind: "flair", text: "chaque semaine où vous désignez un Krampus encore caché" },
    { kind: "catch", text: "en plus, si ce Krampus est démasqué cette semaine-là" },
    { kind: "wrong", text: "si la personne que vous désignez est démasquée et se révèle Père Noël" },
  ],
  gr: [
    { kind: "camouflage", text: "chaque semaine traversée sans être démasqué" },
    { kind: "scheme", text: "si vous désignez un Père Noël et qu'il est démasqué" },
    { kind: "caught", text: "la semaine où vous êtes démasqué" },
  ],
};

export const signed = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : "0");

/** Une ligne de points racontée : « Semaine 2 · Bon flair sur Léa ». */
export function pointLineText(l: { kind: PointKind; round: number; target: string | null }): string {
  const on = l.target
    ? l.kind === "flair" || l.kind === "catch"
      ? ` sur ${l.target}`
      : ` : ${l.target}`
    : "";
  return `Semaine ${l.round} · ${POINT_LABEL[l.kind]}${on}`;
}

/** Résumé du détail d'un joueur au classement : « 3 bons flairs, 1 Krampus démasqué ». */
export function pointDetailText(detail: Partial<Record<PointKind, number>>): string {
  const parts: [PointKind, string, string][] = [
    ["flair", "bon flair", "bons flairs"],
    ["catch", "Krampus démasqué", "Krampus démasqués"],
    ["wrong", "erreur", "erreurs"],
    ["camouflage", "semaine camouflée", "semaines camouflées"],
    ["scheme", "manigance réussie", "manigances réussies"],
  ];
  return parts
    .filter(([k]) => detail[k])
    .map(([k, one, many]) => `${detail[k]} ${detail[k]! > 1 ? many : one}`)
    .join(", ");
}

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

export const ATOUT_NAME: Record<AtoutKind, string> = {
  loupe: "La Loupe",
  fausse_piste: "La Fausse piste",
  alibi: "L'Alibi",
};

export const ATOUT_TEXT: Record<AtoutKind, string> = {
  loupe:
    "Choisissez deux joueurs. Les lutins vous diront en secret si au moins l'un des deux est un Krampus. Une seule fois dans la partie, alors choisissez bien.",
  fausse_piste:
    "Remplacez l'indice de la prochaine gazette par un faux, choisi parmi ceux que les lutins vous proposent. Tout le monde le lira comme un vrai.",
  alibi:
    "Pendant cette semaine et la suivante, si un Père Noël utilise sa Loupe sur vous, les lutins ne trouveront rien de suspect. À jouer au bon moment.",
};

/** Ce que le joueur lit une fois son atout joué. */
export function atoutResultText(a: {
  kind: AtoutKind;
  round: number;
  loupe?: { names: [string, string]; found: boolean };
  clue?: Clue;
}): string {
  if (a.kind === "loupe" && a.loupe) {
    const [x, y] = a.loupe.names;
    return a.loupe.found
      ? `Semaine ${a.round}, les lutins ont regardé de près ${x} et ${y} : au moins l'un des deux est un Krampus.`
      : `Semaine ${a.round}, les lutins ont regardé de près ${x} et ${y} : ils n'ont rien trouvé de suspect.`;
  }
  if (a.kind === "fausse_piste" && a.clue) {
    return `Votre fausse piste paraît dans la gazette de fin de semaine ${a.round} : « ${clueText(a.clue)} »`;
  }
  const weeks = alibiWeeks(a.round);
  return weeks.length > 1
    ? `Votre alibi vous couvre les semaines ${weeks[0]} et ${weeks[weeks.length - 1]} : pendant ce temps, aucune Loupe ne trouvera rien de suspect chez vous.`
    : `Votre alibi vous couvre la semaine ${a.round} : pendant ce temps, aucune Loupe ne trouvera rien de suspect chez vous.`;
}
