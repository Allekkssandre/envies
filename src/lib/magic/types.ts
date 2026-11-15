import type { Clue, Role, RoundResult } from "./engine";

// Ce que le navigateur reçoit du jeu. Le rôle des autres n'y figure qu'une fois démasqués,
// ou à la révélation finale.

/** Gazette d'une semaine. La semaine 0 annonce l'ouverture et le premier indice. */
export type Gazette = {
  round: number;
  before: number;
  after: number;
  accusation: number;
  sabotage: number;
  unmasked: { name: string; role: Role } | null;
  /** Personne démasquée faute de seuil ou à cause d'une égalité. */
  missed: "tie" | "threshold" | "none" | null;
  /** Désignations de la semaine, publiées après coup. */
  votes: { voter: string; target: string }[];
  /** Indice pour la semaine suivante. */
  clue: Clue | null;
  /** Les secrets personnels viennent d'être distribués. */
  certs: boolean;
  winner: Role | null;
  end: RoundResult["end"];
};

export type MagicPlayer = {
  id: string;
  name: string;
  me: boolean;
  /** Rôle révélé par un démasquage. */
  out: Role | null;
  outRound: number | null;
};

export type RevealRow = { name: string; role: Role; outRound: number | null; flair: number };

export type MagicStatus = "waiting" | "playing" | "over" | "revealed";

export type MagicView = {
  title: string;
  status: MagicStatus;
  startsAt: string;
  roundDays: number;
  startMagic: number;
  magic: number;
  /** Semaine en cours (1 à 5), ou `null` hors partie. */
  round: number | null;
  /** Fin de la semaine en cours. */
  deadline: string | null;
  winner: Role | null;
  threshold: number;
  me: {
    role: Role;
    out: boolean;
    /** Secret personnel : un joueur qui n'est pas un Grinch. */
    cert: string | null;
    /** Grinchs seulement : les autres Grinchs. */
    accomplices: { name: string; out: boolean }[];
  };
  players: MagicPlayer[];
  vote: { mine: string | null; voters: number; open: boolean };
  gazettes: Gazette[];
  reveal: RevealRow[] | null;
};

/** Résumé pour l'organisation : rien sur les rôles. */
export type MagicSummary = {
  status: MagicStatus;
  startsAt: string;
  roundDays: number;
  startMagic: number;
  magic: number;
  round: number;
  winner: Role | null;
  players: number;
};
