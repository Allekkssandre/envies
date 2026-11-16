import type { AtoutKind, Clue, PointKind, Role, RoundResult } from "./engine";

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

export type RevealRow = {
  name: string;
  role: Role;
  outRound: number | null;
  flair: number;
  /** Points personnels ; absents des parties révélées avant leur création. */
  points?: number;
  /** Nombre de fois où chaque ligne du barème a joué. */
  detail?: Partial<Record<PointKind, number>>;
};

/** Une ligne de points, vue par le joueur concerné. */
export type PointLineView = { kind: PointKind; round: number; points: number; target: string | null };

export type NoteMark = "suspect" | "innocent";

/** L'atout du joueur, vu par lui seul. */
export type AtoutView =
  | { state: "locked" }
  | {
      state: "ready";
      /** Krampus : faux indices proposés pour la gazette de cette semaine ; vide si impossible. */
      options: Clue[];
      /** Krampus : un autre Krampus a déjà préparé une fausse piste cette semaine. */
      fakeTaken: boolean;
    }
  | {
      state: "used";
      kind: AtoutKind;
      round: number;
      loupe?: { names: [string, string]; found: boolean };
      clue?: Clue;
    };

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
    /** Secret personnel : un joueur qui n'est pas un Krampus. */
    cert: string | null;
    /** Krampus seulement : les autres Krampus. */
    accomplices: { name: string; out: boolean }[];
  };
  players: MagicPlayer[];
  vote: { mine: string | null; voters: number; open: boolean };
  atout: AtoutView;
  /** Carnet d'enquête : notes du joueur, par identifiant. */
  notes: Record<string, NoteMark>;
  gazettes: Gazette[];
  /**
   * Points personnels connus du joueur. Pour un Père Noël, le flair sur un joueur dont le rôle
   * n'est pas encore révélé reste caché jusqu'à la révélation : il trahirait ce rôle.
   */
  points: { total: number; lines: PointLineView[]; pending: boolean };
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

/** Ce que la page du tirage montre du jeu, pour y entrer d'un clic. Rien sur les rôles. */
export type MagicTeaser = {
  status: MagicStatus;
  /** Semaine en cours, ou `null` hors partie. */
  round: number | null;
  magic: number;
  startMagic: number;
  startsAt: string;
  deadline: string | null;
  /** Le joueur a désigné un suspect cette semaine. */
  voted: boolean;
  /** Le joueur peut encore désigner (un Krampus démasqué ne le peut plus). */
  canVote: boolean;
};
