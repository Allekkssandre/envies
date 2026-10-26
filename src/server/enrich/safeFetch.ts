import "server-only";
import { lookup } from "node:dns/promises";
import http from "node:http";
import https from "node:https";
import { BlockList, isIP } from "node:net";
import type { Readable } from "node:stream";
import zlib from "node:zlib";

// Récupération d'une page ou d'une image depuis un lien collé (docs/07-extraction-liens.md § 3).
// Protection SSRF : le nom est résolu ici, chaque adresse vérifiée, et la connexion part vers
// l'adresse vérifiée (pas de seconde résolution). Redirections suivies à la main, même contrôle à chaque saut.

export type FetchError =
  | "timeout"
  | "blocked"
  | "not_html"
  | "not_image"
  | "too_large"
  | "http_4xx"
  | "http_5xx"
  | "ssrf"
  | "dns"
  | "network"
  | "redirects";

export type FetchFail = { ok: false; error: FetchError };
export type HtmlResult = { ok: true; html: string; finalUrl: string } | FetchFail;
export type BinaryResult = { ok: true; body: Buffer; contentType: string; finalUrl: string } | FetchFail;

type Address = { address: string; family: number };
export type Resolver = (host: string) => Promise<Address[]>;

export type TransportRequest = {
  url: URL;
  address: Address;
  headers: Record<string, string>;
  signal: AbortSignal;
};
export type TransportResponse = {
  status: number;
  headers: Record<string, string | undefined>;
  body: Readable;
};
export type Transport = (req: TransportRequest) => Promise<TransportResponse>;

type Mode = "html" | "json" | "image";
export type SafeFetchOptions = {
  timeoutMs?: number;
  maxBytes?: number;
  /** Tests : résolution DNS et transport simulés. */
  resolve?: Resolver;
  transport?: Transport;
};

const MAX_REDIRECTS = 5;
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36";
const ACCEPT: Record<Mode, string> = {
  html: "text/html,application/xhtml+xml",
  json: "application/json,text/javascript,*/*;q=0.5",
  image: "image/avif,image/webp,image/png,image/jpeg,image/*;q=0.8",
};

// ---------------------------------------------------------------------------
// Adresses interdites
// ---------------------------------------------------------------------------

// Deux listes séparées : une BlockList mixte applique aussi les règles IPv6 aux IPv4 (adresses mappées).
const blockedV4 = new BlockList();
const blockedV6 = new BlockList();
for (const [net, prefix] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.88.99.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
] as const) {
  blockedV4.addSubnet(net, prefix, "ipv4");
}
for (const [net, prefix] of [
  ["::", 128],
  ["::1", 128],
  ["64:ff9b::", 96],
  ["100::", 64],
  ["2001::", 32],
  ["2001:db8::", 32],
  ["2002::", 16],
  ["fc00::", 7],
  ["fe80::", 10],
  ["ff00::", 8],
] as const) {
  blockedV6.addSubnet(net, prefix, "ipv6");
}

/** Adresse privée, de bouclage, lien-local, multicast ou réservée. */
export function isForbiddenAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 0) return true;
  if (family === 6) {
    // IPv4 mappée (::ffff:a.b.c.d ou ::ffff:7f00:1) : refusée d'office.
    if (/^(0{0,4}:){0,5}:?ffff:/i.test(address.replace(/^::/, "0::"))) return true;
    return blockedV6.check(address, "ipv6");
  }
  return blockedV4.check(address, "ipv4");
}

/**
 * Tests de bout en bout uniquement : un serveur local de pages d'exemple (`127.0.0.1:port`).
 * Jamais actif sur Vercel.
 */
function allowedForTests(host: string, port: string): boolean {
  const allow = process.env.ENRICH_TEST_ALLOW;
  if (!allow || process.env.VERCEL) return false;
  return allow.split(",").includes(`${host}:${port}`);
}

const defaultResolve: Resolver = async (host) => lookup(host, { all: true, verbatim: true });

