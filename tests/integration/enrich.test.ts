import { existsSync, readFileSync } from "node:fs";
import { Readable } from "node:stream";
import sharp from "sharp";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Resolver, Transport } from "@/server/enrich/safeFetch";

// Extraction complète (page → base → Storage) contre la base locale. Le réseau est simulé :
// les pages sont les fixtures réelles, les images sont générées.

if (existsSync(".env.local")) process.loadEnvFile(".env.local");
const hasDb = Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);

const fixture = (name: string) => readFileSync(`src/server/enrich/__fixtures__/${name}`, "utf8");

describe.skipIf(!hasDb)("extraction depuis un lien", async () => {
  if (!hasDb) return;
  const { getServiceDb } = await import("@/server/db/client");
  const { enrichItem, enrichPending, runEnrichment } = await import("@/server/enrich/run");
  const db = getServiceDb();

  // Produit sur fond blanc (détection du fond clair) et une petite image à ignorer.
  const productPng = await sharp({ create: { width: 900, height: 900, channels: 3, background: "#ffffff" } })
    .composite([
      {
        input: Buffer.from(
          '<svg width="400" height="500"><rect width="400" height="500" rx="40" fill="#2f4f6f"/></svg>',
        ),
        top: 200,
        left: 250,
      },
    ])
    .png()
    .toBuffer();
  const tinyPng = await sharp({ create: { width: 60, height: 60, channels: 3, background: "#000" } })
    .png()
    .toBuffer();

  const pages: Record<string, { status: number; type: string; body: Buffer | string }> = {
    "https://www.fnac.com/a23346450/Maxime-Chattam-Morsures": {
      status: 200,
      type: "text/html; charset=utf-8",
      body: fixture("fnac.html"),
    },
    "https://www.leboncoin.fr/ad/ameublement/3260823142": {
      status: 200,
      type: "text/html",
      body: fixture("leboncoin.html"),
    },
    "https://www.amazon.fr/dp/B0TEST0001": {
      status: 202,
      type: "text/html",
      body: fixture("amazon-blocked.html"),
    },
  };
  const requests: string[] = [];
  const transport: Transport = async ({ url }) => {
    const href = url.toString();
    requests.push(href);
    const page = pages[href];
    if (page) {
      return {
        status: page.status,
        headers: { "content-type": page.type },
        body: Readable.from([Buffer.from(page.body)]),
      };
    }
    // Toutes les images : la première candidate est trop petite pour leboncoin, valable ailleurs.
    const image =
      href.includes("leboncoin") && href.includes("rule=ad-large") && !requests.includes("tiny-served")
        ? (requests.push("tiny-served"), tinyPng)
        : productPng;
    return { status: 200, headers: { "content-type": "image/png" }, body: Readable.from([image]) };
  };
  const resolve: Resolver = async () => [{ address: "93.184.215.14", family: 4 }];
  const deps = { db, fetchOptions: { transport, resolve } };

  let listId = "";
  let lecture = "";
  const insertItem = async (url: string, extra: Record<string, unknown> = {}) => {
    const { data, error } = await db
      .from("items")
      .insert({
        list_id: listId,
        url,
        url_key: `${url}-${Math.random()}`,
        domain: new URL(url).hostname,
        position: `a${Math.random().toString(36).slice(2, 8)}`,
        fetch_status: "pending",
        ...extra,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return data.id;
  };
  const row = async (id: string) => (await db.from("items").select("*").eq("id", id).single()).data!;

  beforeAll(async () => {
    const { data: list } = await db
      .from("lists")
      .insert({ slug: `test-enrich-${Date.now()}`, title: "Test extraction", owner_name: "Test" })
      .select("id")
      .single();
    listId = list!.id;
    const { data: cats } = await db
      .from("categories")
      .insert([
        { list_id: listId, name: "Maison & déco", position: "a0" },
        { list_id: listId, name: "Lecture & carnets", position: "a1" },
      ])
      .select("id, name");
    lecture = cats!.find((c) => c.name.startsWith("Lecture"))!.id;
  });

  afterAll(async () => {
    if (!listId) return;
    const { data } = await db.from("items").select("image_path").eq("list_id", listId);
    const paths = (data ?? []).flatMap((r) =>
      r.image_path ? [`${r.image_path}-1200.webp`, `${r.image_path}-480.webp`] : [],
    );
    if (paths.length) await db.storage.from("item-images").remove(paths);
    await db.from("lists").delete().eq("id", listId);
  });

  it("Fnac : nom, prix, photo (fond clair), catégorie proposée, statut ok", async () => {
    const id = await insertItem("https://www.fnac.com/a23346450/Maxime-Chattam-Morsures");
    const [outcome] = await runEnrichment([id], deps);
    expect(outcome).toMatchObject({ itemId: id, status: "ok" });
    const r = await row(id);
    expect(r).toMatchObject({
      title: "Morsures",
      price_cents: 2390,
      currency: "EUR",
      price_source: "page",
      fetch_status: "ok",
      fetch_error: null,
      fetch_attempts: 1,
      suggested_category_id: lecture,
      image_width: 900,
      image_height: 900,
      domain: "fnac.com",
    });
    expect(r.description).toMatch(/station balnéaire/);
    expect(r.image_path).toMatch(new RegExp(`^items/${listId}/${id}/[0-9a-f]{8}$`));
    expect(r.image_source_url).toMatch(/^https:\/\/static\.fnac-static\.com\//);
    expect((r.image_candidates as string[]).length).toBe(2);
    expect(r.meta).toMatchObject({
      lightBackground: true,
      siteName: "FNAC.COM",
      breadcrumb: ["Accueil", "Livre", "Roman Policier et Thriller", "Meilleures ventes Polar"],
    });
    const { data: files } = await db.storage.from("item-images").list(`items/${listId}/${id}`);
    expect(files!.map((f) => f.name).sort()).toEqual([
      `${r.image_path!.split("/").pop()}-1200.webp`,
      `${r.image_path!.split("/").pop()}-480.webp`,
    ]);
  });

  it("ne remplace pas ce qui a été saisi à la main ; image trop petite ignorée", async () => {
    const id = await insertItem("https://www.leboncoin.fr/ad/ameublement/3260823142", {
      title: "Ma lampe",
      price_cents: 1500,
      currency: "EUR",
      price_source: "manual",
    });
    await enrichItem(id, "initial", deps);
    const r = await row(id);
    expect(r).toMatchObject({
      title: "Ma lampe",
      price_cents: 1500,
      price_source: "manual",
      fetch_status: "ok",
    });
    expect(r.description).toMatch(/^Je vends cette petite lampe vintage/);
    // La première candidate (60 px) a été écartée, la suivante retenue.
    expect(r.image_source_url).not.toBe((r.image_candidates as string[])[0]);
  });

  it("relecture : écrase le prix trouvé, garde nom et photo", async () => {
    const id = await insertItem("https://www.fnac.com/a23346450/Maxime-Chattam-Morsures?v=2", {
      title: "Mon livre",
      price_cents: 2990,
      currency: "EUR",
      price_source: "manual",
    });
    pages["https://www.fnac.com/a23346450/Maxime-Chattam-Morsures?v=2"] =
      pages["https://www.fnac.com/a23346450/Maxime-Chattam-Morsures"]!;
    await enrichItem(id, "initial", deps);
    const before = await row(id);
    const outcome = await enrichItem(id, "refetch", deps);
    expect(outcome).toMatchObject({ priceBefore: 2990, priceAfter: 2390, currency: "EUR" });
    const r = await row(id);
    expect(r).toMatchObject({
      title: "Mon livre",
      price_cents: 2390,
      price_source: "page",
      image_path: before.image_path,
    });
  });

  it("Amazon bloqué : « Rien trouvé » (failed, blocked)", async () => {
    const id = await insertItem("https://www.amazon.fr/dp/B0TEST0001");
    const [outcome] = await runEnrichment([id], deps);
    expect(outcome).toMatchObject({ status: "failed", error: "blocked" });
    expect(await row(id)).toMatchObject({ fetch_status: "failed", fetch_error: "blocked", title: null });
  });

  it("adresse interne : refusée, l'article passe en failed (ssrf)", async () => {
    const id = await insertItem("http://169.254.169.254/latest/meta-data/");
    await enrichItem(id, "initial", deps);
    expect(await row(id)).toMatchObject({ fetch_status: "failed", fetch_error: "ssrf" });
  });

  it("relance des articles en attente : jamais commencés, puis abandon après 3 essais", async () => {
    const fresh = await insertItem("https://www.fnac.com/a23346450/Maxime-Chattam-Morsures?v=3");
    pages["https://www.fnac.com/a23346450/Maxime-Chattam-Morsures?v=3"] =
      pages["https://www.fnac.com/a23346450/Maxime-Chattam-Morsures"]!;
    const stuck = await insertItem("https://exemple.fr/bloque", {
      fetch_attempts: 3,
      fetch_started_at: new Date(Date.now() - 60_000).toISOString(),
    });
    const recent = await insertItem("https://exemple.fr/en-cours", {
      fetch_started_at: new Date().toISOString(),
    });
    const results = await enrichPending(listId, deps);
    expect(results.map((r) => r.itemId).sort()).toEqual([fresh, stuck].sort());
    expect(await row(fresh)).toMatchObject({ fetch_status: "ok" });
    expect(await row(stuck)).toMatchObject({ fetch_status: "failed", fetch_error: "stale" });
    expect(await row(recent)).toMatchObject({ fetch_status: "pending" });
  });
});
