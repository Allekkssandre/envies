import "server-only";
import type { Db } from "@/server/db/client";
import { MAX_ATTEMPTS, runEnrichment } from "@/server/enrich/run";

// Tâche quotidienne (docs/05-donnees.md § Suppression et purge, docs/10 § Sauvegardes).

const DAY_MS = 24 * 60 * 60 * 1000;
export const PURGE_AFTER_DAYS = 30;
const STALE_PENDING_MS = 10 * 60 * 1000;
/** Relances par passage : la tâche a 60 s en tout. */
const RETRY_PER_RUN = 12;
const BACKUP_BUCKET = "backups";
export const BACKUPS_KEPT = 8;
const PAGE = 1000;

const iso = (ms: number) => new Date(ms).toISOString();

/** Tous les fichiers d'un article (`items/<liste>/<article>/…`), y compris d'anciennes photos. */
async function removeItemFolder(db: Db, listId: string, itemId: string): Promise<number> {
  const folder = `items/${listId}/${itemId}`;
  const storage = db.storage.from("item-images");
  const { data, error } = await storage.list(folder, { limit: 100 });
  if (error) throw new Error(`Lecture du stockage impossible : ${error.message}`);
  const paths = (data ?? []).filter((f) => f.id !== null).map((f) => `${folder}/${f.name}`);
  if (!paths.length) return 0;
  const { error: removeError } = await storage.remove(paths);
  if (removeError) throw new Error(`Suppression des fichiers impossible : ${removeError.message}`);
  return paths.length;
}

/** 1. Articles supprimés depuis plus de 30 jours : fichiers, puis lignes. */
export async function purgeDeletedItems(db: Db, now = Date.now()) {
  const { data, error } = await db
    .from("items")
    .select("id, list_id")
    .lt("deleted_at", iso(now - PURGE_AFTER_DAYS * DAY_MS))
    .limit(500);
  if (error) throw new Error(error.message);
  let files = 0;
  const purged: string[] = [];
  for (const item of data ?? []) {
    try {
      files += await removeItemFolder(db, item.list_id, item.id);
      purged.push(item.id);
    } catch {
      // Fichiers non supprimés : la ligne reste, on réessaiera demain.
    }
  }
  if (purged.length) {
    const { error: deleteError } = await db.from("items").delete().in("id", purged);
    if (deleteError) throw new Error(deleteError.message);
  }
  return { items: purged.length, files };
}

/** 2. Listes supprimées depuis plus de 30 jours : fichiers de tous leurs articles, puis la liste. */
export async function purgeDeletedLists(db: Db, now = Date.now()) {
  const { data, error } = await db
    .from("lists")
    .select("id")
    .lt("deleted_at", iso(now - PURGE_AFTER_DAYS * DAY_MS))
    .limit(20);
  if (error) throw new Error(error.message);
  let lists = 0;
  let files = 0;
  for (const list of data ?? []) {
    try {
      const { data: items, error: itemsError } = await db.from("items").select("id").eq("list_id", list.id);
      if (itemsError) throw new Error(itemsError.message);
      for (const item of items ?? []) files += await removeItemFolder(db, list.id, item.id);
      // Catégories, tags, articles, secrets et redirections suivent en cascade.
      const { error: deleteError } = await db.from("lists").delete().eq("id", list.id);
      if (deleteError) throw new Error(deleteError.message);
      lists++;
    } catch {
      // Liste laissée telle quelle : nouvel essai demain.
    }
  }
  return { lists, files };
}

/**
 * 3. Extractions en attente depuis plus de 10 minutes : relancées s'il reste des essais,
 * sinon `failed` avec `fetch_error = 'stale'`.
 */
export async function settleStalePending(db: Db, now = Date.now(), retry = true) {
  const before = iso(now - STALE_PENDING_MS);
  const { data, error } = await db
    .from("items")
    .select("id, fetch_attempts")
    .eq("fetch_status", "pending")
    .is("deleted_at", null)
    .or(`fetch_started_at.lt.${before},and(fetch_started_at.is.null,created_at.lt.${before})`)
    .order("created_at")
    .limit(500);
  if (error) throw new Error(error.message);
  const rows = data ?? [];
  // Sans relance (ou essais épuisés) : `failed`. Au-delà des relances de ce passage : demain.
  const exhausted = rows.filter((r) => !retry || r.fetch_attempts >= MAX_ATTEMPTS).map((r) => r.id);
  const toRetry = retry
    ? rows
        .filter((r) => r.fetch_attempts < MAX_ATTEMPTS)
        .slice(0, RETRY_PER_RUN)
        .map((r) => r.id)
    : [];
  if (exhausted.length) {
    const { error: updateError } = await db
      .from("items")
      .update({ fetch_status: "failed", fetch_error: "stale", fetched_at: iso(now) })
      .in("id", exhausted)
      .eq("fetch_status", "pending");
    if (updateError) throw new Error(updateError.message);
  }
  const retried = toRetry.length ? await runEnrichment(toRetry, { db }) : [];
  return { failed: exhausted.length, retried: retried.length };
}

