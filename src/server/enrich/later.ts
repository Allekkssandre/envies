import "server-only";
import { after } from "next/server";
import { revalidateList } from "@/server/actions/guard";
import { runEnrichment } from "./run";

/**
 * Lecture des liens après la réponse (`after()`), 4 à la fois, 40 au plus (le reste est relancé
 * par la page d'édition). Le navigateur reçoit le résultat par le temps réel ; les pages
 * visiteur sont invalidées à la fin.
 */
export function enrichLater(itemIds: string[], slug: string): void {
  if (!itemIds.length) return;
  after(async () => {
    await runEnrichment(itemIds);
    try {
      revalidateList(slug);
    } catch (error) {
      console.error("enrichLater", error instanceof Error ? error.message : error);
    }
  });
}
