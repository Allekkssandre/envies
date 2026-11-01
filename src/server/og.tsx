import "server-only";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { ReactNode } from "react";
import { splitTitle } from "@/lib/splitTitle";
import type { Ambiance } from "@/types/models";

// Images de partage (`next/og`, 1200 × 630) : polices statiques et fonds d'ambiance
// lus depuis `src/assets` (régénérés par scripts/make-static-images.mjs).

export const OG_SIZE = { width: 1200, height: 630 };

const ASSETS = join(process.cwd(), "src/assets");

type Font = { name: string; data: Buffer; weight: 300 | 400 | 500; style: "normal" | "italic" };

let fontsPromise: Promise<Font[]> | undefined;

export function ogFonts(): Promise<Font[]> {
  fontsPromise ??= Promise.all([
    readFile(join(ASSETS, "fonts/fraunces-400.ttf")),
    readFile(join(ASSETS, "fonts/fraunces-italic-300.ttf")),
    readFile(join(ASSETS, "fonts/instrument-sans-500.ttf")),
  ]).then(([roman, italic, sans]) => [
    { name: "Fraunces", data: roman, weight: 400, style: "normal" },
    { name: "Fraunces", data: italic, weight: 300, style: "italic" },
    { name: "Instrument Sans", data: sans, weight: 500, style: "normal" },
  ]);
  return fontsPromise;
}

const textureCache = new Map<string, Promise<string>>();

/** Fond d'ambiance 1200 × 630 en data URL (JPEG). */
export function ogTexture(name: Ambiance | "studio"): Promise<string> {
  let promise = textureCache.get(name);
  if (!promise) {
    promise = readFile(join(ASSETS, "og", `${name}.jpg`)).then(
      (data) => `data:image/jpeg;base64,${data.toString("base64")}`,
    );
    textureCache.set(name, promise);
  }
  return promise;
}

/** Couleurs du texte selon l'ambiance (fond sombre : lin ; ciel doré : encre). */
export function ogPalette(ambiance: Ambiance) {
  return ambiance === "ciel"
    ? { text: "#2B2416", italic: "#7A4512", label: "#5E523A", veil: "rgba(243,236,221,0)" }
    : { text: "#F3ECDD", italic: "#F3ECDD", label: "#E3D7B8", veil: "rgba(16,14,6,0.55)" };
}

/** Espaces fines insécables d'Intl → insécables simples (présentes dans les polices). */
export const ogText = (value: string) => value.replace(/ /g, " ");

/** Taille du titre selon sa longueur, pour qu'il tienne sur deux lignes au plus. */
export function titleSize(title: string, max: number): number {
  const n = title.length;
  if (n <= 10) return max;
  if (n <= 18) return Math.round(max * 0.8);
  if (n <= 30) return Math.round(max * 0.62);
  if (n <= 50) return Math.round(max * 0.48);
  return Math.round(max * 0.38);
}

/** Règle typographique : premier mot en romain, la suite en italique. */
export function OgTitle({
  title,
  size,
  color,
  italic,
}: {
  title: string;
  size: number;
  color: string;
  italic: string;
}): ReactNode {
  const { first, rest } = splitTitle(title);
  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        fontFamily: "Fraunces",
        fontSize: size,
        lineHeight: 0.95,
        letterSpacing: "-0.03em",
        color,
      }}
    >
      <span style={{ fontWeight: 400, marginRight: "0.22em" }}>{ogText(first)}</span>
      {rest ? (
        <span style={{ fontWeight: 300, fontStyle: "italic", color: italic }}>{ogText(rest)}</span>
      ) : null}
    </div>
  );
}

/** Logo « Envies », toujours en italique. */
export function OgLogo({ color }: { color: string }): ReactNode {
  return (
    <div
      style={{
        display: "flex",
        fontFamily: "Fraunces",
        fontStyle: "italic",
        fontWeight: 300,
        fontSize: 40,
        color,
      }}
    >
      Envies
    </div>
  );
}
