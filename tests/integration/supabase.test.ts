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

  it("le client service role lit les secrets", async () => {
    const { data, error } = await getServiceDb().from("list_secrets").select("list_id");
    expect(error).toBeNull();
    expect((data ?? []).length).toBeGreaterThan(0);
  });
});
