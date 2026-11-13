import { describe, expect, it } from "vitest";
import { splitLinkAndText, titleFromUrl } from "./titleFromUrl";

describe("titleFromUrl", () => {
  it.each([
    [
      "https://www.fnac.com/a21102889/Big-Thief-Capacity-Edition-Limitee-Vinyle-Colore-Vinyle-album",
      "Big Thief Capacity Edition Limitee Vinyle Colore Vinyle album",
    ],
    [
      "https://www.fnac.com/Videoprojecteur-Philips-NeoPix-150-Full-HD-Noir/a21357549/w-4",
      "Videoprojecteur Philips NeoPix 150 Full HD Noir",
    ],
    [
      "https://www.leroymerlin.fr/produits/peinture-meuble-vert-sauge-satin-v33-renovation-cuisine-et-bain-0-75l-88993658.html",
      "Peinture meuble vert sauge satin v33 renovation cuisine et bain 0 75l",
    ],
    [
      "https://www.etsy.com/fr/listing/1290573870/lampe-champignon-en-ceramique",
      "Lampe champignon en ceramique",
    ],
    [
      "https://www.amazon.fr/Sony-WH-CH720N-Bluetooth-r%C3%A9duction-Autonomie/dp/B0DYFBHJ5H/ref=sr_1_1",
      "Sony WH CH720N Bluetooth réduction Autonomie",
    ],
    [
      "https://www.backmarket.fr/fr-fr/p/hp-elitedesk-800-g3-mini-core-i5-22-ghz-ssd-256-go-ram-8-go/35474184-8ea1-42cc-9e59-efcaf46f910b",
      "Hp elitedesk 800 g3 mini core i5 22 ghz ssd 256 go ram 8 go",
    ],
    [
      "https://www.decathlon.fr/p/raquette-de-tennis-adulte-tr160-lite-gris/_/R-p-301881",
      "Raquette de tennis adulte tr160 lite gris",
    ],
    ["https://shop.example.com/products/linen-shirt-sand", "Linen shirt sand"],
  ])("%s", (url, title) => {
    expect(titleFromUrl(url)).toBe(title);
  });

  it.each([
    "https://www.amazon.fr/dp/B0DYFBHJ5H",
    "https://www.leboncoin.fr/ad/ameublement/3260823142",
    "https://traingift.com/",
    "https://amzn.eu/d/03vSKg80",
    "pas une adresse",
  ])("rien de lisible : %s", (url) => {
    expect(titleFromUrl(url)).toBeNull();
  });

  it("coupe les noms très longs entre deux mots", () => {
    const title = titleFromUrl(`https://x.fr/p/${"lampe-champignon-".repeat(20)}123456`);
    expect(title!.length).toBeLessThanOrEqual(120);
    expect(title!.endsWith(" ")).toBe(false);
  });
});

describe("splitLinkAndText", () => {
  it("sépare le lien du texte partagé", () => {
    expect(splitLinkAndText("Sony WH-CH720N, casque sans fil https://amzn.eu/d/03vSKg80")).toEqual({
      url: "https://amzn.eu/d/03vSKg80",
      text: "Sony WH-CH720N, casque sans fil",
    });
  });
  it("lien seul : pas de texte", () => {
    expect(splitLinkAndText("https://www.ikea.com/fr/fr/p/x-123/")).toEqual({
      url: "https://www.ikea.com/fr/fr/p/x-123/",
      text: null,
    });
  });
  it("sans lien : null", () => {
    expect(splitLinkAndText("Un pull bleu")).toBeNull();
  });
});
