// Génère les icônes de l'app et les fonds des images de partage.
// Usage : node scripts/make-static-images.mjs
// - src/app/icon.svg, src/app/apple-icon.png, public/icons/*.png : feuille au trait lin sur rond olive
// - src/assets/og/*.jpg : textures d'ambiance recadrées en 1200 × 630
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const OLIVE = "#57612C";
const LINEN = "#F3ECDD";

// Dessin `leaf` des maquettes (viewBox 0 0 100 40), incliné, centré sur un carré de 100.
const LEAF = `
  <g transform="translate(50 50) rotate(-38) translate(-50 -20)">
    <path d="M2 20 C 22 2, 62 0, 98 20 C 62 40, 22 38, 2 20 Z"/>
    <path d="M2 20 L 92 20"/>
    <path d="M30 20 L 42 11 M50 20 L 62 10 M30 20 L 42 29 M50 20 L 62 30"/>
  </g>`;

/**
 * @param {object} o
 * @param {"circle" | "square"} o.shape rond (favicon) ou plein cadre (icône masquable, Apple)
 * @param {number} o.scale taille de la feuille dans le cadre (1 = 100 %)
 * @param {number} o.stroke épaisseur du trait en unités du cadre de 100
 */
function iconSvg({ shape, scale, stroke }) {
  const bg =
    shape === "circle"
      ? `<circle cx="50" cy="50" r="50" fill="${OLIVE}"/>`
      : `<rect width="100" height="100" fill="${OLIVE}"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">${bg}<g fill="none" stroke="${LINEN}" stroke-width="${stroke / scale}" stroke-linecap="round" stroke-linejoin="round" transform="translate(50 50) scale(${scale}) translate(-50 -50)">${LEAF}</g></svg>`;
}

async function png(svg, size, path) {
  await mkdir(dirname(path), { recursive: true });
  await sharp(Buffer.from(svg)).resize(size, size).png({ compressionLevel: 9 }).toFile(path);
  console.log(path);
}

// Favicon : trait épais pour rester lisible en 16 px.
await writeFile(join(root, "src/app/icon.svg"), iconSvg({ shape: "circle", scale: 0.78, stroke: 4.5 }));
await png(iconSvg({ shape: "square", scale: 0.66, stroke: 3 }), 180, join(root, "src/app/apple-icon.png"));
await png(iconSvg({ shape: "circle", scale: 0.78, stroke: 3 }), 192, join(root, "public/icons/icon-192.png"));
await png(
  iconSvg({ shape: "circle", scale: 0.78, stroke: 2.5 }),
  512,
  join(root, "public/icons/icon-512.png"),
);
// Masquable : la feuille reste dans la zone sûre (cercle de 80 %).
await png(
  iconSvg({ shape: "square", scale: 0.58, stroke: 2.5 }),
  512,
  join(root, "public/icons/maskable-512.png"),
);

const textures = {
  feuillage: "bokeh-hero.jpg",
  ambre: "ambre-hero.jpg",
  ciel: "sky-golden.jpg",
};
for (const [name, file] of Object.entries(textures)) {
  const out = join(root, "src/assets/og", `${name}.jpg`);
  await mkdir(dirname(out), { recursive: true });
  await sharp(join(root, "public/textures", file))
    .resize(1200, 630, { fit: "cover", position: "centre" })
    .jpeg({ quality: 78, mozjpeg: true })
    .toFile(out);
  console.log(out);
}

// Fond studio de la photo d'article (image de partage d'un article : carré de 630).
const studio = join(root, "src/assets/og/studio.jpg");
await sharp(join(root, "public/textures/photo-backdrop.jpg"))
  .resize(630, 630, { fit: "cover" })
  .jpeg({ quality: 78, mozjpeg: true })
  .toFile(studio);
console.log(studio);
