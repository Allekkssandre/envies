import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getAnonDb } from "@/server/db/client";
import { getListContent } from "@/server/db/lists";
import { buildWorkbook, exportFileName } from "@/server/export";

/** Export .xlsx d'une liste. Public : les données le sont aussi. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return new NextResponse(null, { status: 404 });
  const { data: row } = await getAnonDb()
    .from("lists")
    .select("id, slug, title, owner_name, description, ambiance, currency")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (!row) return new NextResponse(null, { status: 404 });
  const list = {
    id: row.id,
    slug: row.slug,
    title: row.title,
    ownerName: row.owner_name,
    description: row.description,
    ambiance: row.ambiance,
    currency: row.currency,
  };
  const content = await getListContent(row.id);
  const body = buildWorkbook(list, content);
  return new NextResponse(new Uint8Array(body), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${exportFileName(row.slug)}"`,
      "Cache-Control": "no-store",
    },
  });
}
