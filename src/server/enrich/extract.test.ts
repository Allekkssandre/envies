import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { applyAdapters } from "./adapters";
import { cleanTitle, extract, extractFrom, loadHtml, parseJsonLoose } from "./extract";
import { looksBlocked } from "./safeFetch";
import type { Extracted } from "./types";

// Pages réelles enregistrées le 2026-10-26 (allégées : styles et scripts retirés, sauf les données).
const dir = join(__dirname, "__fixtures__");
const read = (name: string) => readFileSync(join(dir, name), "utf8");
const sourceOf = (html: string) => /depuis (\S+)/.exec(html)![1]!;

async function full(name: string, fetchJson = async () => null as unknown): Promise<Extracted> {
  const html = read(name);
  const url = sourceOf(html);
  const $ = loadHtml(html);
  return applyAdapters($, new URL(url), extractFrom($, url), fetchJson);
}

type Expected = {
  title: string;
  cents: number;
  currency: string;
  image: string;
  breadcrumb: string[];
  siteName?: string;
  brand?: string;
};

const FIXTURES: Record<string, Expected> = {
  "fnac.html": {
    title: "Morsures",
    cents: 2390,
    currency: "EUR",
    image: "https://static.fnac-static.com/multimedia/PE/Images/FR/NR/74/d2/39/20566644/",
    breadcrumb: ["Accueil", "Livre", "Roman Policier et Thriller", "Meilleures ventes Polar"],
  },
  "leboncoin.html": {
    title: "Lampe vintage",
    cents: 2000,
    currency: "EUR",
    image: "https://img.leboncoin.fr/api/v1/lbcpb1/images/f3/e2/39/",
    breadcrumb: ["Ameublement"],
    siteName: "leboncoin",
  },
  "vinted.html": {
    title: "💛 [BTS] Álbum ● O,rul8,2 ●",
    cents: 1200,
    currency: "EUR",
    image: "https://images1.vinted.net/t/",
    breadcrumb: ["Livres et médias", "Musique", "CD"],
  },
  "ikea.html": {
    title: "VESKEN Chariot - blanc 54x18x71 cm",
    cents: 799,
    currency: "EUR",
    image: "https://www.ikea.com/fr/fr/images/products/vesken-chariot-blanc__",
    breadcrumb: ["Produits", "Salle de bain", "Dessertes de salle de bain"],
    siteName: "IKEA",
    brand: "IKEA",
  },
  "darty.html": {
    title: "Casque arceau sans fil Bluetooth avec réduction de bruit Sony ULT WEAR WH-ULT900 Noir",
    cents: 14999,
    currency: "EUR",
    image: "https://image.darty.com/darty?type=image",
    breadcrumb: ["Audio, HiFi, Casque", "Casque / écouteurs", "Casque audio"],
    siteName: "Darty",
  },
  "zalando.html": {
    title: "WITH BUCKLE - Bottes - black",
    cents: 6599,
    currency: "EUR",
    image: "https://img01.ztat.net/article/spp-media-p1/",
    breadcrumb: ["Femme", "Chaussures", "Bottes", "Bottes classiques"],
    brand: "Bershka",
  },
  "shopify-allbirds.html": {
    title: "Men's Tree Runner NZ",
    cents: 10000,
    currency: "USD",
    image: "https://www.allbirds.com/cdn/shop/files/A11959_25Q3_Tree_Runner_NZ",
    breadcrumb: ["Home", "mens"],
    siteName: "Allbirds",
    brand: "Allbirds",
  },
  "shopify-panafrica.html": {
    title: "Akanda Corail",
    cents: 15900,
    currency: "EUR",
    image: "https://panafrica-store.com/cdn/shop/files/AK-634AKANDA-CORAIL_1.jpg",
    breadcrumb: ["Accueil"],
    brand: "Panafrica",
  },
  "bigcommerce-muji.html": {
    title: "T-shirt chaud en coton biologique pour femme",
    cents: 1795,
    currency: "EUR",
    image: "https://cdn11.bigcommerce.com/s-xmt1tdbwpk/",
    breadcrumb: ["Accueil", "Femme", "Sous‐vêtements et chaussettes", "Sous‐vêtements"],
  },
  "woocommerce-porterandyork.html": {
    // Pas de JSON-LD produit : og:title, et le prix affiché (« à partir de ») par l'adaptateur.
    title: "Ahi Tuna | Fresh Wild-Caught Tuna Steaks",
    cents: 1500,
    currency: "USD",
    image: "https://porterandyork.com/wp-content/uploads/AB2A5377-1-",
    breadcrumb: [],
    siteName: "Porter and York",
  },
};

