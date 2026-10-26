import { createClient } from "@supabase/supabase-js";
import { existsSync } from "node:fs";

/** Supprime les listes « Test e2e » laissées par les tests (et leurs images). Base locale seulement. */
export async function cleanupTestLists() {
  if (existsSync(".env.local")) process.loadEnvFile(".env.local");
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key || process.env.PLAYWRIGHT_BASE_URL) return;
  const db = createClient(url, key, { auth: { persistSession: false } });
  const { data } = await db.from("lists").select("id").or("slug.like.test-e2e-%,title.like.Test e2e%");
  for (const { id } of data ?? []) {
    const storage = db.storage.from("item-images");
    const { data: folders } = await storage.list(`items/${id}`);
    for (const folder of folders ?? []) {
      const { data: files } = await storage.list(`items/${id}/${folder.name}`);
      if (files?.length) await storage.remove(files.map((f) => `items/${id}/${folder.name}/${f.name}`));
    }
  }
  if (data?.length)
    await db
      .from("lists")
      .delete()
      .in(
        "id",
        data.map((l) => l.id),
      );
}
