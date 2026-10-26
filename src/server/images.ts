import "server-only";
import { createHash } from "node:crypto";
import sharp, { type Metadata } from "sharp";
import type { Db } from "@/server/db/client";

const BUCKET = "item-images";

export type ProcessedImage = {
  w480: Buffer;
  w1200: Buffer;
  width: number;
  height: number;
  lightBackground: boolean;
  hash: string;
};

/** Image illisible, trop petite ou d'un format refusé. */
export class ImageError extends Error {}

/**
 * Bordure (5 % de chaque côté) presque blanche et uniforme : la photo sera affichée en
 * `contain` + `multiply` sur le fond studio (docs/07-extraction-liens.md § 7).
 */
async function hasLightBackground(webp480: Buffer): Promise<boolean> {
  const { data, info } = await sharp(webp480)
    .removeAlpha()
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width, height } = info;
  const bx = Math.max(1, Math.round(width * 0.05));
  const by = Math.max(1, Math.round(height * 0.05));
  let sum = 0;
  let sumSq = 0;
  let n = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (x >= bx && x < width - bx && y >= by && y < height - by) continue;
      const v = data[y * width + x]! / 255;
      sum += v;
      sumSq += v * v;
      n++;
    }
  }
  const mean = sum / n;
  const std = Math.sqrt(Math.max(0, sumSq / n - mean * mean));
  return mean > 0.9 && std < 0.06;
}

/** Oriente, redimensionne en 1200 et 480 (WebP), mesure, détecte le fond clair. */
export async function processImage(input: Buffer): Promise<ProcessedImage> {
  let meta: Metadata;
  try {
    meta = await sharp(input).metadata();
  } catch {
    throw new ImageError("Image illisible");
  }
  if (!meta.format || !["jpeg", "png", "webp", "gif", "avif", "heif", "tiff"].includes(meta.format)) {
    throw new ImageError("Format refusé");
  }
  const base = sharp(input, { animated: false }).rotate();
  const w1200 = await base
    .clone()
    .resize({ width: 1200, height: 1200, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 80 })
    .toBuffer({ resolveWithObject: true });
  if (Math.min(w1200.info.width, w1200.info.height) < 40) throw new ImageError("Image trop petite");
  const w480 = await base
    .clone()
    .resize({ width: 480, height: 480, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 76 })
    .toBuffer();
  return {
    w480,
    w1200: w1200.data,
    width: w1200.info.width,
    height: w1200.info.height,
    lightBackground: await hasLightBackground(w480),
    hash: createHash("sha256").update(w1200.data).digest("hex").slice(0, 8),
  };
}

/** Envoie les deux tailles ; renvoie le préfixe `items/<list>/<item>/<hash>` à enregistrer. */
export async function uploadItemImage(
  db: Db,
  listId: string,
  itemId: string,
  image: ProcessedImage,
): Promise<string> {
  const prefix = `items/${listId}/${itemId}/${image.hash}`;
  const options = { contentType: "image/webp", cacheControl: "31536000", upsert: true };
  const storage = db.storage.from(BUCKET);
  // Jusqu'à 3 essais : une erreur passagère du stockage ne doit pas faire perdre la photo.
  const send = async (path: string, body: Buffer) => {
    let message = "";
    for (let attempt = 1; attempt <= 3; attempt++) {
      const { error } = await storage.upload(path, body, options);
      if (!error) return;
      message = error.message;
      if (attempt < 3) await new Promise((r) => setTimeout(r, 400 * attempt));
    }
    throw new Error(`Envoi de l'image impossible : ${message}`);
  };
  await Promise.all([send(`${prefix}-1200.webp`, image.w1200), send(`${prefix}-480.webp`, image.w480)]);
  return prefix;
}

/** Supprime les fichiers d'une ancienne image (jamais en SQL sur storage.objects). */
export async function removeItemImage(db: Db, prefix: string | null): Promise<void> {
  if (!prefix) return;
  await db.storage.from(BUCKET).remove([`${prefix}-1200.webp`, `${prefix}-480.webp`]);
}
