"use client";

import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Check, ChevronDown, ChevronRight, Plus, Search } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { buttonClasses } from "@/components/ui/Button";
import { ItemPhoto } from "@/components/ui/ItemPhoto";
import { SplitTitle } from "@/components/ui/SplitTitle";
import { ambianceTheme } from "@/lib/ambiance";
import { cn } from "@/lib/cn";
import { imageUrl } from "@/lib/imageUrl";
import { formatRelative } from "@/lib/relativeDate";
import { normalizeText, plural } from "@/lib/text";
import type { ListSummary } from "@/types/models";

type Sort = "recent" | "alpha" | "size";

const SORT_LABELS: Record<Sort, string> = {
  recent: "Récentes",
  alpha: "A → Z",
  size: "Plus d'articles",
};

const collator = new Intl.Collator("fr-FR", { sensitivity: "base" });

function sortLists(lists: ListSummary[], sort: Sort): ListSummary[] {
  const copy = [...lists];
  if (sort === "alpha") return copy.sort((a, b) => collator.compare(a.title, b.title));
  if (sort === "size") return copy.sort((a, b) => b.itemCount - a.itemCount);
  return copy.sort((a, b) => b.contentUpdatedAt.localeCompare(a.contentUpdatedAt));
}

type HomeBrowserProps = {
  lists: ListSummary[];
  /** Heure du rendu serveur, pour des dates relatives identiques au serveur et au client. */
  now: string;
};

/** Accueil : recherche instantanée, tri, cartes (desktop) ou rangées (mobile). */
export function HomeBrowser({ lists, now }: HomeBrowserProps) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<Sort>("recent");
  const nowDate = useMemo(() => new Date(now), [now]);

  const visible = useMemo(() => {
    const q = normalizeText(query);
    const filtered = q ? lists.filter((l) => normalizeText(`${l.title} ${l.ownerName}`).includes(q)) : lists;
    return sortLists(filtered, sort);
  }, [lists, query, sort]);

  return (
    <>
      <SearchBar query={query} onQuery={setQuery} sort={sort} onSort={setSort} />

      {lists.length === 0 ? (
        <EmptyHome />
      ) : (
        <>
          {/* Desktop et tablette : cartes */}
          <ul
            role="list"
            className="relative m-0 hidden list-none grid-cols-[repeat(auto-fill,minmax(min(360px,100%),1fr))] gap-x-8 gap-y-14 p-0 pt-20 sm:grid"
          >
            {query ? null : (
              <li>
                <NewListCard />
              </li>
            )}
            {visible.map((list) => (
              <li key={list.id}>
                <ListCard list={list} now={nowDate} />
              </li>
            ))}
          </ul>

          {/* Mobile : rangées */}
          <ul role="list" className="m-0 flex list-none flex-col p-0 pt-[18px] sm:hidden">
            {visible.map((list) => (
              <li key={list.id} className="border-b border-ink/10 last:border-b-0">
                <ListRow list={list} />
              </li>
            ))}
          </ul>

          {visible.length === 0 ? (
            <p className="m-0 py-16 text-center font-note text-[26px] text-ink" role="status">
              Aucune liste ne correspond.
            </p>
          ) : null}
        </>
      )}

      {/* Mobile : barre collante « Nouvelle liste » */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-ink/8 bg-[rgb(243_237_226/0.88)] px-4 pt-3.5 pb-[max(26px,env(safe-area-inset-bottom))] backdrop-blur-[16px] sm:hidden">
        <Link href="/nouvelle" className={buttonClasses("ink", 56, "w-full")}>
          <Plus aria-hidden="true" />
          Nouvelle liste
        </Link>
      </div>
    </>
  );
}

function SearchBar({
  query,
  onQuery,
  sort,
  onSort,
}: {
  query: string;
  onQuery: (q: string) => void;
  sort: Sort;
  onSort: (s: Sort) => void;
}) {
  return (
    <div className="relative z-10 mx-auto -mt-[26px] max-w-[640px] sm:-mt-9 sm:px-6">
      <div className="flex h-[52px] items-center gap-2 rounded-full py-1 pr-1 pl-[18px] glass-light sm:h-[60px] sm:py-2 sm:pr-2 sm:pl-[22px]">
        <Search aria-hidden="true" size={18} strokeWidth={1.75} className="shrink-0 text-ink" />
        <label htmlFor="home-search" className="sr-only">
          Chercher une liste
        </label>
        <input
          id="home-search"
          type="search"
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          placeholder="Une liste, un prénom"
          autoComplete="off"
          className="h-11 min-w-0 flex-1 border-0 bg-transparent text-base text-ink outline-none focus-visible:outline-none"
        />
        <DropdownMenu.Root>
          <DropdownMenu.Trigger
            className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-full border border-line-strong bg-white/40 px-4 text-sm font-semibold text-ink transition-colors duration-180 hover:bg-white/70"
            aria-label={`Trier : ${SORT_LABELS[sort]}`}
          >
            {SORT_LABELS[sort]}
            <ChevronDown aria-hidden="true" size={15} strokeWidth={2} />
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content
              align="end"
              sideOffset={8}
              className="z-50 min-w-[200px] rounded-[18px] border border-white/55 bg-paper p-1.5 shadow-[0_30px_60px_-24px_rgb(43_36_22/0.45)]"
            >
              <DropdownMenu.RadioGroup value={sort} onValueChange={(v) => onSort(v as Sort)}>
                {(Object.keys(SORT_LABELS) as Sort[]).map((s) => (
                  <DropdownMenu.RadioItem
                    key={s}
                    value={s}
                    className="flex h-11 cursor-pointer items-center justify-between gap-3 rounded-btn px-3 text-[15px] font-medium text-ink outline-none data-highlighted:bg-ink/6"
                  >
                    {SORT_LABELS[s]}
                    <DropdownMenu.ItemIndicator>
                      <Check aria-hidden="true" size={16} strokeWidth={2.2} className="text-ochre-deep" />
                    </DropdownMenu.ItemIndicator>
                  </DropdownMenu.RadioItem>
                ))}
              </DropdownMenu.RadioGroup>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </div>
    </div>
  );
}

