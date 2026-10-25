import { extendTailwindMerge } from "tailwind-merge";

// tailwind-merge connaît les utilitaires de Tailwind ; on lui déclare nos tokens
// pour qu'une classe passée en `className` remplace bien la classe de base.
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      shadow: ["ink", "rust", "linen", "photo", "swatch", "tile", "panel-right", "modal"],
      radius: ["btn", "field", "photo", "panel", "sheet", "side"],
    },
    classGroups: {
      "font-family": ["font-display", "font-display-72", "font-note"],
    },
  },
});

/** Concatène des classes en ignorant les valeurs vides ; la dernière l'emporte en cas de conflit. */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return twMerge(parts.filter(Boolean).join(" "));
}
