import { existsSync, readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { guessColumns } from "@/lib/import/columns";
import { convertRows, type ImportRow } from "@/lib/import/convert";
import { readFile } from "@/lib/import/read";
import { normalizeUrl } from "@/lib/normalizeUrl";

// Import puis export contre la base locale. La lecture des liens est notée, pas lancée.

if (existsSync(".env.local")) process.loadEnvFile(".env.local");
const hasDb = Boolean(
  process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.EDIT_TOKEN_SECRET,
);

const jar = new Map<string, string>();
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (jar.has(name) ? { name, value: jar.get(name)! } : undefined),
    set: (name: string, value: string) => jar.set(name, value),
    delete: (arg: string | { name: string }) => jar.delete(typeof arg === "string" ? arg : arg.name),
  }),
  headers: async () => new Headers({ "x-forwarded-for": "198.51.100.8" }),
}));
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));
const later: (() => unknown)[] = [];
vi.mock("next/server", async (original) => ({
  ...(await original<typeof import("next/server")>()),
  after: (fn: () => unknown) => later.push(fn),
}));

const columnsOf = (rows: string[][]) => rows[0]!.map((_, c) => rows.slice(1).map((r) => r[c] ?? ""));

describe.skipIf(!hasDb)("import et export", async () => {
  if (!hasDb) return;
  const { getServiceDb } = await import("@/server/db/client");
  const { signEditToken } = await import("@/server/auth/token");
  const { importItems } = await import("@/server/actions/import");
  const { GET } = await import("@/app/api/lists/[id]/export/route");
  const db = getServiceDb();
  const listIds: string[] = [];

  async function createList(name: string, categories: string[] = []) {
    const { data: list } = await db
      .from("lists")
      .insert({ slug: `test-import-${name}-${Date.now()}`, title: `Test import ${name}`, owner_name: "Test" })
      .select("id")
      .single();
    const id = list!.id;
    listIds.push(id);
    await db
      .from("list_secrets")
      .insert({ list_id: id, password_hash: "scrypt$x", edit_key: `I${name}${Date.now()}` });
    if (categories.length)
      await db
        .from("categories")
        .insert(categories.map((n, i) => ({ list_id: id, name: n, position: `a${i}` })));
    jar.set(
      `envies_edit_${id}`,
      signEditToken({ l: id, v: 1, e: Math.floor(Date.now() / 1000) + 3600 }, process.env.EDIT_TOKEN_SECRET!),
    );
    return id;
  }

  /** Comme le navigateur : lots de 200, envoyés du dernier au premier. */
  async function send(listId: string, rows: ImportRow[], options = { enrich: false, sorted: false }) {
    const batches: ImportRow[][] = [];
    for (let i = 0; i < rows.length; i += 200) batches.push(rows.slice(i, i + 200));
    const totals = { created: 0, duplicates: 0, categories: [] as string[], tags: [] as string[] };
    for (const batch of batches.reverse()) {
      const r = await importItems({ listId, rows: batch, ...options });
      if (!r.ok) throw new Error(r.error.message);
      totals.created += r.data.created;
      totals.duplicates += r.data.duplicates;
      totals.categories.push(...r.data.categoriesCreated);
      totals.tags.push(...r.data.tagsCreated);
    }
    return totals;
  }

  async function snapshot(listId: string) {
    const { data } = await db
      .from("items")
      .select(
        "title, url, price_cents, currency, is_favorite, note, position, categories!items_category_id_fkey(name), item_tags(tags(name))",
      )
      .eq("list_id", listId)
      .is("deleted_at", null)
      .order("position");
    return (data ?? []).map((r) => ({
      title: r.title,
      url: r.url,
      price: r.price_cents,
      currency: r.currency,
      favorite: r.is_favorite,
      note: r.note,
      category: (r.categories as { name: string } | null)?.name ?? null,
      tags: (r.item_tags as { tags: { name: string } | null }[]).map((t) => t.tags?.name).sort(),
    }));
  }

  beforeAll(async () => {
    await db.from("rate_limits").delete().like("bucket", "import:%");
  });

  afterAll(async () => {
    for (const id of listIds) await db.from("lists").delete().eq("id", id);
  });

  it("import-45.xlsx : 43 articles, 2 catégories créées, dans l'ordre du fichier", async () => {
    const listId = await createList("45", ["Déco", "Livres"]);
    const read = await readFile(
      new Uint8Array(readFileSync("tests/fixtures/import-45.xlsx")),
      "import-45.xlsx",
    );
    if (!read.ok) throw new Error(read.error);
    const sheet = read.sheets[0]!;
    const guess = guessColumns(sheet.rows[0]!, columnsOf(sheet.rows));
    const converted = convertRows(sheet.rows, sheet.links, guess.targets, sheet.rows[0]!, {
      headerRow: true,
      listCurrency: "EUR",
      existingKeys: new Set(),
      existingCategories: ["Déco", "Livres"],
      existingTags: [],
    });
    expect(converted.rows).toHaveLength(43);

    const result = await send(listId, converted.rows, { enrich: true, sorted: true });
    expect(result.created).toBe(43);
    expect(result.duplicates).toBe(0);
    expect(result.categories).toEqual(["Jardin", "Cuisine"]);
    expect(result.tags.sort()).toEqual(["cadeau commun", "occasion", "petit prix"]);
    const { count } = await db
      .from("categories")
      .select("id", { count: "exact", head: true })
      .eq("list_id", listId);
    expect(count).toBe(4);

    const items = await snapshot(listId);
    expect(items.map((i) => i.title)).toEqual(converted.rows.map((r) => r.title));
    expect(items[0]).toMatchObject({
      title: "Lampe champignon",
      price: 8900,
      category: "Déco",
      favorite: true,
      note: "vert sauge",
      tags: ["petit prix"],
    });
    // « Ranger directement » : les articles avec catégorie sont rangés ; liens en attente de lecture.
    const { data: pending } = await db.from("items").select("fetch_status, sorted_at").eq("list_id", listId);
    expect(pending!.every((r) => r.sorted_at !== null)).toBe(true);
    expect(pending!.filter((r) => r.fetch_status === "pending")).toHaveLength(
      converted.rows.filter((r) => r.url).length,
    );
    expect(later.length).toBeGreaterThan(0);

    // Réimporter le même fichier : tout est doublon pour les lignes avec lien.
    const again = await send(
      listId,
      converted.rows.filter((r) => r.url),
    );
    expect(again).toMatchObject({ created: 0, duplicates: converted.rows.filter((r) => r.url).length });
  });

  it("export puis import dans une liste vide : mêmes articles, catégories, tags, cœurs, notes, prix", async () => {
    const source = await createList("source", ["Maison & déco", "Lecture & carnets"]);
    const { data: cats } = await db.from("categories").select("id, name").eq("list_id", source);
    const { data: tags } = await db
      .from("tags")
      .insert([
        { list_id: source, name: "Priorité", color: "rouille", position: "a0" },
        { list_id: source, name: "Petit prix", color: "miel", position: "a1" },
      ])
      .select("id, name");
    const cat = (n: string) => cats!.find((c) => c.name === n)!.id;
    const tag = (n: string) => tags!.find((t) => t.name === n)!.id;
    const link = normalizeUrl("https://www.etsy.com/fr/listing/1/lampe?ref=x")!;
    const base = {
      url: null,
      url_key: null,
      domain: null,
      price_cents: null,
      currency: null,
      category_id: null,
      is_favorite: false,
      note: null,
      sorted_at: null,
    };
    const { data: items } = await db
      .from("items")
      .insert([
        {
          ...base,
          list_id: source,
          title: "Lampe",
          url: link.url,
          url_key: link.urlKey,
          domain: link.domain,
          price_cents: 8900,
          currency: "EUR",
          category_id: cat("Maison & déco"),
          is_favorite: true,
          note: "Verte, si possible",
          position: "a0",
          sorted_at: new Date().toISOString(),
        },
        {
          ...base,
          list_id: source,
          title: "Liseuse",
          price_cents: 19990,
          currency: "EUR",
          category_id: cat("Lecture & carnets"),
          position: "a1",
          sorted_at: new Date().toISOString(),
        },
        { ...base, list_id: source, title: "Sac", price_cents: 12000, currency: "CHF", position: "a2" },
        { ...base, list_id: source, title: "Bon pour un massage", note: "Ligne 1\nLigne 2", position: "a3" },
      ])
      .select("id, title");
    const id = (t: string) => items!.find((i) => i.title === t)!.id;
    await db.from("item_tags").insert([
      { item_id: id("Lampe"), tag_id: tag("Priorité") },
      { item_id: id("Lampe"), tag_id: tag("Petit prix") },
      { item_id: id("Liseuse"), tag_id: tag("Petit prix") },
    ]);

    const res = await GET(new Request("http://localhost/") as never, {
      params: Promise.resolve({ id: source }),
    });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-disposition")).toMatch(
      /^attachment; filename="envies-test-import-source-\d+-\d{4}-\d{2}-\d{2}\.xlsx"$/,
    );
    const read = await readFile(new Uint8Array(await res.arrayBuffer()), "export.xlsx");
    if (!read.ok) throw new Error(read.error);
    const sheet = read.sheets[0]!;
    expect(sheet.name).toBe("Liste");
    expect(sheet.rows[0]).toEqual([
      "Nom",
      "Lien",
      "Prix",
      "Devise",
      "Catégorie",
      "Tags",
      "Coup de cœur",
      "Note",
      "Photo",
      "Ajouté le",
    ]);

    const target = await createList("cible");
    const guess = guessColumns(sheet.rows[0]!, columnsOf(sheet.rows));
    const converted = convertRows(sheet.rows, sheet.links, guess.targets, sheet.rows[0]!, {
      headerRow: true,
      listCurrency: "EUR",
      existingKeys: new Set(),
      existingCategories: [],
      existingTags: [],
    });
    await send(target, converted.rows, { enrich: false, sorted: true });

    const strip = (rows: Awaited<ReturnType<typeof snapshot>>) =>
      rows.map(({ title, url, price, currency, favorite, note, category, tags: t }) => ({
        title,
        url,
        price,
        currency,
        favorite,
        note,
        category,
        tags: t,
      }));
    expect(strip(await snapshot(target))).toEqual(strip(await snapshot(source)));
    const { data: targetCats } = await db
      .from("categories")
      .select("name")
      .eq("list_id", target)
      .order("position");
    expect(targetCats!.map((c) => c.name)).toEqual(["Maison & déco", "Lecture & carnets"]);
  });
});
