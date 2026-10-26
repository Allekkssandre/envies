import "server-only";
import { normalizeUrl } from "@/lib/normalizeUrl";
import { getServiceDb, type Db } from "@/server/db/client";
import { removeItemImage } from "@/server/images";
import type { Json, TablesUpdate } from "@/types/database";
import { applyAdapters } from "./adapters";
import { extractFrom, loadHtml } from "./extract";
import { storeFirstImage } from "./image";
import { safeFetch, safeFetchJson, type FetchError, type SafeFetchOptions } from "./safeFetch";
import { suggestCategory } from "./suggestCategory";
import type { Extracted } from "./types";

// Déroulé d'une extraction (docs/07-extraction-liens.md § 1, 9 et 10).

export type EnrichMode = "initial" | "refetch";

export type EnrichOutcome = {
  itemId: string;
  status: "ok" | "partial" | "failed" | "skipped";
  error?: FetchError | "empty" | "internal" | "stale";
  /** Relecture : prix avant / après (centimes), si un prix a été trouvé. */
  priceBefore?: number | null;
  priceAfter?: number | null;
  currency?: string | null;
};

/** Au plus 40 articles par lancement ; les autres restent `pending` et seront relancés. */
export const MAX_PER_RUN = 40;
/** Un article `pending` depuis plus de 30 s est considéré comme bloqué et relancé. */
export const STALE_AFTER_MS = 30_000;
export const MAX_ATTEMPTS = 3;

const ITEM_FIELDS =
  "id, list_id, url, url_key, domain, title, description, price_cents, currency, image_path, sorted_at, meta, fetch_attempts, fetch_status, deleted_at, lists(currency)";

type Deps = { db?: Db; fetchOptions?: SafeFetchOptions };

const asObject = (v: Json | null | undefined): Record<string, Json | undefined> =>
  typeof v === "object" && v !== null && !Array.isArray(v) ? v : {};

async function readItem(db: Db, itemId: string) {
  const { data } = await db.from("items").select(ITEM_FIELDS).eq("id", itemId).maybeSingle();
  return data;
}

function logError(where: string, error: unknown) {
  console.error(where, error instanceof Error ? error.message : error);
}

