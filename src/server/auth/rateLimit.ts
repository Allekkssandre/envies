import "server-only";
import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { getServiceDb } from "@/server/db/client";

/** SHA-256(première IP de `x-forwarded-for` + sel), 16 caractères. L'IP n'est jamais stockée. */
export async function ipHash(): Promise<string> {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "local";
  return createHash("sha256")
    .update(ip + (process.env.RATE_LIMIT_SALT ?? ""))
    .digest("hex")
    .slice(0, 16);
}

export type RateLimitResult = { allowed: true } | { allowed: false; retryInMinutes: number };

/** Compte un essai dans `bucket` ; refusé au-delà de `max` dans la fenêtre. */
export async function hitRateLimit(
  bucket: string,
  max: number,
  windowSeconds: number,
): Promise<RateLimitResult> {
  const db = getServiceDb();
  const { data, error } = await db.rpc("hit_rate_limit", {
    p_bucket: bucket,
    p_max: max,
    p_window_seconds: windowSeconds,
  });
  if (error) throw new Error(`Limite de fréquence indisponible : ${error.message}`);
  if (data) return { allowed: true };
  const { data: row } = await db.from("rate_limits").select("reset_at").eq("bucket", bucket).maybeSingle();
  const ms = row ? new Date(row.reset_at).getTime() - Date.now() : windowSeconds * 1000;
  return { allowed: false, retryInMinutes: Math.max(1, Math.ceil(ms / 60_000)) };
}

/** Fenêtre de la limite de déverrouillage, raccourcissable en test (`UNLOCK_WINDOW_SECONDS`). */
export function unlockWindowSeconds(): number {
  const value = Number(process.env.UNLOCK_WINDOW_SECONDS);
  return Number.isFinite(value) && value > 0 ? value : 15 * 60;
}
