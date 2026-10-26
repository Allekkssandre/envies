import { existsSync } from "node:fs";
import sharp from "sharp";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

// Actions serveur contre la base locale (supabase start). Les API de Next liées à la requête
// (cookies, en-têtes, cache) sont simulées ; tout le reste est réel.

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
  headers: async () => new Headers({ "x-forwarded-for": "198.51.100.7" }),
}));
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));
// `after()` : la lecture des liens est notée ici, pas lancée (le réseau n'est pas utilisé).
const later: (() => unknown)[] = [];
vi.mock("next/server", () => ({ after: (fn: () => unknown) => later.push(fn) }));

describe.skipIf(!hasDb)("actions d'édition", async () => {
  // Le corps est exécuté même quand le bloc est ignoré : rien à préparer sans base.
  if (!hasDb) return;
  const { getServiceDb } = await import("@/server/db/client");
  const { signEditToken } = await import("@/server/auth/token");
  const items = await import("@/server/actions/items");
  const taxonomy = await import("@/server/actions/taxonomy");
  const db = getServiceDb();

  let listId = "";
  let maison = "";
  let lecture = "";
  const unlock = () =>
    jar.set(
      `envies_edit_${listId}`,
      signEditToken(
        { l: listId, v: 1, e: Math.floor(Date.now() / 1000) + 3600 },
        process.env.EDIT_TOKEN_SECRET!,
      ),
    );

  beforeAll(async () => {
    const slug = `test-integration-${Date.now()}`;
    const { data: list } = await db
      .from("lists")
      .insert({ slug, title: "Test intégration", owner_name: "Test" })
      .select("id")
      .single();
    listId = list!.id;
    await db
      .from("list_secrets")
      .insert({ list_id: listId, password_hash: "scrypt$x", edit_key: `T${Date.now()}` });
    const { data: cats } = await db
      .from("categories")
      .insert([
        { list_id: listId, name: "Maison & déco", position: "a0" },
        { list_id: listId, name: "Lecture & carnets", position: "a1" },
      ])
      .select("id, name");
    maison = cats!.find((c) => c.name.startsWith("Maison"))!.id;
    lecture = cats!.find((c) => c.name.startsWith("Lecture"))!.id;
    await db.from("rate_limits").delete().like("bucket", `%${listId}%`);
  });

  afterAll(async () => {
    if (listId) await db.from("lists").delete().eq("id", listId);
  });

  it("chaque action renvoie EDIT_LOCKED sans cookie", async () => {
    jar.clear();
    const { data: seedItem } = await db
      .from("items")
      .insert({ list_id: listId, title: "Témoin", position: "Zz" })
      .select("id")
      .single();
    const itemId = seedItem!.id;
    const photo = new FormData();
    photo.set("listId", listId);
    photo.set("file", new File([new Uint8Array([1, 2, 3])], "a.png", { type: "image/png" }));
    const setImage = new FormData();
    setImage.set("itemId", itemId);
    setImage.set("remove", "1");

    const results = await Promise.all([
      items.addItems({ listId, lines: ["Un bon pour un massage"] }),
      items.addItemWithPhoto(photo),
      items.updateItem({ itemId, patch: { isFavorite: true } }),
      items.setItemImage(setImage),
      items.deleteItems({ itemIds: [itemId] }),
      items.restoreItems({ itemIds: [itemId] }),
      items.moveItem({ itemId, categoryId: maison }),
      items.bulkUpdate({ itemIds: [itemId], isFavorite: true }),
      items.sortAllInbox({ listId, categoryId: maison }),
      items.refetchItem({ itemId }),
      taxonomy.createCategory({ listId, name: "Sport" }),
      taxonomy.renameCategory({ listId, categoryId: maison, name: "Maison" }),
      taxonomy.moveCategory({ listId, categoryId: maison, afterId: lecture }),
      taxonomy.createTag({ listId, name: "Priorité" }),
    ]);
    for (const r of results) expect(r).toMatchObject({ ok: false, error: { code: "EDIT_LOCKED" } });

    // Un jeton d'une autre version (mot de passe changé) est refusé aussi.
    jar.set(
      `envies_edit_${listId}`,
      signEditToken(
        { l: listId, v: 2, e: Math.floor(Date.now() / 1000) + 3600 },
        process.env.EDIT_TOKEN_SECRET!,
      ),
    );
    expect(await items.addItems({ listId, lines: ["x"] })).toMatchObject({ error: { code: "EDIT_LOCKED" } });
    await db.from("items").delete().eq("id", itemId);
  });

  it("ajout de 5 liens : en tête de « À trier », dans l'ordre, doublons à part", async () => {
    unlock();
    const lines = [1, 2, 3, 4, 5].map((n) => `https://www.etsy.com/fr/listing/${n}/objet?utm_source=x`);
    const first = await items.addItems({ listId, lines });
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(first.data.created).toHaveLength(5);
    expect(first.data.created.map((i) => i.url)).toEqual(lines.map((l) => l.replace("?utm_source=x", "")));
    expect(first.data.created.every((i) => i.fetchStatus === "pending" && i.sortedAt === null)).toBe(true);
    // L'extraction est lancée après la réponse, pour les liens seulement.
    expect(later).toHaveLength(1);

    const again = await items.addItems({ listId, lines: [lines[0]!.replace("www.", ""), "Un carnet"] });
    expect(again.ok && again.data.duplicates).toEqual([
      { line: lines[0]!.replace("www.", ""), itemRef: first.data.created[0]!.ref },
    ]);
    expect(again.ok && again.data.created.map((i) => i.title)).toEqual(["Un carnet"]);
  });

  it("supprimer puis annuler : même place", async () => {
    unlock();
    const { data: before } = await db
      .from("items")
      .select("id, position")
      .eq("list_id", listId)
      .is("deleted_at", null)
      .order("position");
    const target = before![2]!;
    expect((await items.deleteItems({ itemIds: [target.id] })).ok).toBe(true);
    const { data: hidden } = await db.from("items").select("deleted_at").eq("id", target.id).single();
    expect(hidden!.deleted_at).not.toBeNull();
    expect(await items.restoreItems({ itemIds: [target.id] })).toMatchObject({
      ok: true,
      data: { restored: [target.id] },
    });
    const { data: after } = await db
      .from("items")
      .select("id, position")
      .eq("list_id", listId)
      .is("deleted_at", null)
      .order("position");
    expect(after).toEqual(before);
  });

  it("annuler une suppression dont le lien a été réajouté : CONFLICT", async () => {
    unlock();
    const added = await items.addItems({ listId, lines: ["https://fnac.com/a/conflit"] });
    const id = added.ok ? added.data.created[0]!.id : "";
    await items.deleteItems({ itemIds: [id] });
    await items.addItems({ listId, lines: ["https://www.fnac.com/a/conflit"] });
    expect(await items.restoreItems({ itemIds: [id] })).toMatchObject({
      ok: false,
      error: { code: "CONFLICT" },
    });
  });

  it("déplacer de « Maison & déco » vers « Lecture & carnets » : catégorie et rang", async () => {
    unlock();
    const a = await items.addItems({ listId, lines: ["Lampe", "Fauteuil"], categoryId: maison });
    const b = await items.addItems({ listId, lines: ["BD", "Liseuse"], categoryId: lecture });
    if (!a.ok || !b.ok) throw new Error("ajout");
    const [lampe] = a.data.created;
    const [bd, liseuse] = b.data.created;
    const moved = await items.moveItem({
      itemId: lampe!.id,
      categoryId: lecture,
      beforeId: bd!.id,
      afterId: liseuse!.id,
    });
    expect(moved.ok).toBe(true);
    const { data } = await db
      .from("items")
      .select("title, category_id, sorted_at")
      .eq("list_id", listId)
      .eq("category_id", lecture)
      .is("deleted_at", null)
      .order("position");
    expect(data!.map((i) => i.title)).toEqual(["BD", "Lampe", "Liseuse"]);
    expect(data!.every((i) => i.sorted_at !== null)).toBe(true);
  });

  it("modifier : prix manuel, catégorie (range l'article), tags, lien en double refusé", async () => {
    unlock();
    const added = await items.addItems({ listId, lines: ["Gourde"] });
    const id = added.ok ? added.data.created[0]!.id : "";
    const tag = await taxonomy.createTag({ listId, name: "Petit prix" });
    const tagId = tag.ok ? tag.data.tag.id : "";
    const updated = await items.updateItem({
      itemId: id,
      patch: { priceCents: 3500, categoryId: maison, tagIds: [tagId], note: " Bleue " },
    });
    expect(updated).toMatchObject({
      ok: true,
      data: {
        priceCents: 3500,
        priceSource: "manual",
        currency: "EUR",
        categoryId: maison,
        tagIds: [tagId],
        note: "Bleue",
      },
    });
    expect(updated.ok && updated.data.sortedAt).not.toBeNull();
    const dup = await items.updateItem({ itemId: id, patch: { url: "etsy.com/fr/listing/1/objet" } });
    expect(dup).toMatchObject({ ok: false, error: { code: "DUPLICATE", message: "Déjà dans la liste" } });
  });

  it("catégorie et tag déjà existants (casse, accents) : renvoie l'existant", async () => {
    unlock();
    const cat = await taxonomy.createCategory({ listId, name: "maison & DECO" });
    expect(cat).toMatchObject({ ok: true, data: { existed: true, category: { id: maison } } });
    const t1 = await taxonomy.createTag({ listId, name: "Envie folle" });
    const t2 = await taxonomy.createTag({ listId, name: "envie FOLLE" });
    expect(t2.ok && t1.ok && t2.data.tag.id).toBe(t1.ok ? t1.data.tag.id : "");
    expect(t1.ok && t1.data.tag.color).not.toBe("rouille"); // « Petit prix » a pris la première couleur
  });

  it("« Tout ranger dans… » vide « À trier »", async () => {
    unlock();
    const r = await items.sortAllInbox({ listId, categoryId: lecture });
    expect(r.ok && r.data.count).toBeGreaterThan(0);
    const { count } = await db
      .from("items")
      .select("id", { count: "exact", head: true })
      .eq("list_id", listId)
      .is("sorted_at", null)
      .is("deleted_at", null);
    expect(count).toBe(0);
  });

  it("photo : WebP 480/1200 dans Storage, fond clair détecté", async () => {
    unlock();
    const png = await sharp({ create: { width: 900, height: 700, channels: 3, background: "#ffffff" } })
      .composite([
        {
          input: Buffer.from(
            '<svg width="300" height="300"><circle cx="150" cy="150" r="140" fill="#8E3B22"/></svg>',
          ),
          top: 200,
          left: 300,
        },
      ])
      .png()
      .toBuffer();
    const form = new FormData();
    form.set("listId", listId);
    form.set("file", new File([new Uint8Array(png)], "photo.png", { type: "image/png" }));
    const r = await items.addItemWithPhoto(form);
    expect(r).toMatchObject({
      ok: true,
      data: { title: "", imageWidth: 900, imageHeight: 700, lightBackground: true },
    });
    if (!r.ok) return;
    const { data: files } = await db.storage.from("item-images").list(`items/${listId}/${r.data.id}`);
    expect(files!.map((f) => f.name).sort()).toEqual([
      `${r.data.imagePath!.split("/").pop()}-1200.webp`,
      `${r.data.imagePath!.split("/").pop()}-480.webp`,
    ]);
    // Un fichier qui n'est pas une image est refusé.
    const bad = new FormData();
    bad.set("listId", listId);
    bad.set("file", new File([new Uint8Array([1, 2, 3])], "x.png", { type: "image/png" }));
    expect(await items.addItemWithPhoto(bad)).toMatchObject({ ok: false, error: { code: "VALIDATION" } });
    await db.storage
      .from("item-images")
      .remove([`${r.data.imagePath}-1200.webp`, `${r.data.imagePath}-480.webp`]);
  });
});