/** Lit la page d'un article et enregistre ce qui manque. Ne lève jamais. */
export async function enrichItem(itemId: string, mode: EnrichMode, deps: Deps = {}): Promise<EnrichOutcome> {
  const db = deps.db ?? getServiceDb();
  try {
    const item = await readItem(db, itemId);
    if (!item || !item.url || item.deleted_at) return { itemId, status: "skipped" };
    const url = item.url;

    await db
      .from("items")
      .update({ fetch_started_at: new Date().toISOString(), fetch_attempts: item.fetch_attempts + 1 })
      .eq("id", itemId);

    const page = await safeFetch(url, deps.fetchOptions);
    if (!page.ok) {
      const update: TablesUpdate<"items"> = { fetched_at: new Date().toISOString(), fetch_error: page.error };
      // Une relecture qui échoue ne fait pas perdre ce qui avait été trouvé.
      if (mode === "initial" || item.fetch_status === "pending") update.fetch_status = "failed";
      await db.from("items").update(update).eq("id", itemId).eq("url", url);
      return { itemId, status: "failed", error: page.error };
    }

    const $ = loadHtml(page.html);
    const finalUrl = new URL(page.finalUrl);
    const extracted: Extracted = await applyAdapters($, finalUrl, extractFrom($, page.finalUrl), (u) =>
      safeFetchJson(u, deps.fetchOptions),
    );

    const { data: categories } = await db.from("categories").select("id, name").eq("list_id", item.list_id);

    // Relu juste avant d'écrire : une saisie faite pendant la lecture de la page reste prioritaire.
    const fresh = await readItem(db, itemId);
    if (!fresh || fresh.deleted_at || fresh.url !== url) return { itemId, status: "skipped" };

    const now = new Date().toISOString();
    const listCurrency = (fresh.lists as { currency: string } | null)?.currency ?? "EUR";
    const update: TablesUpdate<"items"> = {
      fetched_at: now,
      fetch_error: null,
      image_candidates: extracted.images,
      domain: normalizeUrl(page.finalUrl)?.domain ?? fresh.domain,
    };
    const title = fresh.title?.trim() ? fresh.title : extracted.title;
    if (!fresh.title?.trim() && extracted.title) update.title = extracted.title;
    if (!fresh.description?.trim() && extracted.description) update.description = extracted.description;

    const outcome: EnrichOutcome = { itemId, status: "ok" };
    if (extracted.price && (fresh.price_cents === null || mode === "refetch")) {
      update.price_cents = extracted.price.cents;
      update.currency = extracted.price.currency ?? listCurrency;
      update.price_source = "page";
      update.price_checked_at = now;
    }
    if (mode === "refetch") {
      outcome.priceBefore = fresh.price_cents;
      outcome.priceAfter = extracted.price?.cents ?? null;
      outcome.currency = extracted.price ? (extracted.price.currency ?? listCurrency) : fresh.currency;
    }

    const meta: Record<string, Json | undefined> = {
      ...asObject(fresh.meta),
      siteName: extracted.siteName,
      brand: extracted.brand,
      availability: extracted.availability,
      breadcrumb: extracted.breadcrumb,
    };
    if (!fresh.sorted_at) {
      update.suggested_category_id = suggestCategory(extracted.breadcrumb, categories ?? [], extracted.brand);
    }

    // Photo : seulement s'il n'y en a pas (la photo choisie n'est jamais remplacée).
    let hasImage = Boolean(fresh.image_path);
    if (!hasImage && extracted.images.length) {
      // Une photo qui ne s'enregistre pas ne fait pas perdre le reste (statut « partial »).
      const stored = await storeFirstImage(
        db,
        fresh.list_id,
        itemId,
        extracted.images,
        deps.fetchOptions,
      ).catch((error: unknown) => {
        logError("enrichItem image", error);
        return null;
      });
      if (stored) {
        const { data: set } = await db
          .from("items")
          .update({
            image_path: stored.path,
            image_width: stored.width,
            image_height: stored.height,
            image_source_url: stored.sourceUrl,
          })
          .eq("id", itemId)
          .is("image_path", null)
          .select("id");
        if (set?.length) {
          hasImage = true;
          meta.lightBackground = stored.lightBackground;
        } else {
          // Une photo a été choisie entre-temps : la nôtre est inutile.
          await removeItemImage(db, stored.path);
          hasImage = true;
        }
      }
    }
    update.meta = meta as Json;

    const status = title && hasImage ? "ok" : title || hasImage ? "partial" : "failed";
    update.fetch_status = status;
    if (status === "failed") update.fetch_error = "empty";
    outcome.status = status;
    if (status === "failed") outcome.error = "empty";

    const { error } = await db.from("items").update(update).eq("id", itemId).eq("url", url);
    if (error) throw new Error(error.message);

    // Lien canonique différent sur le même domaine : il devient la clé de doublon, si elle est libre.
    const canonical = extracted.canonical ? normalizeUrl(extracted.canonical) : null;
    if (canonical && canonical.urlKey !== fresh.url_key && canonical.domain === normalizeUrl(url)?.domain) {
      const { data: taken } = await db
        .from("items")
        .select("id")
        .eq("list_id", fresh.list_id)
        .eq("url_key", canonical.urlKey)
        .is("deleted_at", null)
        .maybeSingle();
      if (!taken) await db.from("items").update({ url_key: canonical.urlKey }).eq("id", itemId);
    }
    return outcome;
  } catch (error) {
    logError("enrichItem", error);
    if (mode === "initial") {
      await db
        .from("items")
        .update({ fetch_status: "failed", fetch_error: "internal", fetched_at: new Date().toISOString() })
        .eq("id", itemId)
        .eq("fetch_status", "pending");
    }
    return { itemId, status: "failed", error: "internal" };
  }
}

/** Extraction de plusieurs articles, 4 à la fois. Une erreur sur l'un n'arrête pas les autres. */
export async function runEnrichment(
  itemIds: string[],
  { concurrency = 4, ...deps }: Deps & { concurrency?: number } = {},
): Promise<EnrichOutcome[]> {
  const queue = itemIds.slice(0, MAX_PER_RUN);
  const results: EnrichOutcome[] = [];
  const worker = async () => {
    for (let id = queue.shift(); id; id = queue.shift()) results.push(await enrichItem(id, "initial", deps));
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, queue.length) }, worker));
  return results;
}

/**
 * Filet de sécurité (`POST /api/lists/[id]/enrich`) : relance au plus 5 articles `pending`
 * jamais commencés ou commencés il y a plus de 30 s ; après 3 essais, l'article passe en `failed`.
 */
export async function enrichPending(listId: string, deps: Deps = {}): Promise<EnrichOutcome[]> {
  const db = deps.db ?? getServiceDb();
  const staleBefore = new Date(Date.now() - STALE_AFTER_MS).toISOString();
  const { data } = await db
    .from("items")
    .select("id, fetch_attempts")
    .eq("list_id", listId)
    .eq("fetch_status", "pending")
    .is("deleted_at", null)
    .or(`fetch_started_at.is.null,fetch_started_at.lt.${staleBefore}`)
    .order("created_at")
    .limit(5);
  const rows = data ?? [];
  const exhausted = rows.filter((r) => r.fetch_attempts >= MAX_ATTEMPTS).map((r) => r.id);
  if (exhausted.length) {
    await db
      .from("items")
      .update({ fetch_status: "failed", fetch_error: "stale", fetched_at: new Date().toISOString() })
      .in("id", exhausted);
  }
  const retry = rows.filter((r) => r.fetch_attempts < MAX_ATTEMPTS).map((r) => r.id);
  const results = retry.length ? await runEnrichment(retry, { ...deps, db }) : [];
  return [
    ...exhausted.map((itemId) => ({ itemId, status: "failed" as const, error: "stale" as const })),
    ...results,
  ];
}
