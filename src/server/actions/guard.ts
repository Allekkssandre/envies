import "server-only";
import { revalidatePath } from "next/cache";
import { requireEdit } from "@/server/auth/session";
import { getServiceDb, type Db } from "@/server/db/client";
import { fail, LOCKED_ERROR, type Result } from "./result";

export type EditContext = { db: Db; list: { id: string; slug: string; currency: string } };

type Guarded = { ok: true; ctx: EditContext } | { ok: false; result: Result<never> };

/** Liste existante + jeton d'édition valide. Sinon `NOT_FOUND` ou `EDIT_LOCKED`. */
export async function guardList(listId: string): Promise<Guarded> {
  const db = getServiceDb();
  const { data: list } = await db
    .from("lists")
    .select("id, slug, currency")
    .eq("id", listId)
    .is("deleted_at", null)
    .maybeSingle();
  if (!list) return { ok: false, result: fail("NOT_FOUND", "Cette liste n'existe pas, ou plus.") };
  if (!(await requireEdit(list.id))) return { ok: false, result: fail("EDIT_LOCKED", LOCKED_ERROR) };
  return { ok: true, ctx: { db, list } };
}

/**
 * Articles d'une même liste + accès. `withDeleted` pour « Annuler » une suppression.
 * Des identifiants inconnus ou de plusieurs listes donnent `NOT_FOUND`.
 */
export async function guardItems(
  itemIds: string[],
  { withDeleted = false } = {},
): Promise<(Guarded & { ok: false }) | { ok: true; ctx: EditContext }> {
  const db = getServiceDb();
  let query = db.from("items").select("id, list_id").in("id", itemIds);
  if (!withDeleted) query = query.is("deleted_at", null);
  const { data } = await query;
  const listIds = new Set((data ?? []).map((r) => r.list_id));
  if (!data || data.length !== new Set(itemIds).size || listIds.size !== 1) {
    return { ok: false, result: fail("NOT_FOUND", "Cet article n'existe plus.") };
  }
  return guardList([...listIds][0]!);
}

/** Invalide la page visiteur, l'édition et l'accueil après une écriture. */
export function revalidateList(slug: string): void {
  revalidatePath(`/l/${slug}`, "layout");
  revalidatePath("/");
}
