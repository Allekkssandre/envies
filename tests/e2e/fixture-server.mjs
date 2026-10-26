// Petit serveur de pages produit pour les tests de bout en bout de l'extraction.
// L'app ne l'atteint que parce que ENRICH_TEST_ALLOW=127.0.0.1:4599 est donné au serveur de test.
import http from "node:http";
import sharp from "sharp";

const PORT = Number(process.env.FIXTURE_PORT ?? 4599);
const ORIGIN = `http://127.0.0.1:${PORT}`;

// Produit sur fond blanc (fondu dans le fond studio) et une seconde photo sur fond coloré.
const shape = (fill) =>
  Buffer.from(`<svg width="420" height="520"><rect width="420" height="520" rx="60" fill="${fill}"/></svg>`);
const images = {
  "/img/lampe-blanc.png": await sharp({
    create: { width: 900, height: 900, channels: 3, background: "#ffffff" },
  })
    .composite([{ input: shape("#8e3b22"), top: 190, left: 240 }])
    .png()
    .toBuffer(),
  "/img/lampe-salon.png": await sharp({
    create: { width: 900, height: 700, channels: 3, background: "#4a5d3a" },
  })
    .composite([{ input: shape("#e8c27a"), top: 90, left: 240 }])
    .png()
    .toBuffer(),
};

/** Lectures par URL complète : la deuxième lecture d'une même page affiche un prix plus bas. */
const visits = new Map();

function productPage(url) {
  const n = (visits.get(url) ?? 0) + 1;
  visits.set(url, n);
  const price = n === 1 ? "89.00" : "79.00";
  const ld = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Product",
        name: "Lampe Tolomeo",
        description: "Lampe de bureau en aluminium, bras articulé.",
        image: [`${ORIGIN}/img/lampe-blanc.png`, `${ORIGIN}/img/lampe-salon.png`],
        brand: { "@type": "Brand", name: "Artemide" },
        offers: { "@type": "Offer", price, priceCurrency: "EUR", availability: "https://schema.org/InStock" },
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Accueil" },
          { "@type": "ListItem", position: 2, name: "Maison" },
          { "@type": "ListItem", position: 3, name: "Luminaires" },
        ],
      },
    ],
  };
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8">
<title>Lampe Tolomeo | Boutique test</title>
<meta property="og:site_name" content="Boutique test">
<script type="application/ld+json">${JSON.stringify(ld)}</script>
</head><body><h1>Lampe Tolomeo</h1></body></html>`;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", ORIGIN);
  if (images[url.pathname]) {
    res.writeHead(200, { "content-type": "image/png" });
    return res.end(images[url.pathname]);
  }
  if (url.pathname.startsWith("/produit/")) {
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    return res.end(productPage(url.toString()));
  }
  if (url.pathname.startsWith("/bloque")) {
    res.writeHead(403, { "content-type": "text/html" });
    return res.end("<title>Access Denied</title>");
  }
  if (url.pathname.startsWith("/lent/")) {
    // Reste « Récupération… » quelques secondes, puis rien à lire.
    await new Promise((r) => setTimeout(r, 6000));
    res.writeHead(404, { "content-type": "text/html" });
    return res.end("<title>Introuvable</title>");
  }
  if (url.pathname === "/") {
    res.writeHead(200, { "content-type": "text/plain" });
    return res.end("ok");
  }
  res.writeHead(404);
  res.end();
});

server.listen(PORT, "127.0.0.1", () => console.log(`fixtures sur ${ORIGIN}`));