async function checkTarget(url: URL, resolve: Resolver): Promise<Address | FetchError> {
  if (url.protocol !== "http:" && url.protocol !== "https:") return "ssrf";
  if (url.username || url.password) return "ssrf";
  const host = url.hostname.replace(/^\[|\]$/g, "");
  const port = url.port || (url.protocol === "https:" ? "443" : "80");
  if (allowedForTests(host, port)) return { address: host, family: isIP(host) || 4 };
  if (port !== "80" && port !== "443") return "ssrf";
  if (isIP(host)) return isForbiddenAddress(host) ? "ssrf" : { address: host, family: isIP(host) };
  if (!host.includes(".") || /\.(local|localhost|internal|lan|home\.arpa)$/i.test(host)) return "ssrf";
  let addresses: Address[];
  try {
    addresses = await resolve(host);
  } catch {
    return "dns";
  }
  if (!addresses.length) return "dns";
  if (addresses.some((a) => isForbiddenAddress(a.address))) return "ssrf";
  return addresses[0]!;
}

// ---------------------------------------------------------------------------
// Transport réel (node:http / node:https), connexion à l'adresse vérifiée
// ---------------------------------------------------------------------------

const nodeTransport: Transport = ({ url, address, headers, signal }) =>
  new Promise((resolvePromise, reject) => {
    const client = url.protocol === "https:" ? https : http;
    const req = client.request(
      url,
      {
        method: "GET",
        headers,
        signal,
        // Pas de seconde résolution : on se connecte à l'adresse déjà vérifiée.
        lookup: (_host, options, callback) => {
          const cb = callback as (...args: unknown[]) => void;
          if ((options as { all?: boolean }).all)
            cb(null, [{ address: address.address, family: address.family }]);
          else cb(null, address.address, address.family);
        },
      },
      (res) => {
        const flat: Record<string, string | undefined> = {};
        for (const [k, v] of Object.entries(res.headers)) flat[k] = Array.isArray(v) ? v.join(", ") : v;
        resolvePromise({ status: res.statusCode ?? 0, headers: flat, body: res });
      },
    );
    req.on("error", reject);
    req.end();
  });

function decompress(body: Readable, encoding: string | undefined): Readable {
  switch ((encoding ?? "").trim().toLowerCase()) {
    case "gzip":
    case "x-gzip":
      return body.pipe(zlib.createGunzip());
    case "deflate":
      return body.pipe(zlib.createInflate());
    case "br":
      return body.pipe(zlib.createBrotliDecompress());
    default:
      return body;
  }
}

class TooLarge extends Error {}

async function readLimited(stream: Readable, maxBytes: number): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of stream) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as Uint8Array);
    size += buf.length;
    if (size > maxBytes) {
      stream.destroy();
      throw new TooLarge();
    }
    chunks.push(buf);
  }
  return Buffer.concat(chunks);
}

// ---------------------------------------------------------------------------
// Décodage et détection des pages de blocage
// ---------------------------------------------------------------------------

