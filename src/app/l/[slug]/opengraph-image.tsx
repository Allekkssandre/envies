import { ImageResponse } from "next/og";
import { plural } from "@/lib/text";
import { getListBySlug, getListContent } from "@/server/db/lists";
import { OG_SIZE, OgLogo, OgTitle, ogFonts, ogPalette, ogText, ogTexture, titleSize } from "@/server/og";

// Image de partage d'une liste : texture de l'ambiance, prénom, titre (règle typographique).

export const alt = "Aperçu de la liste";
export const size = OG_SIZE;
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const lookup = await getListBySlug(slug);
  const fonts = await ogFonts();
  if (lookup.kind !== "found") {
    const texture = await ogTexture("feuillage");
    return new ImageResponse(
      <div style={{ display: "flex", width: "100%", height: "100%", padding: 72, alignItems: "flex-end" }}>
        {/* eslint-disable-next-line @next/next/no-img-element -- rendu par next/og */}
        <img
          src={texture}
          alt=""
          width={1200}
          height={630}
          style={{ position: "absolute", top: 0, left: 0 }}
        />
        <OgLogo color="#F3ECDD" />
      </div>,
      { ...OG_SIZE, fonts },
    );
  }

  const { list } = lookup;
  const { items } = await getListContent(list.id);
  const favorites = items.filter((i) => i.isFavorite).length;
  const palette = ogPalette(list.ambiance);
  const texture = await ogTexture(list.ambiance);
  const counts = [
    plural(items.length, "article", "articles"),
    ...(favorites ? [plural(favorites, "coup de cœur", "coups de cœur")] : []),
  ].join(" · ");

  return new ImageResponse(
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        width: "100%",
        height: "100%",
        padding: "60px 72px 64px",
        fontFamily: "Instrument Sans",
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- rendu par next/og */}
      <img src={texture} alt="" width={1200} height={630} style={{ position: "absolute", top: 0, left: 0 }} />
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: 1200,
          height: 630,
          backgroundImage: `linear-gradient(180deg, rgba(0,0,0,0) 30%, ${palette.veil} 100%)`,
        }}
      />
      <OgLogo color={palette.text} />
      <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
        <div
          style={{
            display: "flex",
            fontSize: 22,
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            color: palette.label,
          }}
        >
          {ogText(`La liste de ${list.ownerName}`)}
        </div>
        <OgTitle
          title={list.title}
          size={titleSize(list.title, 168)}
          color={palette.text}
          italic={palette.italic}
        />
        <div style={{ display: "flex", fontSize: 26, color: palette.label, marginTop: 6 }}>
          {ogText(counts)}
        </div>
      </div>
    </div>,
    { ...OG_SIZE, fonts },
  );
}