/** 4. Compteurs de limites expirés. */
export async function purgeRateLimits(db: Db, now = Date.now()) {
  const { data, error } = await db.from("rate_limits").delete().lt("reset_at", iso(now)).select("bucket");
  if (error) throw new Error(error.message);
  return { rateLimits: data?.length ?? 0 };
}

async function readAll<T>(
  fetchPage: (
    from: number,
    to: number,
  ) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
) {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await fetchPage(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE) return rows;
  }
}

/** Contenu de la sauvegarde : toutes les listes non supprimées, sans secrets. */
export async function buildBackup(db: Db, now = Date.now()) {
  const lists = await readAll((a, b) =>
    db.from("lists").select("*").is("deleted_at", null).order("created_at").range(a, b),
  );
  const ids = new Set(lists.map((l) => l.id));
  const ofLiveList = <T extends { list_id: string }>(rows: T[]) => rows.filter((r) => ids.has(r.list_id));
  const categories = ofLiveList(
    await readAll((a, b) => db.from("categories").select("*").order("id").range(a, b)),
  );
  const tags = ofLiveList(await readAll((a, b) => db.from("tags").select("*").order("id").range(a, b)));
  const items = ofLiveList(
    await readAll((a, b) => db.from("items").select("*").is("deleted_at", null).order("id").range(a, b)),
  );
  const itemIds = new Set(items.map((i) => i.id));
  const itemTags = (
    await readAll((a, b) => db.from("item_tags").select("*").order("item_id").order("tag_id").range(a, b))
  ).filter((r) => itemIds.has(r.item_id));
  const redirects = ofLiveList(
    await readAll((a, b) => db.from("list_redirects").select("*").order("old_slug").range(a, b)),
  );
  return {
    version: 1,
    createdAt: iso(now),
    lists,
    categories,
    tags,
    items,
    itemTags,
    redirects,
  };
}

/** 5. Le dimanche : sauvegarde JSON dans le bucket privé `backups`, en gardant les 8 dernières. */
export async function writeBackup(db: Db, now = Date.now()) {
  const backup = await buildBackup(db, now);
  const name = `envies-${iso(now).slice(0, 10)}.json`;
  const storage = db.storage.from(BACKUP_BUCKET);
  const { error } = await storage.upload(name, JSON.stringify(backup), {
    contentType: "application/json",
    upsert: true,
  });
  if (error) throw new Error(`Sauvegarde impossible : ${error.message}`);
  const { data: files, error: listError } = await storage.list("", {
    limit: 1000,
    sortBy: { column: "name", order: "desc" },
  });
  if (listError) throw new Error(listError.message);
  const old = (files ?? [])
    .filter((f) => /^envies-\d{4}-\d{2}-\d{2}\.json$/.test(f.name))
    .map((f) => f.name)
    .sort()
    .reverse()
    .slice(BACKUPS_KEPT);
  if (old.length) await storage.remove(old);
  return { backup: name, lists: backup.lists.length, items: backup.items.length, removedBackups: old.length };
}

export type DailyReport = Record<string, unknown>;

/**
 * Chaque étape est indépendante : une erreur est notée dans le rapport sans arrêter les autres.
 */
export async function runDaily(db: Db, { now = Date.now(), backup = false } = {}): Promise<DailyReport> {
  const report: DailyReport = {};
  const steps: [string, () => Promise<unknown>][] = [
    ["items", () => purgeDeletedItems(db, now)],
    ["lists", () => purgeDeletedLists(db, now)],
    ["pending", () => settleStalePending(db, now)],
    ["rateLimits", () => purgeRateLimits(db, now)],
  ];
  if (backup) steps.push(["backup", () => writeBackup(db, now)]);
  for (const [name, step] of steps) {
    try {
      report[name] = await step();
    } catch (error) {
      report[name] = { error: error instanceof Error ? error.message : "erreur" };
    }
  }
  return report;
}
