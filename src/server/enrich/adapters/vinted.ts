import { parsePrice } from "../parsePrice";
import type { Adapter } from "../types";

type Item = {
  title?: string;
  description?: string;
  price?: { amount?: string | number; currency_code?: string } | string | number;
  currency?: string;
  photos?: { full_size_url?: string; url?: string }[];
};

function findItem(value: unknown, depth = 0): Item | null {
  if (depth > 8 || typeof value !== "object" || value === null) return null;
  const v = value as Record<string, unknown>;
  if (typeof v.title === "string" && Array.isArray(v.photos)) return v as Item;
  for (const child of Object.values(v)) {
    const found = findItem(child, depth + 1);
    if (found) return found;
  }
  return null;
}

/** vinted.* : JSON-LD Product en général ; sinon le store de la page (`data-js-react-on-rails-store`). */
export const vinted: Adapter = {
  name: "vinted",
  match: (domain) => /(^|\.)vinted\.[a-z.]+$/.test(domain),
  extract: ($, { base }) => {
    if (base.title && base.price && base.images.length) return {};
    let found: Item | null = null;
    for (const el of $("script[data-js-react-on-rails-store]").toArray()) {
      try {
        found = findItem(JSON.parse($(el).text()));
      } catch {
        found = null;
      }
      if (found) break;
    }
    if (!found) return {};
    const p = found.price;
    const price =
      typeof p === "object" && p !== null
        ? parsePrice(p.amount ?? null, p.currency_code ?? found.currency)
        : parsePrice(p ?? null, found.currency);
    return {
      title: found.title,
      description: found.description?.slice(0, 1000),
      price: price ?? undefined,
      images: (found.photos ?? []).map((ph) => ph.full_size_url ?? ph.url ?? "").filter(Boolean),
    };
  },
};
