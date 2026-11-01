import { ImageResponse } from "next/og";
import sharp from "sharp";
import { formatPrice } from "@/lib/format";
import { imageUrl } from "@/lib/imageUrl";
import { getListBySlug, getListContent } from "@/server/db/lists";
import { OG_SIZE, OgLogo, ogFonts, ogText, ogTexture } from "@/server/og";
import { itemName, type ItemInfo } from "@/types/models";

// Image de partage d'un article : photo sur le fond studio, nom, prix.

export const alt = "Aperçu de l'article";
export const size = OG_SIZE;
export const contentType = "image/png";

/** Photo 1200 (WebP, que next/og ne lit pas) → JPEG en data URL. */
async function photoDataUrl(item: ItemInfo): Promise<string | null> {
  if (!item.imagePath) return null;
  try {
    const response = await fetch(imageUrl(item.imagePath, 1200), { signal: AbortSignal.timeout(5000) });
    if (!response.ok) return null;
    const jpeg = await sharp(Buffer.from(await response.arrayBuffer()))
      .resize(630, 630, { fit: "inside" })
      .flatten({ background: "#ffffff" })
      .jpeg({ quality: 82 })
      .toBuffer();
    return `data:image/jpeg;base64,${jpeg.toString("base64")}`;
  } catch {
    return null;
  }
}

function nameSize(name: string): number {
  if (name.length <= 24) return 60;
  if (name.length <= 48) return 48;
  if (name.length <= 80) return 38;
  return 32;
}

export default async function Image({ params }: { params: Promise<{ slug: string; ref: string }> }) {
  const { slug, ref } = await params;
  const fonts = await ogFonts();
  const lookup = await getListBySlug(slug);
  const content = lookup.kind === "found" ? await getListContent(lookup.list.id) : null;
  const item = content?.items.find((i) => i.ref === ref);
  if (lookup.kind !== "found" || !item) {
    return new ImageResponse(
      <div style={{ display: "flex", width: "100%", height: "100%", padding: 72, background: "#F3EDE2" }}>
        <OgLogo color="#2B2416" />
      </div>,
      { ...OG_SIZE, fonts },
    );
  }

  const { list } = lookup;
  const name = itemName(item);
  const [studio, photo] = await Promise.all([ogTexture("studio"), photoDataUrl(item)]);
  // Fond clair : la photo entière, avec une marge, fondue dans le fond studio.
  const contain = item.lightBackground || !item.imageWidth || !item.imageHeight;
  const price =
    item.priceCents !== null ? formatPrice(item.priceCents, item.currency ?? list.currency) : null;
  const initial = name.trim().charAt(0).toUpperCase();

  return new ImageResponse(
    <div style={{ display: "flex", width: "100%", height: "100%", background: "#F3EDE2" }}>
      <div style={{ display: "flex", position: "relative", width: 630, height: 630, overflow: "hidden" }}>
        {photo ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element -- rendu par next/og */}
            <img
              src={studio}
              alt=""
              width={630}
              height={630}
              style={{ position: "absolute", top: 0, left: 0 }}
            />
            {/* eslint-disable-next-line @next/next/no-img-element -- rendu par next/og */}
            <img
              src={photo}
              alt=""
              width={contain ? 554 : 630}
              height={contain ? 554 : 630}
              style={{
                position: "absolute",
                top: contain ? 38 : 0,
                left: contain ? 38 : 0,
                objectFit: contain ? "contain" : "cover",
                mixBlendMode: contain ? "multiply" : "normal",
              }}
            />
          </>
        ) : (
          <div
            style={{
              display: "flex",
              width: 630,
              height: 630,
              alignItems: "center",
              justifyContent: "center",
              backgroundImage: "radial-gradient(circle at 30% 20%, #F4EBDB, #E2D1B3)",
              fontFamily: "Fraunces",
              fontStyle: "italic",
              fontWeight: 300,
              fontSize: 260,
              color: "rgba(167,106,25,0.55)",
            }}
          >
            {initial}
          </div>
        )}
      </div>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          width: 570,
          padding: "56px 56px 52px",
          fontFamily: "Instrument Sans",
          color: "#2B2416",
        }}
      >
        <div
          style={{
            display: "flex",
            fontSize: 19,
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            color: "#6B5A3E",
            lineHeight: 1.4,
          }}
        >
          {ogText(`${list.title} · liste de ${list.ownerName}`)}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div
            style={{
              display: "flex",
              fontFamily: "Fraunces",
              fontSize: nameSize(name),
              lineHeight: 1.05,
              letterSpacing: "-0.02em",
            }}
          >
            {ogText(name.length > 110 ? `${name.slice(0, 108)}…` : name)}
          </div>
          {price ? (
            <div style={{ display: "flex", fontFamily: "Fraunces", fontSize: 64, color: "#2B2416" }}>
              {ogText(price)}
            </div>
          ) : null}
        </div>
        <OgLogo color="#57612C" />
      </div>
    </div>,
    { ...OG_SIZE, fonts },
  );
}
