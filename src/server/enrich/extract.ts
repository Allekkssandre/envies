// Extraction générique : JSON-LD schema.org, OpenGraph, Twitter Cards, microdonnées
// (docs/07-extraction-liens.md § 4). Pure : HTML + URL de base → champs. Aucune IA.

import * as cheerio from "cheerio";
import type { CheerioAPI } from "cheerio";
import { parsePrice, type ParsedPrice } from "./parsePrice";
import type { Extracted } from "./types";

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
type Node = { [key: string]: Json };

const MAX_IMAGES = 6;
const isNode = (v: Json | undefined): v is Node => typeof v === "object" && v !== null && !Array.isArray(v);
const asArray = (v: Json | undefined): Json[] =>
  v === undefined || v === null ? [] : Array.isArray(v) ? v : [v];

function types(node: Node): string[] {
  return asArray(node["@type"])
    .filter((t): t is string => typeof t === "string")
    .map((t) => t.replace(/^.*[/#]/, ""));
}
const hasType = (node: Node, name: string) => types(node).some((t) => t === name);

/** Décode les entités, retire les balises, normalise les espaces. */
export function plainText(value: string): string {
  const text = /[<&]/.test(value) ? cheerio.load(`<body>${value}</body>`)("body").text() : value;
  return text.replace(/\s+/g, " ").trim();
}

function str(v: Json | undefined): string | null {
  if (typeof v === "number") return String(v);
  if (typeof v !== "string") return null;
  const s = plainText(v);
  return s || null;
}

// ---------------------------------------------------------------------------
// JSON-LD
// ---------------------------------------------------------------------------

/** `JSON.parse` tolérant : commentaires, virgules finales, retours à la ligne dans les chaînes. */
export function parseJsonLoose(text: string): Json | undefined {
  const cleaned = text
    .replace(/^\s*<!--|-->\s*$/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "")
    .replace(/[\r\n\t]+/g, " ")
    .replace(/,\s*([}\]])/g, "$1")
    .trim();
  if (!cleaned) return undefined;
  try {
    return JSON.parse(cleaned) as Json;
  } catch {
    return undefined;
  }
}

/** Tous les objets typés des blocs JSON-LD (`@graph`, tableaux et objets imbriqués aplatis). */
export function jsonLdNodes($: CheerioAPI): Node[] {
  const out: Node[] = [];
  const walk = (v: Json | undefined, depth: number) => {
    if (depth > 6 || v === undefined || v === null) return;
    if (Array.isArray(v)) return v.forEach((x) => walk(x, depth + 1));
    if (!isNode(v)) return;
    if (v["@type"]) out.push(v);
    for (const [key, child] of Object.entries(v)) {
      if (key === "@context") continue;
      if (typeof child === "object" && child !== null) walk(child, depth + 1);
    }
  };
  $('script[type="application/ld+json"]').each((_, el) => walk(parseJsonLoose($(el).text()), 0));
  return out;
}

function imageUrls(v: Json | undefined): string[] {
  return asArray(v).flatMap((x) => {
    if (typeof x === "string") return [x];
    if (isNode(x)) return [x.url, x.contentUrl].filter((u): u is string => typeof u === "string");
    return [];
  });
}

const outOfStock = (o: Node) => /OutOfStock|SoldOut|Discontinued/i.test(String(o.availability ?? ""));

/** Prix d'un `offers` : `Offer.price`, `AggregateOffer.lowPrice`, tableau → le plus bas en stock. */
function offerPrice(offers: Json | undefined): { price: ParsedPrice; availability: string | null } | null {
  const list = asArray(offers).filter(isNode);
  const found: { price: ParsedPrice; availability: string | null; inStock: boolean }[] = [];
  for (const o of list) {
    if (hasType(o, "AggregateOffer") || o.lowPrice !== undefined) {
      const p = parsePrice(o.lowPrice as string | number, str(o.priceCurrency));
      if (p) found.push({ price: p, availability: str(o.availability), inStock: !outOfStock(o) });
      if (!p && o.offers) {
        const inner = offerPrice(o.offers);
        if (inner) found.push({ ...inner, inStock: true });
      }
      continue;
    }
    const spec = asArray(o.priceSpecification).find(isNode);
    const raw = o.price ?? spec?.price;
    const currency = str(o.priceCurrency) ?? str(spec?.priceCurrency);
    const p = typeof raw === "number" || typeof raw === "string" ? parsePrice(raw, currency) : null;
    if (p) found.push({ price: p, availability: str(o.availability), inStock: !outOfStock(o) });
  }
  if (!found.length) return null;
  const pool = found.some((f) => f.inStock) ? found.filter((f) => f.inStock) : found;
  const best = pool.reduce((a, b) => (b.price.cents < a.price.cents ? b : a));
  return { price: best.price, availability: best.availability };
}

function shortAvailability(v: string | null): string | null {
  return v ? v.replace(/^.*[/#]/, "") : null;
}

type JsonLdProduct = {
  name: string | null;
  description: string | null;
  images: string[];
  price: ParsedPrice | null;
  availability: string | null;
  brand: string | null;
};

function productFromJsonLd(nodes: Node[]): JsonLdProduct | null {
  // Le premier produit de la page (un ProductGroup passe avant ses variantes).
  const product = nodes.find((n) => hasType(n, "Product") || hasType(n, "ProductGroup")) ?? null;
  if (!product) return null;
  let offer = offerPrice(product.offers);
  let images = imageUrls(product.image);
  if (hasType(product, "ProductGroup")) {
    const variant = asArray(product.hasVariant).find(isNode);
    if (variant) {
      offer ??= offerPrice(variant.offers);
      if (!images.length) images = imageUrls(variant.image);
    }
  }
  // Offre isolée ailleurs dans la page.
  offer ??= offerPrice(nodes.filter((n) => hasType(n, "Offer") || hasType(n, "AggregateOffer")));
  const brand = isNode(product.brand) ? str(product.brand.name) : str(product.brand);
  return {
    name: str(product.name),
    description: str(product.description),
    images,
    price: offer?.price ?? null,
    availability: shortAvailability(offer?.availability ?? null),
    brand,
  };
}

function breadcrumbFromJsonLd(nodes: Node[]): string[] {
  const list = nodes.find((n) => hasType(n, "BreadcrumbList"));
  if (!list) return [];
  return asArray(list.itemListElement)
    .filter(isNode)
    .map((el, i) => ({
      position: Number(el.position ?? i),
      name: str(el.name) ?? (isNode(el.item) ? str(el.item.name) : null),
    }))
    .sort((a, b) => a.position - b.position)
    .map((e) => e.name)
    .filter((n): n is string => Boolean(n));
}

// ---------------------------------------------------------------------------
// Méta, microdonnées, HTML
// ---------------------------------------------------------------------------

function meta($: CheerioAPI, ...keys: string[]): string | null {
  for (const key of keys) {
    const value = $(`meta[property="${key}"], meta[name="${key}"]`).first().attr("content");
    const s = value ? plainText(value) : "";
    if (s) return s;
  }
  return null;
}

function metaAll($: CheerioAPI, key: string): string[] {
  return $(`meta[property="${key}"], meta[name="${key}"]`)
    .map((_, el) => $(el).attr("content")?.trim() ?? "")
    .get()
    .filter(Boolean);
}

function itemprop($: CheerioAPI, name: string): string | null {
  const el = $(`[itemprop="${name}"]`).first();
  if (!el.length) return null;
  const value = el.attr("content") ?? el.attr("src") ?? el.attr("href") ?? el.text();
  return value ? plainText(value) || null : null;
}

function breadcrumbFromHtml($: CheerioAPI): string[] {
  const selectors = [
    'nav[aria-label*="readcrumb"] a',
    ".breadcrumb a",
    '[itemtype*="BreadcrumbList"] [itemprop="name"]',
    '[class*="breadcrumb"] a',
  ];
  for (const selector of selectors) {
    const names = $(selector)
      .map((_, el) => plainText($(el).text()))
      .get()
      .filter((n) => n && n.length <= 80);
    const deduped = names.filter((n, i) => n !== names[i - 1]);
    if (deduped.length) return deduped.slice(0, 8);
  }
  return [];
}

function largeImages($: CheerioAPI): string[] {
  const scope = $("main, article, [role=main]").length
    ? $("main img, article img, [role=main] img")
    : $("img");
  return scope
    .filter((_, el) => Number($(el).attr("width")) >= 300 && Number($(el).attr("height")) >= 300)
    .map((_, el) => $(el).attr("src") ?? "")
    .get();
}

// ---------------------------------------------------------------------------
// Nettoyage
// ---------------------------------------------------------------------------

const fold = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&|\b(and|et)\b/g, "")
    .replace(/[^a-z0-9]/g, "");

/** Retire les suffixes de site : « Lampe | Etsy », « Livre – Fnac », « X : Amazon.fr : Cuisine ». */
export function cleanTitle(title: string, siteName: string | null, domain: string): string {
  const text = plainText(title);
  // Morceaux et séparateurs alternés : [texte, sép, texte, sép, texte…]
  const pieces = text.split(/(\s+[|\-–—:]\s+)/);
  if (pieces.length > 1) {
    const label = fold(domain.replace(/^(www|m)\./, "").split(".")[0] ?? "");
    const site = siteName ? fold(siteName) : "";
    const isSite = (part: string) => {
      const p = fold(part);
      if (!p) return false;
      return Boolean(
        (site && (p === site || site.startsWith(p) || p.startsWith(site))) ||
        (label.length >= 3 && (p.includes(label) || (p.length >= 3 && label.includes(p)))),
      );
    };
    for (let i = 2; i < pieces.length; i += 2) {
      if (isSite(pieces[i]!)) {
        const kept = pieces
          .slice(0, i - 1)
          .join("")
          .trim();
        if (kept) return kept.slice(0, 200);
        break;
      }
    }
  }
  return text.slice(0, 200);
}

function absoluteImages(urls: (string | null | undefined)[], base: string): string[] {
  const out: string[] = [];
  for (const raw of urls) {
    if (!raw) continue;
    const src = raw.trim();
    if (!src || src.startsWith("data:")) continue;
    let url: URL;
    try {
      url = new URL(src, base);
    } catch {
      continue;
    }
    if (url.protocol !== "http:" && url.protocol !== "https:") continue;
    if (/\.svg($|\?)/i.test(url.pathname)) continue;
    out.push(url.toString());
  }
  return dedupeImages(out);
}

/** Même image en http et en https : on garde la première vue. */
function dedupeImages(urls: string[]): string[] {
  const seen = new Set<string>();
  return urls.filter((u) => {
    const key = u.replace(/^https?:/, "");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function mergeImages(first: string[], second: string[]): string[] {
  return dedupeImages([...first, ...second]).slice(0, MAX_IMAGES);
}

/** Fil d'Ariane sans doublons ni le nom du produit lui-même. */
function cleanBreadcrumb(crumbs: string[], title: string | null): string[] {
  const t = title ? fold(title) : "";
  const seen = new Set<string>();
  return crumbs
    .filter((c) => {
      const k = fold(c);
      if (!k || seen.has(k) || (t && k === t)) return false;
      seen.add(k);
      return true;
    })
    .slice(0, 8);
}

// ---------------------------------------------------------------------------

export function loadHtml(html: string): CheerioAPI {
  return cheerio.load(html);
}

/** Premier non vide gagne, champ par champ, dans l'ordre de docs/07 § 4. */
export function extractFrom($: CheerioAPI, baseUrl: string): Extracted {
  const domain = new URL(baseUrl).hostname.replace(/^(www|m)\./, "");
  const nodes = jsonLdNodes($);
  const product = productFromJsonLd(nodes);

  const siteName =
    meta($, "og:site_name") ??
    str(nodes.find((n) => hasType(n, "Organization") || hasType(n, "Corporation"))?.name) ??
    domain;

  const h1 = $("h1");
  const rawTitle =
    product?.name ??
    meta($, "og:title", "twitter:title") ??
    itemprop($, "name") ??
    (h1.length === 1 ? plainText(h1.text()) || null : null) ??
    (plainText($("title").first().text()) || null);

  const description = product?.description ?? meta($, "og:description", "description", "twitter:description");

  const images = absoluteImages(
    [
      ...(product?.images ?? []),
      ...metaAll($, "og:image:secure_url"),
      ...metaAll($, "og:image"),
      ...metaAll($, "og:image:url"),
      ...metaAll($, "twitter:image"),
      ...metaAll($, "twitter:image:src"),
      $('link[rel="image_src"]').attr("href"),
      itemprop($, "image"),
      ...largeImages($),
    ],
    baseUrl,
  );

  // Devise : JSON-LD → méta → microdonnées → symbole (dans parsePrice). La liste complète ensuite.
  let price = product?.price ?? null;
  if (!price) {
    const amount = meta($, "product:price:amount", "og:price:amount");
    const currency = meta($, "product:price:currency", "og:price:currency");
    price = amount ? parsePrice(amount, currency) : null;
  }
  if (!price) {
    const amount = itemprop($, "price");
    price = amount ? parsePrice(amount, itemprop($, "priceCurrency")) : null;
  }

  const breadcrumb = breadcrumbFromJsonLd(nodes);
  const canonicalHref = $('link[rel="canonical"]').attr("href");
  let canonical: string | null = null;
  try {
    canonical = canonicalHref ? new URL(canonicalHref, baseUrl).toString() : null;
  } catch {
    canonical = null;
  }

  let title = rawTitle ? cleanTitle(rawTitle, siteName, domain) || null : null;
  // Un nom qui n'est que celui du site (« Amazon.fr », « etsy.com ») : page sans produit.
  if (title && [siteName, domain, domain.split(".")[0] ?? ""].some((s) => fold(s) === fold(title!)))
    title = null;
  return {
    title,
    description: description ? plainText(description).slice(0, 1000) || null : null,
    images: images.slice(0, MAX_IMAGES),
    price,
    siteName,
    brand: product?.brand ?? null,
    availability: product?.availability ?? null,
    breadcrumb: cleanBreadcrumb(breadcrumb.length ? breadcrumb : breadcrumbFromHtml($), title),
    canonical,
  };
}

/** `extract(html, baseUrl)` de la spec : extraction générique seule. */
export function extract(html: string, baseUrl: string): Extracted {
  return extractFrom(loadHtml(html), baseUrl);
}

export { absoluteImages };
