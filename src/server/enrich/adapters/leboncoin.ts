import { parsePrice } from "../parsePrice";
import type { Adapter } from "../types";

type Ad = {
  subject?: string;
  body?: string;
  price?: number[];
  price_cents?: number;
  images?: { urls_large?: string[]; urls?: string[] };
  category_name?: string;
};

/** leboncoin.fr : l'annonce est dans `script#__NEXT_DATA__` → `props.pageProps.ad`. */
export const leboncoin: Adapter = {
  name: "leboncoin",
  match: (domain) => domain === "leboncoin.fr" || domain.endsWith(".leboncoin.fr"),
  extract: ($) => {
    let ad: Ad | undefined;
    try {
      const data = JSON.parse($("script#__NEXT_DATA__").text() || "{}") as {
        props?: { pageProps?: { ad?: Ad } };
      };
      ad = data.props?.pageProps?.ad;
    } catch {
      return {};
    }
    if (!ad) return {};
    const price =
      typeof ad.price_cents === "number" && ad.price_cents > 0
        ? { cents: ad.price_cents, currency: "EUR" }
        : parsePrice(ad.price?.[0] ?? null, "EUR");
    return {
      title: ad.subject?.trim() || undefined,
      description: ad.body?.replace(/\s+/g, " ").trim().slice(0, 1000) || undefined,
      price: price ?? undefined,
      images: ad.images?.urls_large ?? ad.images?.urls ?? undefined,
      breadcrumb: ad.category_name ? [ad.category_name] : undefined,
    };
  },
};
