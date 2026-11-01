import { existsSync } from "node:fs";
import { afterAll, describe, expect, it } from "vitest";

// Tâche quotidienne contre la base locale : purge, extractions bloquées, limites, sauvegarde.

if (existsSync(".env.local")) process.loadEnvFile(".env.local");
const hasDb = Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);

const DAY = 24 * 60 * 60 * 1000;
const ago = (ms: number) => new Date(Date.now() - ms).toISOString();

describe.skipIf(!hasDb)("tâche quotidienne", async () => {
  if (!hasDb) return;
  const { getServiceDb } = await import("@/server/db/client");
  const m = await import("@/server/maintenance");
  const { GET } = await import("@/app/api/cron/daily/route");
  const db = getServiceDb();
  const listIds: string[] = [];
  const storage = db.storage.from("item-images");

  async function createList(name: string) {
    const { data } = await db
      .from("lists")
      .insert({ slug: `test-cron-${name}-${Date.now()}`, title: `Test cron ${name}`, owner_name: "Test" })
      .select("id")
      .single();
    listIds.push(data!.id);
    return data!.id;
  }

  async function createItem(listId: string, title: string, extra: Record<string, unknown> = {}) {
    const { data } = await db
      .from("items")
      .insert({ list_id: listId, title, position: `a${Math.random().toString(36).slice(2, 8)}`, ...extra })
      .select("id")
      .single();
    return data!.id;
  }

  async function putFile(listId: string, itemId: string, name: string) {
    const { error } = await storage.upload(`items/${listId}/${itemId}/${name}`, Buffer.from("x"), {
      contentType: "image/webp",
      upsert: true,
    });
    expect(error).toBeNull();
  }

  const filesOf = async (listId: string, itemId: string) =>
    ((await storage.list(`items/${listId}/${itemId}`)).data ?? []).map((f) => f.name);

  afterAll(async () => {
    if (listIds.length) await db.from("lists").delete().in("id", listIds);
  });

  it("articles supprimés depuis plus de 30 jours : fichiers et lignes effacés, les récents restent", async () => {
    const listId = await createList("articles");
    const old = await createItem(listId, "Ancien", { deleted_at: ago(31 * DAY), image_path: "x" });
    const recent = await createItem(listId, "Récent", { deleted_at: ago(5 * DAY) });
    const alive = await createItem(listId, "Vivant");
    await putFile(listId, old, "aaaa-1200.webp");
    await putFile(listId, old, "aaaa-480.webp");
    await putFile(listId, old, "bbbb-480.webp"); // ancienne photo restée
    await putFile(listId, recent, "cccc-480.webp");

    const result = await m.purgeDeletedItems(db);
    expect(result.items).toBeGreaterThanOrEqual(1);
    expect(await filesOf(listId, old)).toEqual([]);
    expect(await filesOf(listId, recent)).toEqual(["cccc-480.webp"]);
    const { data: rows } = await db.from("items").select("id").eq("list_id", listId);
    expect(rows!.map((r) => r.id).sort()).toEqual([recent, alive].sort());
  });

  it("listes supprimées depuis plus de 30 jours : tout part, en cascade", async () => {
    const listId = await createList("liste");
    const item = await createItem(listId, "Lampe");
    await putFile(listId, item, "dddd-1200.webp");
    await db.from("categories").insert({ list_id: listId, name: "Maison", position: "a0" });
    await db
      .from("list_secrets")
      .insert({ list_id: listId, password_hash: "scrypt$x", edit_key: `C${Date.now()}` });
    const keep = await createList("recente");
    await db
      .from("lists")
      .update({ deleted_at: ago(31 * DAY) })
      .eq("id", listId);
    await db
      .from("lists")
      .update({ deleted_at: ago(2 * DAY) })
      .eq("id", keep);

    await m.purgeDeletedLists(db);
    expect(await filesOf(listId, item)).toEqual([]);
    expect((await db.from("lists").select("id").eq("id", listId)).data).toEqual([]);
    expect((await db.from("items").select("id").eq("list_id", listId)).data).toEqual([]);
    expect((await db.from("categories").select("id").eq("list_id", listId)).data).toEqual([]);
    expect((await db.from("list_secrets").select("list_id").eq("list_id", listId)).data).toEqual([]);
    expect((await db.from("lists").select("id").eq("id", keep)).data).toHaveLength(1);
  });

  it("extractions en attente depuis plus de 10 minutes : `failed` / `stale`", async () => {
    const listId = await createList("attente");
    const stale = await createItem(listId, "Bloqué", {
      url: "https://example.com/a",
      fetch_status: "pending",
      fetch_attempts: 3,
      fetch_started_at: ago(20 * 60 * 1000),
    });
    const neverStarted = await createItem(listId, "Jamais lancé", {
      url: "https://example.com/b",
      fetch_status: "pending",
      created_at: ago(30 * 60 * 1000),
    });
    const fresh = await createItem(listId, "Récent", {
      url: "https://example.com/c",
      fetch_status: "pending",
      fetch_started_at: ago(60 * 1000),
    });

    await m.settleStalePending(db, Date.now(), false);
    const { data } = await db.from("items").select("id, fetch_status, fetch_error").eq("list_id", listId);
    const byId = new Map(data!.map((r) => [r.id, r]));
    expect(byId.get(stale)).toMatchObject({ fetch_status: "failed", fetch_error: "stale" });
    expect(byId.get(neverStarted)).toMatchObject({ fetch_status: "failed", fetch_error: "stale" });
    expect(byId.get(fresh)).toMatchObject({ fetch_status: "pending" });
  });

  it("limites de fréquence expirées supprimées", async () => {
    const expired = `test-cron-expired-${Date.now()}`;
    const live = `test-cron-live-${Date.now()}`;
    await db.from("rate_limits").insert([
      { bucket: expired, count: 3, reset_at: ago(60 * 1000) },
      { bucket: live, count: 3, reset_at: ago(-60 * 60 * 1000) },
    ]);
    await m.purgeRateLimits(db);
    const { data } = await db.from("rate_limits").select("bucket").in("bucket", [expired, live]);
    expect(data!.map((r) => r.bucket)).toEqual([live]);
    await db.from("rate_limits").delete().eq("bucket", live);
  });

  it("sauvegarde : JSON sans secrets dans `backups`, 8 gardées", async () => {
    const listId = await createList("sauvegarde");
    await createItem(listId, "Carnet");
    await db
      .from("list_secrets")
      .insert({ list_id: listId, password_hash: "scrypt$secret", edit_key: `S${Date.now()}` });
    const backups = db.storage.from("backups");
    // Dix anciennes sauvegardes factices (années passées) : seules les 8 plus récentes restent.
    const fakes = Array.from({ length: 10 }, (_, i) => `envies-19${String(i).padStart(2, "0")}-01-01.json`);
    for (const name of fakes)
      await backups.upload(name, "{}", { contentType: "application/json", upsert: true });

    const now = Date.UTC(2099, 0, 4); // un dimanche lointain : ne gêne pas les vraies sauvegardes
    const result = await m.writeBackup(db, now);
    expect(result.backup).toBe("envies-2099-01-04.json");

    const { data: file } = await backups.download("envies-2099-01-04.json");
    const text = await file!.text();
    const json = JSON.parse(text);
    expect(json.lists.some((l: { id: string }) => l.id === listId)).toBe(true);
    expect(json.items.some((i: { title: string }) => i.title === "Carnet")).toBe(true);
    expect(text).not.toContain("scrypt$secret");
    expect(text).not.toContain("edit_key");
    expect(text).not.toContain("password_hash");

    const names = ((await backups.list("", { limit: 100 })).data ?? []).map((f) => f.name);
    const kept = names.filter((n) => /^envies-\d{4}-\d{2}-\d{2}\.json$/.test(n));
    expect(kept.length).toBeLessThanOrEqual(m.BACKUPS_KEPT);
    expect(kept).toContain("envies-2099-01-04.json");
    expect(kept).not.toContain("envies-1900-01-01.json");
    await backups.remove(names.filter((n) => n.startsWith("envies-19") || n.startsWith("envies-2099")));
  });

  it("la route exige le secret", async () => {
    const previous = process.env.CRON_SECRET;
    process.env.CRON_SECRET = "s".repeat(40);
    try {
      const call = (auth?: string) =>
        GET(new Request("http://localhost/api/cron/daily", auth ? { headers: { authorization: auth } } : {}));
      expect((await call()).status).toBe(401);
      expect((await call("Bearer faux")).status).toBe(401);
      expect((await call(`Bearer ${"s".repeat(39)}x`)).status).toBe(401);
      delete process.env.CRON_SECRET;
      expect((await call("Bearer ")).status).toBe(401);
    } finally {
      if (previous === undefined) delete process.env.CRON_SECRET;
      else process.env.CRON_SECRET = previous;
    }
  });
});
