import type { CheerioAPI } from "cheerio";
import { parsePrice, type ParsedPrice } from "../parsePrice";

/** Prix de l'offre principale (encadré d'achat), puis format choisi (livres), puis le premier affiché. */
const PRICE_SELECTORS = [
  "#corePriceDisplay_desktop_feature_div .priceToPay .a-offscreen",
  "#corePriceDisplay_desktop_feature_div .a-price .a-offscreen",
  "#corePrice_feature_div .a-price .a-offscreen",
  "#corePrice_desktop .a-price .a-offscreen",
  "#apex_desktop .a-price .a-offscreen",
  "#price_inside_buybox",
  "#newBuyBoxPrice",
  "#kindle-price",
  "#price",
  "#tmmSwatches .a-button-selected .slot-price",
  "#tmmSwatches .a-button-selected .a-color-price",
  ".a-price .a-offscreen",
];

function amazonPrice($: CheerioAPI): ParsedPrice | null {
  for (const selector of PRICE_SELECTORS) {
    const price = parsePrice($(selector).first().text());
    if (price) return price;
  }
  return null;
}
import type { Adapter } from "../types";

/**
 * amazon.* : souvent bloqué (page de vérification), et `safeFetch` renvoie alors `blocked` sans insister.
 * Si la page passe : titre, plus grande image, prix affiché, fil d'Ariane.
 */
export const amazon: Adapter = {
  name: "amazon",
  match: (domain) => /(^|\.)amazon\.[a-z.]+$/.test(domain),
  extract: ($) => {
    const title = $("#productTitle").text().replace(/\s+/g, " ").trim();
    const img = $("#landingImage, #imgBlkFront, #ebooksImgBlkFront, #main-image").first();
    let image = img.attr("data-old-hires") || undefined;
    if (!image) {
      try {
        const sizes = JSON.parse(img.attr("data-a-dynamic-image") ?? "{}") as Record<
          string,
          [number, number]
        >;
        image = Object.entries(sizes).sort((a, b) => b[1][0] * b[1][1] - a[1][0] * a[1][1])[0]?.[0];
      } catch {
        image = undefined;
      }
    }
    const breadcrumb = $("#wayfinding-breadcrumbs_feature_div a")
      .map((_, el) => $(el).text().replace(/\s+/g, " ").trim())
      .get()
      .filter(Boolean);
    return {
      title: title || undefined,
      images: image ? [image] : undefined,
      price: amazonPrice($) ?? undefined,
      breadcrumb: breadcrumb.length ? breadcrumb : undefined,
    };
  },
};
