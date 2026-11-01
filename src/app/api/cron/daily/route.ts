import { timingSafeEqual } from "node:crypto";
import { getServiceDb } from "@/server/db/client";
import { runDaily } from "@/server/maintenance";

// Tâche quotidienne (Vercel Cron, 04:17 UTC) : purge, nettoyage, sauvegarde le dimanche.
// Vercel envoie `Authorization: Bearer ${CRON_SECRET}`.

export const maxDuration = 60;

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export async function GET(request: Request) {
  if (!authorized(request)) return Response.json({ error: "unauthorized" }, { status: 401 });
  const now = Date.now();
  // `?sauvegarde=1` force la sauvegarde (vérification à la main, tests).
  const force = new URL(request.url).searchParams.get("sauvegarde") === "1";
  const backup = force || new Date(now).getUTCDay() === 0;
  const report = await runDaily(getServiceDb(), { now, backup });
  return Response.json(report, { headers: { "Cache-Control": "no-store" } });
}
