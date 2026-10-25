import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

let browserClient: SupabaseClient<Database> | undefined;

/**
 * Client navigateur, clé publique : temps réel et lecture uniquement.
 * Aucune écriture ne part du navigateur (la RLS les refuse de toute façon).
 */
export function getSupabaseBrowser(): SupabaseClient<Database> {
  browserClient ??= createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  return browserClient;
}
