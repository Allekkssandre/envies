"use client";

import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { ChevronDown } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { InboxCard, type InboxState } from "@/components/ui/InboxCard";
import { SplitTitle } from "@/components/ui/SplitTitle";
import { imageUrl } from "@/lib/imageUrl";
import { sortCategories } from "@/lib/listFilters";
import { plural } from "@/lib/text";
import type { ItemInfo } from "@/types/models";
import { isTemp, useBoard } from "./board";
import { menuItem, menuPanel } from "./menuStyles";

const VISIBLE = 5;

function inboxState(item: ItemInfo): InboxState {
  if (isTemp(item.id) && item.url) return "pending";
  if (!item.url) return "no-link";
  if (item.fetchStatus === "pending") return "pending";
  if (item.fetchStatus === "failed") return "failed";
  if (item.fetchStatus === "partial") return "partial";
  return "ok";
}

/** Lien raccourci (« amazon.fr/dp/B0C7… ») tant que l'article n'a pas de nom. */
function shortUrl(url: string): string {
  const s = url.replace(/^https?:\/\/(www\.)?/, "");
  return s.length > 22 ? `${s.slice(0, 20)}…` : s;
}

/** Zone « À trier » : articles ajoutés mais pas encore rangés, les plus récents d'abord. */
export function Inbox() {
  const board = useBoard();
  const [expanded, setExpanded] = useState(false);
  const inbox = useMemo(
    () => board.items.filter((i) => !i.sortedAt).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [board.items],
  );
  if (inbox.length === 0) return null;

  const shown = expanded ? inbox : inbox.slice(0, VISIBLE);
  const withoutCategory = inbox.every((i) => !i.categoryId);
  const categories = sortCategories(board.categories);

  return (
    <section
      aria-labelledby="inbox-title"
      className="relative mx-auto mt-6 max-w-[1320px] px-3 max-lg:-mt-6 sm:px-12 lg:mt-11"
    >
      <div className="relative overflow-hidden rounded-[28px] border border-ochre/25 bg-[linear-gradient(135deg,rgb(236_220_190/0.95),rgb(226_196_150/0.85))] px-4 pt-5 pb-5 shadow-[0_30px_60px_-30px_rgb(90_55_10/0.45)] sm:px-8 sm:pt-7 sm:pb-8">
        <span aria-hidden="true" className="absolute inset-0 tex-ciel opacity-35" />
        <div className="relative flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <span id="inbox-title" className="contents">
              <SplitTitle
                title="À trier"
                restColor="text-ochre-deep"
                className="text-[34px] sm:text-[46px]"
              />
            </span>
            <span className="text-sm text-ink-soft max-sm:hidden">
              {plural(inbox.length, "nouveau", "nouveaux")}, pas encore rangés.
              {withoutCategory ? " Visibles dans « Non classé »." : " Visibles dans leur catégorie."}
            </span>
            <span className="text-sm text-ink-soft sm:hidden">{inbox.length}</span>
          </div>
          {categories.length ? (
            <DropdownMenu.Root>
              <DropdownMenu.Trigger className="inline-flex h-11 items-center gap-2 rounded-full border border-line-strong bg-white/55 px-4 text-sm font-semibold text-ink">
                Tout ranger dans…
                <ChevronDown aria-hidden="true" size={15} strokeWidth={2} />
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content align="end" sideOffset={8} className={menuPanel}>
                  {categories.map((c) => (
                    <DropdownMenu.Item key={c.id} className={menuItem} onSelect={() => board.sortAll(c.id)}>
                      {c.name}
                    </DropdownMenu.Item>
                  ))}
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>
          ) : null}
        </div>

        <ul
          role="list"
          aria-live="polite"
          className="relative m-0 mt-4 grid [scrollbar-width:none] list-none auto-cols-[118px] grid-flow-col gap-3 overflow-x-auto p-0 pb-1 sm:mt-6 sm:auto-cols-auto sm:grid-flow-row sm:grid-cols-[repeat(auto-fill,minmax(170px,1fr))] sm:gap-[22px] sm:overflow-visible"
        >
          {shown.map((item) => {
            const state = inboxState(item);
            const title = item.title?.trim() || (item.url ? shortUrl(item.url) : "Sans nom");
            const card = (
              <InboxCard
                state={state}
                title={title}
                domain={item.domain}
                priceCents={item.priceCents}
                currency={item.currency ?? board.list.currency}
                photo={
                  item.imagePath
                    ? { src480: imageUrl(item.imagePath, 480), lightBackground: item.lightBackground }
                    : null
                }
              />
            );
            return (
              <li key={item.id} className="min-w-0" data-item-ref={item.ref || undefined}>
                {isTemp(item.id) ? (
                  card
                ) : (
                  <Link
                    prefetch={false}
                    href={board.editHref(item.ref)}
                    scroll={false}
                    className="block rounded-field text-ink no-underline"
                  >
                    <span className="sr-only">Modifier : </span>
                    {card}
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
        {inbox.length > VISIBLE && !expanded ? (
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="relative mt-4 min-h-11 text-sm font-semibold underline underline-offset-4"
          >
            Voir les {inbox.length}
          </button>
        ) : null}
      </div>
    </section>
  );
}
