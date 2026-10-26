// Normalisation des liens (docs/07-extraction-liens.md § 2). Sert aux doublons (`url_key`)
// et à l'affichage du domaine. Pure : utilisable côté serveur et dans les tests.

export type NormalizedUrl = { url: string; urlKey: string; domain: string };

const TRACKING = new Set([
  "gclid",
  "fbclid",
  "msclkid",
  "mc_cid",
  "mc_eid",
  "igshid",
  "ref",
  "ref_",
  "tag",
  "psc",
  "_branch_match_id",
  "srsltid",
  "spm",
  "scm",
]);
const TRACKING_PREFIXES = ["utm_", "pd_rd_", "pf_rd_", "ga_"];

function isTracking(name: string): boolean {
  const n = name.toLowerCase();
  return TRACKING.has(n) || TRACKING_PREFIXES.some((p) => n.startsWith(p));
}

const AMAZON = /^(?:.+\.)?amazon\.[a-z.]+$/;
const ASIN = /\/(?:dp|gp\/product|gp\/aw\/d)\/([A-Z0-9]{10})(?:[/?]|$)/i;

/** Une ligne collée est-elle un lien ? `https://…`, ou un domaine suivi d'un chemin (`etsy.com/…`). */
export function looksLikeUrl(line: string): boolean {
  const s = line.trim();
  if (/\s/.test(s)) return false;
  if (/^https?:\/\//i.test(s)) return true;
  return /^(?:[a-z0-9-]+\.)+[a-z]{2,}(?:[/?#].*)?$/i.test(s) && !/^\d+([.,]\d+)?$/.test(s);
}

/** `null` si ce n'est pas une URL http(s) utilisable. */
export function normalizeUrl(input: string): NormalizedUrl | null {
  const raw = input.trim();
  if (!raw || raw.length > 2048) return null;
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : `https://${raw}`;
  let parsed: URL;
  try {
    parsed = new URL(withScheme);
  } catch {
    return null;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
  if (parsed.username || parsed.password) return null;
  if (!parsed.hostname.includes(".")) return null;

  const host = parsed.hostname.toLowerCase();
  const domain = host.replace(/^(www|m)\./, "");

  let pathname = parsed.pathname;
  const params = [...parsed.searchParams.entries()].filter(([name]) => !isTracking(name));

  if (AMAZON.test(domain)) {
    const asin = ASIN.exec(pathname);
    if (asin?.[1]) {
      pathname = `/dp/${asin[1].toUpperCase()}`;
      params.length = 0;
    }
  }

  params.sort(([a, av], [b, bv]) => (a === b ? av.localeCompare(bv) : a.localeCompare(b)));
  pathname = pathname.replace(/\/+$/, "") || "";
  const search = params.length ? `?${new URLSearchParams(params).toString()}` : "";

  // L'URL de visite garde l'hôte d'origine, mais sans fragment ni paramètres de suivi.
  parsed.hash = "";
  parsed.search = search;
  parsed.pathname = pathname || "/";

  return {
    url: parsed.toString(),
    urlKey: `${domain}${pathname}${search}`.toLowerCase(),
    domain,
  };
}
