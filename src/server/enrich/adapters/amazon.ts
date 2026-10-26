import { parsePrice } from "../parsePrice";
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
    const img = $("#landingImage");
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
      price: parsePrice($(".a-price .a-offscreen").first().text()) ?? undefined,
      breadcrumb: breadcrumb.length ? breadcrumb : undefined,
    };
  },
};
