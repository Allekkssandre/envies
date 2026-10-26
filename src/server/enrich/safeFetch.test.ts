import { Readable } from "node:stream";
import { gzipSync } from "node:zlib";
import { describe, expect, it, vi } from "vitest";
import {
  decodeHtml,
  isForbiddenAddress,
  safeFetch,
  safeFetchImage,
  type Resolver,
  type Transport,
  type TransportResponse,
} from "./safeFetch";

const publicIp: Resolver = async () => [{ address: "93.184.215.14", family: 4 }];

function response(status: number, headers: Record<string, string>, body = ""): TransportResponse {
  return { status, headers, body: Readable.from([Buffer.from(body)]) };
}

describe("safeFetch : protection SSRF", () => {
  it.each([
    "http://localhost/",
    "http://127.0.0.1/",
    "http://169.254.169.254/latest/meta-data/",
    "http://[::1]/",
    "http://0.0.0.0/",
    "http://10.0.0.1/",
    "http://192.168.1.1/",
    "http://[::ffff:127.0.0.1]/",
    "https://exemple.fr:8443/",
    "ftp://exemple.fr/",
    "http://intranet/",
  ])("refuse %s sans se connecter", async (url) => {
    const transport = vi.fn<Transport>();
    const res = await safeFetch(url, { transport });
    expect(res).toEqual({ ok: false, error: "ssrf" });
    expect(transport).not.toHaveBeenCalled();
  });

  it("refuse un domaine qui résout vers 10.x (ou dont une des adresses est privée)", async () => {
    const transport = vi.fn<Transport>();
    expect(
      await safeFetch("https://piege.exemple.fr/", {
        resolve: async () => [{ address: "10.1.2.3", family: 4 }],
        transport,
      }),
    ).toEqual({ ok: false, error: "ssrf" });
    expect(
      await safeFetch("https://piege.exemple.fr/", {
        resolve: async () => [
          { address: "93.184.215.14", family: 4 },
          { address: "fd00::1", family: 6 },
        ],
        transport,
      }),
    ).toEqual({ ok: false, error: "ssrf" });
    expect(transport).not.toHaveBeenCalled();
  });

  it.each([
    "http://127.0.0.1/admin",
    "http://169.254.169.254/",
    "http://localhost:3000/",
    "http://interne.exemple.fr/",
  ])("refuse une redirection vers %s", async (location) => {
    const transport = vi.fn<Transport>(async () => response(302, { location }));
    const resolve: Resolver = async (host) =>
      host === "interne.exemple.fr" ? [{ address: "192.168.0.10", family: 4 }] : publicIp(host);
    const res = await safeFetch("https://boutique.exemple.fr/produit", { resolve, transport });
    expect(res).toEqual({ ok: false, error: "ssrf" });
    expect(transport).toHaveBeenCalledTimes(1);
  });

  it("se connecte à l'adresse vérifiée, suit les redirections permises (5 au plus)", async () => {
    const seen: string[] = [];
    const transport: Transport = async ({ url, address }) => {
      seen.push(`${url.href} @ ${address.address}`);
      if (url.pathname === "/a") return response(301, { location: "/b" });
      return response(200, { "content-type": "text/html; charset=utf-8" }, "<title>Vase</title>");
    };
    const res = await safeFetch("https://boutique.exemple.fr/a", { resolve: publicIp, transport });
    expect(res).toEqual({ ok: true, html: "<title>Vase</title>", finalUrl: "https://boutique.exemple.fr/b" });
    expect(seen).toEqual([
      "https://boutique.exemple.fr/a @ 93.184.215.14",
      "https://boutique.exemple.fr/b @ 93.184.215.14",
    ]);

    const loop: Transport = async ({ url }) => response(302, { location: url.pathname + "x" });
    expect(await safeFetch("https://boutique.exemple.fr/", { resolve: publicIp, transport: loop })).toEqual({
      ok: false,
      error: "redirects",
    });
  });

  it("adresses interdites", () => {
    for (const ip of [
      "127.0.0.1",
      "10.0.0.1",
      "172.20.1.1",
      "192.168.0.1",
      "169.254.169.254",
      "100.64.0.1",
      "0.0.0.0",
      "224.0.0.1",
      "255.255.255.255",
      "::1",
      "fe80::1",
      "fc00::1",
      "::ffff:10.0.0.1",
    ])
      expect(isForbiddenAddress(ip), ip).toBe(true);
    for (const ip of ["93.184.215.14", "151.101.1.69", "2606:4700::6810:84e5"])
      expect(isForbiddenAddress(ip), ip).toBe(false);
  });
});

describe("safeFetch : réponses", () => {
  const fetchWith = (res: TransportResponse) =>
    safeFetch("https://boutique.exemple.fr/", { resolve: publicIp, transport: async () => res });

  it("403, 429, 503 et pages de captcha → blocked", async () => {
    for (const status of [403, 429, 503])
      expect(await fetchWith(response(status, {}))).toEqual({ ok: false, error: "blocked" });
    expect(
      await fetchWith(response(200, { "content-type": "text/html" }, "<title>Robot Check</title>")),
    ).toEqual({ ok: false, error: "blocked" });
    expect(await fetchWith(response(202, { "content-type": "text/html" }, "<title></title>"))).toEqual({
      ok: false,
      error: "blocked",
    });
  });

  it("404 → http_4xx, 500 → http_5xx, PDF → not_html, trop gros → too_large", async () => {
    expect(await fetchWith(response(404, {}))).toEqual({ ok: false, error: "http_4xx" });
    expect(await fetchWith(response(500, {}))).toEqual({ ok: false, error: "http_5xx" });
    expect(await fetchWith(response(200, { "content-type": "application/pdf" }))).toEqual({
      ok: false,
      error: "not_html",
    });
    const big = response(200, { "content-type": "text/html" }, "x".repeat(4 * 1024 * 1024));
    expect(await fetchWith(big)).toEqual({ ok: false, error: "too_large" });
  });

  it("délai dépassé → timeout", async () => {
    const slow: Transport = ({ signal }) =>
      new Promise((_, reject) => signal.addEventListener("abort", () => reject(new Error("aborted"))));
    expect(
      await safeFetch("https://boutique.exemple.fr/", { resolve: publicIp, transport: slow, timeoutMs: 50 }),
    ).toEqual({ ok: false, error: "timeout" });
  });

  it("gzip décompressé, jeu de caractères de l'en-tête ou de <meta charset>", async () => {
    const gz: TransportResponse = {
      status: 200,
      headers: { "content-type": "text/html", "content-encoding": "gzip" },
      body: Readable.from([gzipSync(Buffer.from("<title>Thé</title>"))]),
    };
    expect(await fetchWith(gz)).toMatchObject({ ok: true, html: "<title>Thé</title>" });
    const latin1 = Buffer.from('<meta charset="windows-1252"><title>Caf\xe9</title>', "latin1");
    expect(decodeHtml(latin1)).toContain("Café");
    expect(decodeHtml(Buffer.from("<title>Café</title>"), "text/html; charset=utf-8")).toContain("Café");
  });

  it("image : type image/* exigé", async () => {
    const res = await safeFetchImage("https://cdn.exemple.fr/a.jpg", {
      resolve: publicIp,
      transport: async () => response(200, { "content-type": "text/html" }, "<html>"),
    });
    expect(res).toEqual({ ok: false, error: "not_image" });
  });
});
