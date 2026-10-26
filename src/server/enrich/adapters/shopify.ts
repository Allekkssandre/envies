import { parsePrice } from "../parsePrice";
import type { Adapter } from "../types";

type ShopifyProduct = {
  title?: string;
  price?: number;
  featured_image?: string;
  images?: string[];
  vendor?: string;
};

/**
 * Boutiques Shopify (détection : `window.Shopify` ou `cdn.shopify.com` dans la page).
 * Sans prix générique : `<url>.js`, le JSON produit public, en une seule requête de plus. Prix en centimes.
 */
export const shopify: Adapter = {
  name: "shopify",
  match: (_domain, $) =>
    $("script")
      .toArray()
      .some((el) => /window\.Shopify\s*=/.test($(el).text())) || $.html().includes("cdn.shopify.com"),
  extract: async (_$, { url, base, fetchJson }) => {
    if (base.price) return {};
    const match = /^(.*\/products\/[^/?#]+)/.exec(url.origin + url.pathname);
    if (!match) return {};
    const data = (await fetchJson(`${match[1]}.js`)) as ShopifyProduct | null;
    if (!data || typeof data !== "object") return {};
    const images = [data.featured_image, ...(data.images ?? [])].filter((s): s is string => Boolean(s));
    return {
      title: base.title ? undefined : data.title,
      price: typeof data.price === "number" ? (parsePrice(data.price / 100) ?? undefined) : undefined,
      images: images.length ? images : undefined,
      brand: base.brand ? undefined : data.vendor,
    };
  },
};
