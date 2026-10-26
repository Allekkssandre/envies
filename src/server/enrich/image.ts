import "server-only";
import sharp from "sharp";
import type { Db } from "@/server/db/client";
import { processImage, uploadItemImage, type ProcessedImage } from "@/server/images";
import { safeFetchImage, type SafeFetchOptions } from "./safeFetch";

// Photo depuis la page (docs/07-extraction-liens.md § 7) : la première candidate valable,
// en 1200 et 480 WebP, avec détection du fond clair.

const MIN_SIDE = 200;
const MAX_TRIES = 4;

export type StoredImage = {
  path: string;
  width: number;
  height: number;
  lightBackground: boolean;
  sourceUrl: string;
};

/** Candidates écartées d'emblée : logos, SVG, GIF (souvent animés ou décoratifs). */
export function usableCandidate(url: string): boolean {
  return !/logo|sprite|placeholder|favicon/i.test(url) && !/\.(svg|gif)(\?|$)/i.test(url);
}

/** Télécharge et traite une image ; `null` si elle est trop petite, animée ou illisible. */
export async function downloadImage(url: string, options?: SafeFetchOptions): Promise<ProcessedImage | null> {
  const res = await safeFetchImage(url, options);
  if (!res.ok) return null;
  try {
    const meta = await sharp(res.body).metadata();
    if ((meta.pages ?? 1) > 1) return null;
    if (!meta.width || !meta.height || Math.min(meta.width, meta.height) < MIN_SIDE) return null;
    return await processImage(res.body);
  } catch {
    return null;
  }
}

/** Essaie les candidates dans l'ordre et envoie la première valable dans Storage. */
export async function storeFirstImage(
  db: Db,
  listId: string,
  itemId: string,
  candidates: string[],
  options?: SafeFetchOptions,
): Promise<StoredImage | null> {
  for (const url of candidates.filter(usableCandidate).slice(0, MAX_TRIES)) {
    const image = await downloadImage(url, options);
    if (!image) continue;
    const path = await uploadItemImage(db, listId, itemId, image);
    return {
      path,
      width: image.width,
      height: image.height,
      lightBackground: image.lightBackground,
      sourceUrl: url,
    };
  }
  return null;
}
