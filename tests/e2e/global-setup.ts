import { createClient } from "@supabase/supabase-js";
import { existsSync } from "node:fs";
import { cleanupTestLists } from "./cleanup";

/** Avant toute la série : compteurs de fréquence à zéro (sinon les exécutions précédentes bloquent). */
export default async function globalSetup() {
  if (existsSync(".env.local")) process.loadEnvFile(".env.local");
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key || process.env.PLAYWRIGHT_BASE_URL) return; // pas sur une base distante
  const db = createClient(url, key, { auth: { persistSession: false } });
  await db.from("rate_limits").delete().neq("bucket", "");
  await cleanupTestLists();
}
