import type { AccusedRole, Card, Chat, JoinOption, Nature, Role } from "./engine";

// Ce que le navigateur reçoit du jeu. Rien ici ne relie un pseudonyme à une personne,
// sauf `reveal`, rempli à la révélation finale.

/** Bilan d'une manche, tel qu'un tchat le voit. `nature` n'existe que pour les Pères Noël. */
export type Gazette = {
  camp: Chat;
  round: number;
  /** Pseudonyme dont le pouvoir a été joué dans ce tchat. */
  played: string;
  /** Désigné par tirage au sort (égalité ou aucun vote). */
  drawn: boolean;
  /** Pères Noël : leur pouvoir était gelé. */
  frozen?: boolean;
  blocked: boolean;
  /** Pères Noël : nature de l'attaque (`null` : inconnue). */
  nature?: Nature | null;
  loss: number;
  gain: number;
  before: number;
  after: number;
  /** Indice de la Lanterne : nombre de lettres du prénom d'un Grinch. */
  lanterne?: number;
  /** Indice laissé par l'attaque : nombre de lettres du prénom de son auteur. */
  corrupteur?: number;
  /** Fin de partie : camp gagnant. */
  winner?: Chat;
};

export type SystemNote = { t: "start" } | { t: "depart" | "retour" | "arrive"; pseudo: string };

export type MagicMessage =
  | { id: number; kind: "chat"; pseudo: string; text: string; mine: boolean }
  | { id: number; kind: "gazette"; gazette: Gazette }
  | { id: number; kind: "system"; note: SystemNote };

export type MagicMember = { pseudo: string; me: boolean; played: boolean; away: boolean; visitor: boolean };

export type RevealRow = {
  name: string;
  role: Role;
  pseudo: string;
  card: Card;
  points: number;
  right: number;
  wrong: number;
  unmasked: number;
};

export type MagicStatus = "joining" | "playing" | "over" | "revealed";

export type MagicView = {
  title: string;
  status: MagicStatus;
  startsAt: string;
  roundDays: number;
  startGauge: number;
  gauge: number;
  /** Manche en cours (1 à 5), ou `null` hors partie. */
  round: number | null;
  /** Fin du vote de la manche en cours. */
  deadline: string | null;
  winner: Chat | null;
  me: { role: Role; pseudo: string; card: Card } | null;
  /** Choix proposé à un joueur qui n'a pas encore rejoint le jeu. */
  joinOption: JoinOption | null;
  chat: {
    id: Chat;
    visiting: boolean;
    members: MagicMember[];
    messages: MagicMessage[];
    canPost: boolean;
    vote: { eligible: string[]; counts: Record<string, number>; mine: string | null } | null;
  } | null;
  accusations: {
    open: boolean;
    left: number;
    mine: { name: string; role: AccusedRole }[];
    people: { id: string; name: string }[];
  };
  reveal: RevealRow[] | null;
};

/** Résumé pour l'organisation : rien sur les rôles. */
export type MagicSummary = {
  status: MagicStatus;
  startsAt: string;
  roundDays: number;
  startGauge: number;
  gauge: number;
  round: number;
  winner: Chat | null;
};
