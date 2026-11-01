import { ImageResponse } from "next/og";
import { OG_SIZE, ogFonts, ogTexture } from "@/server/og";

// Image de partage de l'accueil : « Envies » sur le feuillage.

export const alt = "Envies";
export const size = OG_SIZE;
export const contentType = "image/png";

export default async function Image() {
  const [fonts, texture] = await Promise.all([ogFonts(), ogTexture("feuillage")]);
  return new ImageResponse(
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "flex-end",
        gap: 18,
        width: "100%",
        height: "100%",
        padding: "64px 72px",
        color: "#F3ECDD",
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- rendu par next/og */}
      <img src={texture} alt="" width={1200} height={630} style={{ position: "absolute", top: 0, left: 0 }} />
      <div
        style={{
          display: "flex",
          fontFamily: "Instrument Sans",
          fontSize: 22,
          letterSpacing: "0.2em",
          textTransform: "uppercase",
          color: "#E3D7B8",
        }}
      >
        Listes d&apos;envies
      </div>
      <div
        style={{
          display: "flex",
          fontFamily: "Fraunces",
          fontStyle: "italic",
          fontWeight: 300,
          fontSize: 180,
          lineHeight: 0.9,
          letterSpacing: "-0.03em",
        }}
      >
        Envies
      </div>
    </div>,
    { ...OG_SIZE, fonts },
  );
}
