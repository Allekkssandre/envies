import type { Ambiance } from "@/types/models";

export type AmbianceTheme = {
  /** Classe de texture (`tex-feuillage`…). */
  texture: string;
  /** Fond sombre : texte lin, verre sombre, dessin de feuillage. */
  dark: boolean;
  /** Couleur du texte principal. */
  text: string;
  /** Couleur de l'italique des titres. */
  italic: string;
  /** Étiquettes (capitales). */
  label: string;
  /** Textes secondaires. */
  soft: string;
  /** Textures desktop / mobile, pour le préchargement. */
  images: { desktop: string; mobile: string };
};

const THEMES: Record<Ambiance, AmbianceTheme> = {
  feuillage: {
    texture: "tex-feuillage",
    dark: true,
    text: "text-linen",
    italic: "",
    label: "text-honey",
    soft: "text-[#EADFC6]",
    images: { desktop: "/textures/bokeh-hero.jpg", mobile: "/textures/bokeh-mobile.jpg" },
  },
  ambre: {
    texture: "tex-ambre",
    dark: true,
    text: "text-linen",
    italic: "",
    label: "text-honey",
    soft: "text-[#EADFC6]",
    images: { desktop: "/textures/ambre-hero.jpg", mobile: "/textures/ambre-mobile.jpg" },
  },
  ciel: {
    texture: "tex-ciel",
    dark: false,
    text: "text-ink",
    italic: "text-ochre-deep",
    label: "text-ink-soft",
    soft: "text-ink-soft",
    images: { desktop: "/textures/sky-golden.jpg", mobile: "/textures/sky-golden-mobile.jpg" },
  },
};

export function ambianceTheme(ambiance: Ambiance): AmbianceTheme {
  return THEMES[ambiance] ?? THEMES.feuillage;
}
