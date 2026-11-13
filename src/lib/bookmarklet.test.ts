import { load } from "cheerio";
import { describe, expect, it } from "vitest";
import { bookmarkletHref, READ_PRODUCT_JS, type PageProduct } from "./bookmarklet";

// Le texte exact copié dans le favori, exécuté tel quel.
const readProduct = new Function(`return (${READ_PRODUCT_JS});`)() as (
  doc: ReturnType<typeof fakeDocument>,
  href: string,
) => PageProduct;

/** Document minimal au-dessus de cheerio : ce dont le favori se sert. */
function fakeDocument(html: string) {
  const $ = load(html);
  const wrap = (node: Parameters<typeof $>[0]) => {
    const el = $(node);
    return { getAttribute: (n: string) => el.attr(n) ?? null, textContent: el.text() };
  };
  return {
    title: $("title").text(),
    querySelector: (sel: string) => {
      const first = $(sel).first();
      return first.length ? wrap(first.get(0)!) : null;
    },
    querySelectorAll: (sel: string) =>
      $(sel)
        .toArray()
        .map((n) => wrap(n)),
  };
}

describe("readProduct", () => {
  it("lit le JSON-LD Product (graphe, offre, image objet)", () => {
    const doc = fakeDocument(`<html><head><title>Plateau | Vertbaudet</title>
      <script type="application/ld+json">{"@context":"https://schema.org","@graph":[{"@type":"WebPage"},
      {"@type":"Product","name":"Plateau de fromages en feutrine","image":[{"@type":"ImageObject","url":"/img/plateau.jpg"}],
      "offers":{"@type":"Offer","price":18,"priceCurrency":"EUR"}}]}</script>
      <meta property="og:image" content="https://cdn.x.fr/og.jpg"></head></html>`);
    expect(readProduct(doc, "https://www.vertbaudet.fr/plateau.htm?ProductId=1")).toEqual({
      url: "https://www.vertbaudet.fr/plateau.htm?ProductId=1",
      title: "Plateau de fromages en feutrine",
      price: "18",
      currency: "EUR",
      image: "https://www.vertbaudet.fr/img/plateau.jpg",
    });
  });

  it("prend l'offre d'une variante ou d'une offre groupée", () => {
    const doc = fakeDocument(`<script type="application/ld+json">[{"@type":"ProductGroup","name":"Pull",
      "hasVariant":[{"@type":"Product","image":"https://x.fr/p.jpg","offers":{"price":"49.90","priceCurrency":"EUR"}}]}]</script>`);
    expect(readProduct(doc, "https://x.fr/pull")).toMatchObject({
      title: "Pull",
      price: "49.90",
      image: "https://x.fr/p.jpg",
    });
    const grouped = fakeDocument(`<script type="application/ld+json">{"@type":"Product","name":"Lampe",
      "offers":{"@type":"AggregateOffer","offers":[{"price":"35","priceCurrency":"EUR"}]}}</script>`);
    expect(readProduct(grouped, "https://x.fr/lampe")).toMatchObject({ price: "35", currency: "EUR" });
  });

  it("sans JSON-LD : OpenGraph puis microdonnées", () => {
    const doc = fakeDocument(`<html><head><title>Titre de page</title>
      <meta property="og:title" content="Casque Sony WH-CH720N">
      <meta property="og:image" content="https://img.x.fr/casque.jpg"></head>
      <body><span itemprop="price" content="89.99"></span><meta itemprop="priceCurrency" content="EUR"></body></html>`);
    expect(readProduct(doc, "https://x.fr/casque")).toMatchObject({
      title: "Casque Sony WH-CH720N",
      price: "89.99",
      currency: "EUR",
      image: "https://img.x.fr/casque.jpg",
    });
  });

  it("fiche Amazon : prix affiché et grande photo", () => {
    const doc = fakeDocument(`<html><head><title>Amazon.fr : Sony WH-CH720N : High-Tech</title></head><body>
      <span id="productTitle">  Sony WH-CH720N Casque sans fil  </span><div id="corePrice_feature_div"><span class="a-price"><span class="a-offscreen">89,99 €</span></span></div>
      <img id="landingImage" src="https://m.media-amazon.com/small.jpg" data-old-hires="https://m.media-amazon.com/big.jpg">
      </body></html>`);
    expect(readProduct(doc, "https://www.amazon.fr/dp/B0DYFBHJ5H")).toMatchObject({
      title: "Sony WH-CH720N Casque sans fil",
      price: "89,99 €",
      image: "https://m.media-amazon.com/big.jpg",
    });
  });

  it("écarte les images non http et le JSON invalide", () => {
    const doc = fakeDocument(`<script type="application/ld+json">{oups</script>
      <meta property="og:image" content="data:image/png;base64,AAAA"><title>X</title>`);
    expect(readProduct(doc, "https://x.fr/")).toMatchObject({ title: "X", image: "", price: "" });
  });
});

describe("bookmarkletHref", () => {
  it("le code du favori s'exécute et ouvre /partage avec les infos", () => {
    const href = bookmarkletHref("https://envies.example/");
    expect(href.startsWith("javascript:")).toBe(true);
    const code = decodeURIComponent(href.slice("javascript:".length));
    const opened: string[] = [];
    const document = fakeDocument(`<title>Lampe</title>
      <script type="application/ld+json">{"@type":"Product","name":"Lampe champignon","offers":{"price":"35","priceCurrency":"EUR"}}</script>`);
    const run = new Function("document", "location", "window", code);
    run(document, { href: "https://shop.fr/lampe" }, { open: (u: string) => (opened.push(u), {}) });
    expect(opened).toHaveLength(1);
    const url = new URL(opened[0]!);
    expect(url.origin + url.pathname).toBe("https://envies.example/partage");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      url: "https://shop.fr/lampe",
      title: "Lampe champignon",
      price: "35",
      currency: "EUR",
      image: "",
      depuis: "favori",
    });
  });
});
