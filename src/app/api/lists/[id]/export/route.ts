import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getServiceDb } from "@/server/db/client";
import { canReadList } from "@/server/db/listPage";
import { getListContent, toListInfo } from "@/server/db/lists";
import { buildWorkbook, exportFileName } from "@/server/export";

/** Export .xlsx d'une liste. Public pour une liste publique ; liste privée : accès requis. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return new NextResponse(null, { status: 404 });
  const { data: row } = await getServiceDb()
    .from("lists")
    .select("*")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (!row) return new NextResponse(null, { status: 404 });
  const list = toListInfo(row);
  // Même réponse qu'une liste absente : rien n'indique ce qu'elle contient.
  if (!(await canReadList(list))) return new NextResponse(null, { status: 404 });
  const content = await getListContent(list.id, list.isPrivate);
  const body = buildWorkbook(list, content);
  return new NextResponse(new Uint8Array(body), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${exportFileName(row.slug)}"`,
      "Cache-Control": "no-store",
    },
  });
}
