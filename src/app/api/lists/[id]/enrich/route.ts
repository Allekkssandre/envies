import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { hitRateLimit } from "@/server/auth/rateLimit";
import { requireEdit } from "@/server/auth/session";
import { getServiceDb } from "@/server/db/client";
import { enrichPending } from "@/server/enrich/run";

export const maxDuration = 60;

/**
 * Filet de sécurité appelé par la page d'édition toutes les 30 s tant qu'un article est en
 * « Récupération… » : relance au plus 5 articles `pending` depuis plus de 30 s.
 * Jeton d'édition requis, 30 appels par minute et par liste.
 */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return NextResponse.json({ ok: false }, { status: 404 });
  const { data: list } = await getServiceDb()
    .from("lists")
    .select("id")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (!list) return NextResponse.json({ ok: false }, { status: 404 });
  if (!(await requireEdit(list.id))) return NextResponse.json({ ok: false }, { status: 401 });
  const limit = await hitRateLimit(`enrich:${list.id}`, 30, 60);
  if (!limit.allowed) return NextResponse.json({ ok: false }, { status: 429 });

  const results = await enrichPending(list.id);
  return NextResponse.json(
    { ok: true, processed: results.length },
    { headers: { "Cache-Control": "no-store" } },
  );
}