function NewListCard() {
  return (
    <Link
      href="/nouvelle"
      className="on-dark relative flex h-[300px] flex-col justify-end overflow-hidden rounded-[22px] bg-ink p-[26px] text-linen no-underline shadow-[0_30px_50px_-24px_rgb(43_36_22/0.6)]"
    >
      <span aria-hidden="true" className="absolute inset-0 tex-feuillage opacity-45" />
      <span
        aria-hidden="true"
        className="relative mb-4 flex size-14 items-center justify-center rounded-full border border-linen/45 bg-linen/14"
      >
        <Plus size={24} strokeWidth={1.6} />
      </span>
      <SplitTitle as="span" title="Nouvelle liste" className="relative text-[44px]" />
      <span className="relative mt-2 text-sm text-honey">
        Pas de compte. Un nom, un mot de passe simple, et c&apos;est parti.
      </span>
    </Link>
  );
}

function ListCard({ list, now }: { list: ListSummary; now: Date }) {
  const theme = ambianceTheme(list.ambiance);
  return (
    <Link href={`/l/${list.slug}`} className="group flex flex-col text-ink no-underline">
      <span
        className={cn(
          "relative flex h-[300px] items-end overflow-hidden rounded-[22px] p-[26px] shadow-[0_30px_50px_-24px_rgb(43_36_22/0.55)] transition-transform duration-180 ease-out group-hover:-translate-y-0.5",
          theme.texture,
        )}
      >
        <span aria-hidden="true" className="absolute inset-0 grain-overlay opacity-50" />
        <SplitTitle
          as="h2"
          title={list.title}
          restColor={theme.italic}
          leading="leading-[0.95]"
          className={cn(
            "relative text-[52px]",
            theme.text,
            theme.dark && "[text-shadow:0_8px_30px_rgb(0_0_0/0.35)]",
          )}
        />
        <span
          className={cn(
            "absolute top-[18px] right-[18px] flex h-8 items-center rounded-full border px-3 text-[13px] font-semibold",
            theme.dark ? "border-linen/35 bg-linen/16 text-linen" : "border-white/55 bg-white/35 text-ink",
          )}
        >
          {plural(list.itemCount, "article", "articles")}
        </span>
      </span>
      <span className="flex items-start justify-between pr-1.5 pl-1">
        <span className="flex flex-col gap-0.5 pt-4">
          <b className="text-[15px] font-semibold">{list.ownerName}</b>
          <span className="text-[13px] text-muted">
            modifiée {formatRelative(new Date(list.contentUpdatedAt), now)}
          </span>
        </span>
        {list.thumbs.length > 0 ? (
          <span aria-hidden="true" className="-mt-[34px] flex">
            {list.thumbs.slice(0, 3).map((path, i) => (
              <ItemPhoto
                key={path}
                name=""
                src480={imageUrl(path, 480)}
                sizes="72px"
                className={cn(
                  "size-[72px] rounded-btn shadow-[0_0_0_3px_var(--color-cream),0_14px_24px_-10px_rgb(60_40_10/0.5)]",
                  i > 0 && "-ml-3.5",
                )}
              />
            ))}
          </span>
        ) : null}
      </span>
    </Link>
  );
}

function ListRow({ list }: { list: ListSummary }) {
  const theme = ambianceTheme(list.ambiance);
  return (
    <Link href={`/l/${list.slug}`} className="flex min-h-[92px] items-center gap-3.5 text-ink no-underline">
      <span
        aria-hidden="true"
        className={cn(
          "size-[68px] shrink-0 rounded-field shadow-[0_12px_22px_-10px_rgb(43_36_22/0.55)]",
          theme.texture,
        )}
      />
      <span className="flex min-w-0 flex-1 flex-col gap-[3px]">
        <SplitTitle
          as="h2"
          title={list.title}
          opsz={72}
          tracking="none"
          leading="leading-[1.05]"
          className="text-[26px]"
        />
        <span className="text-[13px] text-muted">
          {list.ownerName} · {plural(list.itemCount, "article", "articles")}
        </span>
      </span>
      <ChevronRight aria-hidden="true" size={20} strokeWidth={1.75} className="shrink-0 text-muted" />
    </Link>
  );
}

function EmptyHome() {
  return (
    <div className="flex flex-col items-center gap-6 py-20 text-center">
      <p className="m-0 font-note text-[26px] text-ink">Aucune liste pour l&apos;instant.</p>
      <Link href="/nouvelle" className={buttonClasses("ink", 46)}>
        <Plus aria-hidden="true" />
        Nouvelle liste
      </Link>
    </div>
  );
}