function charsetOf(contentType: string | undefined, head: string): string {
  const fromHeader = /charset=["']?([\w-]+)/i.exec(contentType ?? "")?.[1];
  if (fromHeader) return fromHeader;
  const fromMeta =
    /<meta[^>]+charset=["']?([\w-]+)/i.exec(head)?.[1] ??
    /<meta[^>]+content=["'][^"']*charset=([\w-]+)/i.exec(head)?.[1];
  return fromMeta ?? "utf-8";
}

export function decodeHtml(body: Buffer, contentType?: string): string {
  const head = body.subarray(0, 4096).toString("latin1");
  const charset = charsetOf(contentType, head);
  try {
    return new TextDecoder(charset).decode(body);
  } catch {
    return new TextDecoder("utf-8").decode(body);
  }
}

const BLOCK_TITLE =
  /robot check|captcha|access denied|just a moment|attention required|are you a robot|pardon our interruption/i;
const BLOCK_MARKERS =
  /captcha-delivery\.com|AwsWafIntegration|cf-chl-|challenge-platform|px-captcha|\bdd=\{'rt'/;

/** Page de vérification anti-robot (captcha, WAF) à la place du produit. */
export function looksBlocked(html: string): boolean {
  const title = /<title[^>]*>([^<]*)<\/title>/i.exec(html)?.[1] ?? "";
  if (BLOCK_TITLE.test(title)) return true;
  return html.length < 20_000 && BLOCK_MARKERS.test(html);
}

// ---------------------------------------------------------------------------

async function fetchBytes(
  input: string,
  mode: Mode,
  { timeoutMs = 8000, maxBytes, resolve = defaultResolve, transport = nodeTransport }: SafeFetchOptions = {},
): Promise<{ ok: true; body: Buffer; contentType: string; finalUrl: string; status: number } | FetchFail> {
  const limit = maxBytes ?? (mode === "image" ? 10 * 1024 * 1024 : 3 * 1024 * 1024);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    clearTimeout(timer);
    return { ok: false, error: "ssrf" };
  }
  try {
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      const target = await checkTarget(url, resolve);
      if (typeof target === "string") return { ok: false, error: target };
      const res = await transport({
        url,
        address: target,
        signal: controller.signal,
        headers: {
          "User-Agent": USER_AGENT,
          Accept: ACCEPT[mode],
          "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.6",
          "Accept-Encoding": "gzip, deflate, br",
        },
      });

      if (res.status >= 300 && res.status < 400 && res.headers.location) {
        res.body.resume();
        try {
          url = new URL(res.headers.location, url);
        } catch {
          return { ok: false, error: "http_4xx" };
        }
        continue;
      }
      if (res.status === 403 || res.status === 429 || res.status === 503) {
        res.body.resume();
        return { ok: false, error: "blocked" };
      }
      if (res.status >= 500) {
        res.body.resume();
        return { ok: false, error: "http_5xx" };
      }
      if (res.status >= 400) {
        res.body.resume();
        return { ok: false, error: "http_4xx" };
      }

      const contentType = (res.headers["content-type"] ?? "").toLowerCase();
      if (mode === "image" && !contentType.startsWith("image/")) {
        res.body.resume();
        return { ok: false, error: "not_image" };
      }
      if (mode === "html" && contentType && !/text\/html|application\/xhtml\+xml/.test(contentType)) {
        res.body.resume();
        return { ok: false, error: "not_html" };
      }
      if (Number(res.headers["content-length"] ?? 0) > limit && !res.headers["content-encoding"]) {
        res.body.destroy();
        return { ok: false, error: "too_large" };
      }
      const body = await readLimited(decompress(res.body, res.headers["content-encoding"]), limit);
      return { ok: true, body, contentType, finalUrl: url.toString(), status: res.status };
    }
    return { ok: false, error: "redirects" };
  } catch (error) {
    if (error instanceof TooLarge) return { ok: false, error: "too_large" };
    if (controller.signal.aborted) return { ok: false, error: "timeout" };
    const code = (error as { code?: string }).code ?? "";
    if (code === "ENOTFOUND" || code === "EAI_AGAIN") return { ok: false, error: "dns" };
    return { ok: false, error: "network" };
  } finally {
    clearTimeout(timer);
  }
}

/** Page HTML : 8 s, 3 Mo, décodée selon son jeu de caractères. Pages de captcha → `blocked`. */
export async function safeFetch(url: string, options?: SafeFetchOptions): Promise<HtmlResult> {
  const res = await fetchBytes(url, "html", options);
  if (!res.ok) return res;
  const html = decodeHtml(res.body, res.contentType);
  if (looksBlocked(html) || (res.status === 202 && html.length < 20_000))
    return { ok: false, error: "blocked" };
  return { ok: true, html, finalUrl: res.finalUrl };
}

/** Image : 8 s, 10 Mo, `image/*` exigé. */
export async function safeFetchImage(url: string, options?: SafeFetchOptions): Promise<BinaryResult> {
  const res = await fetchBytes(url, "image", options);
  if (!res.ok) return res;
  return { ok: true, body: res.body, contentType: res.contentType, finalUrl: res.finalUrl };
}

/** JSON public (ex. produit Shopify `<url>.js`) : 8 s, 1 Mo. `null` en cas d'échec. */
export async function safeFetchJson(url: string, options?: SafeFetchOptions): Promise<unknown | null> {
  const res = await fetchBytes(url, "json", { maxBytes: 1024 * 1024, ...options });
  if (!res.ok) return null;
  try {
    return JSON.parse(res.body.toString("utf8")) as unknown;
  } catch {
    return null;
  }
}
