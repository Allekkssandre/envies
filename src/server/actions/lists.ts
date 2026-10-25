"use server";

import { revalidatePath } from "next/cache";
import { createListSchema, fieldErrors, type CreateListInput } from "@/lib/schemas/list";
import { slugify } from "@/lib/text";
import { generateEditKey } from "@/server/auth/editKey";
import { hashPassword } from "@/server/auth/password";
import { hitRateLimit, ipHash } from "@/server/auth/rateLimit";
import { setEditCookie } from "@/server/auth/session";
import { getServiceDb, type Db } from "@/server/db/client";
import { fail, GENERIC_ERROR, ok, type Result } from "./result";

export type CreatedList = { slug: string; title: string; editKey: string };

const SLUG_MAX = 80;
const UNIQUE_VIOLATION = "23505";

/** Premier slug libre : `noel-2026`, puis `noel-2026-2`, `-3`… (listes et anciens slugs). */
async function freeSlug(db: Db, base: string): Promise<string> {
  const stem = base.slice(0, SLUG_MAX - 4).replace(/-+$/, "") || "liste";
  const pattern = `${stem}%`;
  const [lists, redirects] = await Promise.all([
    db.from("lists").select("slug").like("slug", pattern),
    db.from("list_redirects").select("old_slug").like("old_slug", pattern),
  ]);
  const taken = new Set([
    ...(lists.data ?? []).map((r) => r.slug),
    ...(redirects.data ?? []).map((r) => r.old_slug),
  ]);
  if (!taken.has(stem)) return stem;
  for (let n = 2; ; n++) {
    const candidate = `${stem}-${n}`;
    if (!taken.has(candidate)) return candidate;
  }
}

/**
 * Crée une liste et son secret, pose le cookie d'édition (30 jours) et renvoie de quoi
 * afficher « C'est prêt. ». Limite : 10 créations par heure et par adresse.
 */
export async function createList(input: CreateListInput): Promise<Result<CreatedList>> {
  const parsed = createListSchema.safeParse(input);
  if (!parsed.success) {
    const errors = fieldErrors(parsed.error);
    const [field, message] = Object.entries(errors)[0] ?? ["title", GENERIC_ERROR];
    return fail("VALIDATION", message, field);
  }
  const { title, ownerName, password, description, ambiance, website } = parsed.data;

  // Champ piège rempli : faire comme si tout allait bien, sans rien créer.
  if (website && website.trim() !== "") {
    return ok({ slug: slugify(title) || "liste", title, editKey: generateEditKey() });
  }

  try {
    const limit = await hitRateLimit(`create:${await ipHash()}`, 10, 60 * 60);
    if (!limit.allowed) {
      return fail("RATE_LIMITED", "Trop de listes créées d'un coup. Réessayez dans une heure.");
    }

    const db = getServiceDb();
    const passwordHash = await hashPassword(password);

    // Course possible sur le slug : on réessaie quelques fois si l'index unique refuse.
    let created: { id: string; slug: string } | null = null;
    for (let attempt = 0; attempt < 5 && !created; attempt++) {
      const slug = await freeSlug(db, slugify(title));
      const { data, error } = await db
        .from("lists")
        .insert({ slug, title, owner_name: ownerName, description: description || null, ambiance })
        .select("id, slug")
        .single();
      if (data) created = data;
      else if (error?.code !== UNIQUE_VIOLATION) throw new Error(error?.message ?? "insertion impossible");
    }
    if (!created) throw new Error("aucun slug libre");

    let editKey = "";
    for (let attempt = 0; attempt < 5 && !editKey; attempt++) {
      const key = generateEditKey();
      const { error } = await db
        .from("list_secrets")
        .insert({ list_id: created.id, password_hash: passwordHash, edit_key: key });
      if (!error) editKey = key;
      else if (error.code !== UNIQUE_VIOLATION) break;
    }
    if (!editKey) {
      // Pas de transaction côté client : on retire la liste orpheline.
      await db.from("lists").delete().eq("id", created.id);
      throw new Error("secret non enregistré");
    }

    await setEditCookie(created.id, 1, true);
    revalidatePath("/");
    return ok({ slug: created.slug, title, editKey });
  } catch (error) {
    console.error("createList", error instanceof Error ? error.message : error);
    return fail("INTERNAL", GENERIC_ERROR);
  }
}