describe("extraction sur des pages réelles", () => {
  it.each(Object.entries(FIXTURES))("%s", async (name, expected) => {
    const e = await full(name);
    expect(e.title).toBe(expected.title);
    expect(e.price).toEqual({ cents: expected.cents, currency: expected.currency });
    expect(e.images[0]?.startsWith(expected.image)).toBe(true);
    expect(e.images.length).toBeLessThanOrEqual(6);
    expect(new Set(e.images).size).toBe(e.images.length);
    expect(e.images.every((u) => /^https?:\/\//.test(u) && !/\.svg/i.test(u))).toBe(true);
    expect(e.breadcrumb).toEqual(expected.breadcrumb);
    if (expected.siteName) expect(e.siteName).toBe(expected.siteName);
    if (expected.brand) expect(e.brand).toBe(expected.brand);
  });

  it("description en texte brut, 1000 caractères au plus", async () => {
    const e = await full("leboncoin.html");
    expect(e.description).toMatch(/^Je vends cette petite lampe vintage/);
    expect(e.description!.length).toBeLessThanOrEqual(1000);
    expect(e.description).not.toMatch(/<|&#/);
  });

  it("disponibilité et lien canonique", async () => {
    const e = await full("fnac.html");
    expect(e.availability).toBe("PreOrder");
    expect(e.canonical).toBe("https://www.fnac.com/a23346450/Maxime-Chattam-Morsures");
  });

  it("pages de vérification Amazon et Etsy : reconnues comme bloquées", () => {
    expect(looksBlocked(read("amazon-blocked.html"))).toBe(true);
    expect(looksBlocked(read("etsy-blocked.html"))).toBe(true);
    for (const name of Object.keys(FIXTURES)) expect(looksBlocked(read(name))).toBe(false);
  });
});

describe("adaptateurs", () => {
  it("leboncoin : annonce de __NEXT_DATA__ (grandes photos, catégorie)", async () => {
    const e = await full("leboncoin.html");
    expect(e.images[0]).toContain("rule=ad-large");
    expect(e.breadcrumb).toEqual(["Ameublement"]);
  });

  it("Shopify : sans prix dans la page, une seule requête vers <url>.js", async () => {
    const json = JSON.parse(read("shopify-allbirds.js.json")) as unknown;
    const html = read("shopify-allbirds.html")
      .replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/g, "")
      .replace(/<meta[^>]+price:amount[^>]*>/g, "");
    const calls: string[] = [];
    const url = sourceOf(html);
    const $ = loadHtml(html);
    const e = await applyAdapters($, new URL(url), extractFrom($, url), async (u) => {
      calls.push(u);
      return json;
    });
    expect(calls).toEqual(["https://www.allbirds.com/products/mens-tree-runner-nz-medium-grey.js"]);
    expect(e.price).toEqual({ cents: 10000, currency: null });
    expect(e.images[0]).toMatch(/^https:\/\/cdn\.shopify\.com\//);
  });

  it("amazon : titre, plus grande image, prix et fil quand la page passe", async () => {
    const html = `<html><head><title>Amazon.fr</title></head><body>
      <div id="wayfinding-breadcrumbs_feature_div"><a>Cuisine &amp; Maison</a><a>Luminaires</a></div>
      <span id="productTitle"> Lampe de chevet en céramique </span>
      <img id="landingImage" data-a-dynamic-image='{"https://m.media-amazon.com/a.jpg":[300,300],"https://m.media-amazon.com/b.jpg":[1200,1200]}'>
      <span class="a-price"><span class="a-offscreen">34,99 €</span></span></body></html>`;
    const url = "https://www.amazon.fr/dp/B000000000";
    const $ = loadHtml(html);
    const e = await applyAdapters($, new URL(url), extractFrom($, url), async () => null);
    expect(e.title).toBe("Lampe de chevet en céramique");
    expect(e.images[0]).toBe("https://m.media-amazon.com/b.jpg");
    expect(e.price).toEqual({ cents: 3499, currency: "EUR" });
    expect(e.breadcrumb).toEqual(["Cuisine & Maison", "Luminaires"]);
  });

  it("IKEA : prix de secours dans les blocs de prix", async () => {
    const html = `<html><head><meta property="og:title" content="BILLY Bibliothèque - IKEA"></head><body>
      <span class="pip-temp-price__integral">59</span><span class="pip-temp-price__decimal">,99</span></body></html>`;
    const url = "https://www.ikea.com/fr/fr/p/billy-00263850/";
    const $ = loadHtml(html);
    const e = await applyAdapters($, new URL(url), extractFrom($, url), async () => null);
    expect(e.title).toBe("BILLY Bibliothèque");
    expect(e.price).toEqual({ cents: 5999, currency: "EUR" });
  });
});

describe("nettoyage", () => {
  it.each([
    ["Lampe en céramique | Etsy", "Etsy", "etsy.com", "Lampe en céramique"],
    ["Morsures - Fnac", "FNAC.COM", "fnac.com", "Morsures"],
    ["Morsures – Fnac", null, "fnac.com", "Morsures"],
    ["Bouilloire : Amazon.fr : Cuisine & Maison", "Amazon.fr", "amazon.fr", "Bouilloire"],
    [
      "Ahi Tuna | Fresh Wild-Caught Tuna Steaks | Porter & York",
      "Porter and York",
      "porterandyork.com",
      "Ahi Tuna | Fresh Wild-Caught Tuna Steaks",
    ],
    ["Tee-shirt - Bleu", "Ma boutique", "boutique.fr", "Tee-shirt - Bleu"],
    ["Fnac", "Fnac", "fnac.com", "Fnac"],
  ])("%s", (title, site, domain, expected) => {
    expect(cleanTitle(title, site, domain)).toBe(expected);
  });

  it("un nom qui n'est que celui du site ne compte pas (page sans produit)", () => {
    expect(extract("<title>Amazon.fr</title>", "https://www.amazon.fr/dp/B000000000").title).toBeNull();
    expect(extract("<title>etsy.com</title>", "https://www.etsy.com/fr/listing/1/x").title).toBeNull();
    expect(
      extract('<meta property="og:site_name" content="Fnac"><title>Fnac</title>', "https://www.fnac.com/a1")
        .title,
    ).toBeNull();
  });

  it("titre : entités décodées, 200 caractères au plus", () => {
    expect(cleanTitle("Caf&eacute; &amp; th&#233;", null, "x.fr")).toBe("Café & thé");
    expect(cleanTitle("a".repeat(300), null, "x.fr")).toHaveLength(200);
  });

  it("JSON-LD tolérant : commentaires, virgules finales, retours à la ligne", () => {
    expect(parseJsonLoose('{ /* c */ "name": "Lampe\nbleue", "x": [1,2,], }')).toEqual({
      name: "Lampe bleue",
      x: [1, 2],
    });
    expect(parseJsonLoose("{ cassé")).toBeUndefined();
  });

  it("ordre des sources et aplatissement de @graph", () => {
    const html = `<html><head>
      <meta property="og:title" content="Titre OG">
      <meta property="og:image" content="/img/og.jpg">
      <meta property="og:image" content="data:image/png;base64,AAA">
      <meta property="og:image" content="https://cdn.test/logo.svg">
      <script type="application/ld+json">{"@context":"https://schema.org","@graph":[
        {"@type":"Organization","name":"Maison Test"},
        {"@type":"Product","name":"Vase","image":{"@type":"ImageObject","url":"https://cdn.test/vase.jpg"},
         "brand":{"@type":"Brand","name":"Atelier"},
         "offers":[{"@type":"Offer","price":"49.00","priceCurrency":"EUR","availability":"https://schema.org/OutOfStock"},
                   {"@type":"Offer","price":"59.00","priceCurrency":"EUR","availability":"https://schema.org/InStock"},
                   {"@type":"Offer","price":"69.00","priceCurrency":"EUR","availability":"https://schema.org/InStock"}]},
        {"@type":"BreadcrumbList","itemListElement":[
          {"@type":"ListItem","position":2,"name":"Vases"},{"@type":"ListItem","position":1,"name":"Maison"}]}
      ]}</script></head><body><h1>Autre</h1></body></html>`;
    const e = extract(html, "https://www.boutique.test/vase");
    expect(e.title).toBe("Vase");
    expect(e.images).toEqual(["https://cdn.test/vase.jpg", "https://www.boutique.test/img/og.jpg"]);
    expect(e.price).toEqual({ cents: 5900, currency: "EUR" });
    expect(e.availability).toBe("InStock");
    expect(e.brand).toBe("Atelier");
    expect(e.siteName).toBe("Maison Test");
    expect(e.breadcrumb).toEqual(["Maison", "Vases"]);
  });

  it("repli : microdonnées, <h1> unique, <title>", () => {
    const micro = `<html><head><title>Page | Boutique</title></head><body>
      <div itemscope itemtype="https://schema.org/Product"><h1 itemprop="name">Chaise</h1>
      <span itemprop="price" content="120.50"></span><meta itemprop="priceCurrency" content="EUR"></div>
      <nav aria-label="Breadcrumb"><a>Maison</a><a>Chaises</a></nav></body></html>`;
    const e = extract(micro, "https://boutique.test/chaise");
    expect(e.title).toBe("Chaise");
    expect(e.price).toEqual({ cents: 12050, currency: "EUR" });
    expect(e.breadcrumb).toEqual(["Maison", "Chaises"]);
    expect(extract("<title>Seul titre</title>", "https://a.test/").title).toBe("Seul titre");
  });
});
