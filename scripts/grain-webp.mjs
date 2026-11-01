// Version WebP des tuiles de grain (servies par le CSS) : ~5 fois plus légères que les PNG.
// À relancer après `scripts/generate-textures.py` : node scripts/grain-webp.mjs
import sharp from "sharp";

for (const name of ["grain", "grain-fine"]) {
  const out = `public/textures/${name}.webp`;
  await sharp(`public/textures/${name}.png`).webp({ quality: 85, smartSubsample: true }).toFile(out);
  console.log(out);
}
