"use client";

import { useEffect, useState, type CSSProperties } from "react";

/**
 * Cale une feuille du bas au-dessus du clavier virtuel.
 * Le bas de la feuille suit le bas de la zone visible (visualViewport) et sa hauteur
 * ne dépasse jamais cette zone : le champ reste à l'écran pendant la saisie.
 */
export function useKeyboardInset(active: boolean, gap = 12): CSSProperties | undefined {
  const [box, setBox] = useState<{ bottom: number; height: number } | null>(null);

  useEffect(() => {
    const vv = typeof window !== "undefined" ? window.visualViewport : null;
    if (!active || !vv) return;
    const update = () => {
      const bottom = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      setBox({ bottom: Math.round(bottom), height: Math.round(vv.height) });
    };
    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
      setBox(null);
    };
  }, [active]);

  if (!active || !box || box.bottom === 0) return undefined;
  return { bottom: box.bottom, maxHeight: box.height - gap };
}
