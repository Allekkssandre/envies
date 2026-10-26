import { parsePrice } from "../parsePrice";
import type { Adapter } from "../types";

/** ikea.com : JSON-LD ; prix de secours dans `.pip-temp-price__integral` + `__decimal`. */
export const ikea: Adapter = {
  name: "ikea",
  match: (domain) => domain === "ikea.com" || domain.endsWith(".ikea.com"),
  extract: ($, { base }) => {
    if (base.price) return {};
    const integral = $(".pip-temp-price__integral").first().text().replace(/\D/g, "");
    if (!integral) return {};
    const decimal = $(".pip-temp-price__decimal").first().text().replace(/\D/g, "");
    return { price: parsePrice(decimal ? `${integral},${decimal}` : integral, "EUR") ?? undefined };
  },
};
