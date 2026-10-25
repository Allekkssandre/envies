import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

export type Db = SupabaseClient<Database>;

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Variable d'environnement manquante : ${name}`);
  return value;
}

let serviceClient: Db | undefined;
let anonClient: Db | undefined;

const serverAuth = { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false };

/**
 * Client service role : contourne la RLS. Réservé aux actions serveur et à l'édition.
 * Toujours filtrer `deleted_at is null` à la main dans les lectures.
 */
export function getServiceDb(): Db {
  serviceClient ??= createClient<Database>(required("SUPABASE_URL"), required("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: serverAuth,
  });
  return serviceClient;
}

/** Client anon côté serveur : lectures des pages visiteur, la RLS s'applique. */
export function getAnonDb(): Db {
  anonClient ??= createClient<Database>(
    required("NEXT_PUBLIC_SUPABASE_URL"),
    required("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    { auth: serverAuth },
  );
  return anonClient;
}
