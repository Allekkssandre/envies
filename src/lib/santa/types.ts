// Données du Secret Santa envoyées au navigateur. Aucune ne contient le tirage,
// sauf `LutinView.target` et `LutinView.theme`, qui ne vont qu'au lutin concerné.

export type SantaInfo = {
  id: string;
  slug: string;
  title: string;
  message: string | null;
  budget: string | null;
  /** AAAA-MM-JJ */
  exchangeDate: string | null;
  status: "draft" | "launched";
  launchedAt: string | null;
};

export type SantaTheme = { id: string; label: string };

/** Ce que l'organisation voit d'un participant : jamais son tirage. */
export type OrganizerParticipant = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  mailedAt: string | null;
  mailError: string | null;
  openedAt: string | null;
  confirmedAt: string | null;
};

/** Contrôle du tirage, sans rien en révéler. */
export type DrawCheck = { ok: true; count: number } | { ok: false; reason: string } | null;

export type OrganizerView = {
  santa: SantaInfo;
  themes: SantaTheme[];
  participants: OrganizerParticipant[];
  check: DrawCheck;
  mailReady: boolean;
};

export type LutinProfile = {
  age: string;
  shoeSize: string;
  clothingSize: string;
  tastes: string;
};

export type LutinView = {
  santa: SantaInfo;
  me: { id: string; firstName: string; confirmedAt: string | null; profile: LutinProfile; hasList: boolean };
  target: { firstName: string; lastName: string; profile: LutinProfile; hasList: boolean };
  theme: string;
};

export const SANTA_LIMITS = {
  title: 80,
  message: 600,
  budget: 40,
  theme: 80,
  themes: 100,
  participants: 100,
  firstName: 40,
  lastName: 60,
  email: 254,
  age: 20,
  shoeSize: 20,
  clothingSize: 40,
  tastes: 1500,
} as const;
