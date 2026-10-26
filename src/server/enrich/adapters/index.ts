import type { CheerioAPI } from "cheerio";
import { mergeImages } from "../extract";
import type { Adapter, Extracted, FetchJson } from "../types";
import { amazon } from "./amazon";
import { ikea } from "./ikea";
import { leboncoin } from "./leboncoin";
import { shopify } from "./shopify";
import { vinted } from "./vinted";
import { woocommerce } from "./woocommerce";

export const ADAPTERS: Adapter[] = [leboncoin, amazon, vinted, ikea, shopify, woocommerce];

/** Le premier adaptateur qui reconnaît la page complète (ou corrige) l'extraction générique. */
export async function applyAdapters(
  $: CheerioAPI,
  url: URL,
  base: Extracted,
  fetchJson: FetchJson,
): Promise<Extracted> {
  const domain = url.hostname.replace(/^(www|m)\./, "");
  const adapter = ADAPTERS.find((a) => a.match(domain, $));
  if (!adapter) return base;
  let patch: Partial<Extracted>;
  try {
    patch = await adapter.extract($, { url, base, fetchJson });
  } catch {
    return base;
  }
  const absolute = (patch.images ?? []).flatMap((src) => {
    try {
      return [new URL(src, url).toString()];
    } catch {
      return [];
    }
  });
  return {
    ...base,
    title: patch.title?.trim() || base.title,
    description: patch.description?.trim() || base.description,
    price: patch.price ?? base.price,
    images: mergeImages(absolute, base.images),
    breadcrumb: patch.breadcrumb?.length ? patch.breadcrumb : base.breadcrumb,
    brand: patch.brand ?? base.brand,
  };
}
