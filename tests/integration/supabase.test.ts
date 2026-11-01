import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Variables de la base locale (`supabase start`), si présentes.
if (existsSync(".env.local")) process.loadEnvFile(".env.local");
const hasDb = Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);

describe.skipIf(!hasDb)("Supabase local (migrations + seed)", async () => {
  const { getAnonDb, getServiceDb } = await import("@/server/db/client");

  it("le client anon lit la liste de démo", async () => {
    const { data, error } = await getAnonDb()
      .from("lists")
      .select("slug, title, ambiance")
      .eq("slug", "mes-30-ans")
      .single();
    expect(error).toBeNull();
    expect(data?.title).toBe("Mes 30 ans");
  });

  it("le client anon ne lit pas les secrets", async () => {
    const { data } = await getAnonDb().from("list_secrets").select("list_id");
    expect(data ?? []).toHaveLength(0);
  });

  it("le client anon ne peut pas écrire", async () => {
    const { error } = await getAnonDb()
      .from("lists")
      .insert({ slug: "test-anon", title: "Test anon", owner_name: "Test" });
    expect(error).not.toBeNull();
  });

  it("le client anon ne lit ni le contenu ni le petit mot d'une liste privée", async () => {
    const db = getServiceDb();
    const anon = getAnonDb();
    const slug = `test-prive-${Date.now()}`;
    const { data: list } = await db
      .from("lists")
      .insert({ slug, title: "Test privé", owner_name: "Test", description: "secret", is_private: true })
      .select("id")
      .single();
    try {
      const { data: cat } = await db
        .from("categories")
        .insert({ list_id: list!.id, name: "Cadeaux", position: "a0" })
        .select("id")
        .single();
      const { data: tag } = await db
        .from("tags")
        .insert({ list_id: list!.id, name: "Idée", position: "a0" })
        .select("id")
        .single();
      const { data: item } = await db
        .from("items")
        .insert({ list_id: list!.id, title: "Vélo", category_id: cat!.id, position: "a0" })
        .select("id")
        .single();
      await db.from("item_tags").insert({ item_id: item!.id, tag_id: tag!.id });

      // La liste elle-même reste visible (accueil), sans son petit mot.
      const visible = await anon.from("lists").select("id, title, is_private").eq("slug", slug).single();
      expect(visible.data).toMatchObject({ title: "Test privé", is_private: true });
      expect((await anon.from("lists").select("description").eq("slug", slug)).error).not.toBeNull();
      expect((await anon.from("list_summaries").select("id")).error).not.toBeNull();

      expect((await anon.from("items").select("id").eq("list_id", list!.id)).data).toEqual([]);
      expect((await anon.from("categories").select("id").eq("list_id", list!.id)).data).toEqual([]);
      expect((await anon.from("tags").select("id").eq("list_id", list!.id)).data).toEqual([]);
      expect((await anon.from("item_tags").select("item_id").eq("item_id", item!.id)).data).toEqual([]);

      // Redevenue publique : tout se lit de nouveau.
      await db.from("lists").update({ is_private: false }).eq("id", list!.id);
      expect((await anon.from("items").select("id").eq("list_id", list!.id)).data).toHaveLength(1);
      expect((await anon.from("item_tags").select("item_id").eq("item_id", item!.id)).data).toHaveLength(1);
    } finally {
      await db.from("lists").delete().eq("id", list!.id);
    }
  });

  it("le client service role lit les secrets", async () => {
    const { data, error } = await getServiceDb().from("list_secrets").select("list_id");
    expect(error).toBeNull();
    expect((data ?? []).length).toBeGreaterThan(0);
  });
});
