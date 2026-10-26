// Génère tests/fixtures/import-45.xlsx : 45 lignes, les 8 colonnes de la maquette ImportV4,
// dont 2 lignes en double (même lien qu'une ligne précédente). `node scripts/make-import-fixture.mjs`
import { mkdirSync, writeFileSync } from "node:fs";
import * as XLSX from "xlsx";

const rayons = ["Déco", "Livres", "Jardin", "Cuisine"];
const objets = [
  [
    "Lampe champignon",
    "https://www.etsy.com/fr/listing/1290573870/lampe-champignon",
    "89",
    "Déco",
    "oui",
    "petit prix",
    "vert sauge",
    "non",
  ],
  [
    "Fauteuil en rotin",
    "https://www.leboncoin.fr/ad/ameublement/2950000001",
    "240",
    "Déco",
    "",
    "occasion",
    "",
    "non",
  ],
  [
    "Liseuse 7 pouces",
    "https://www.fnac.com/a17000001/liseuse",
    "199,90",
    "Livres",
    "x",
    "",
    "version étanche",
    "oui",
  ],
];
const rows = [
  ["Article", "URL", "Prix (€)", "Rayon", "Top", "Mots-clés", "Commentaire", "Acheté ?"],
  ...objets,
];
for (let i = 4; i <= 43; i++) {
  const rayon = rayons[i % 4];
  rows.push([
    `Envie n° ${i}`,
    i % 5 === 0 ? "" : `https://boutique-exemple.fr/produit/${i}`,
    i % 3 === 0 ? "" : `${10 + i},${i % 2 ? "50" : "00"}`,
    rayon,
    i % 7 === 0 ? "oui" : "",
    i % 4 === 0 ? "petit prix, occasion" : i % 6 === 0 ? "cadeau commun" : "",
    i % 8 === 0 ? "taille M" : "",
    i % 9 === 0 ? "oui" : "non",
  ]);
}
// 2 doublons : mêmes liens que des lignes précédentes (l'un écrit autrement).
rows.push([
  "Lampe champignon (bis)",
  "etsy.com/fr/listing/1290573870/lampe-champignon?utm_source=pinterest",
  "89",
  "Déco",
  "",
  "",
  "",
  "non",
]);
rows.push(["Envie n° 4 encore", "https://boutique-exemple.fr/produit/4", "", "Jardin", "", "", "", "non"]);

const ws = XLSX.utils.aoa_to_sheet(rows);
const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, ws, "Liste");
mkdirSync("tests/fixtures", { recursive: true });
writeFileSync("tests/fixtures/import-45.xlsx", XLSX.write(wb, { type: "buffer", bookType: "xlsx" }));
console.log(`${rows.length - 1} lignes`);
