import { parsePrice } from "../parsePrice";
import type { Adapter } from "../types";

/** Boutiques WooCommerce sans prix dans les métadonnées : le prix affiché du produit (prix soldé d'abord). */
export const woocommerce: Adapter = {
  name: "woocommerce",
  match: (_domain, $) => $("body.woocommerce, body.single-product").length > 0,
  extract: ($, { base }) => {
    if (base.price) return {};
    const scope = $(
      '[class*="woocommerce-product-price"] .price, .summary .price, .product .price, p.price',
    ).first();
    const amount =
      scope.find("ins .woocommerce-Price-amount").first().text() ||
      scope.find(".woocommerce-Price-amount").first().text();
    return { price: parsePrice(amount) ?? undefined };
  },
};
