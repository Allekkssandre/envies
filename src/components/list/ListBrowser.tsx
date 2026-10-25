"use client";

import * as Popover from "@radix-ui/react-popover";
import { ChevronDown, Heart, Search, SlidersHorizontal, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { ItemCard } from "@/components/ui/ItemCard";
import { SplitTitle } from "@/components/ui/SplitTitle";
import { useListFilters } from "@/hooks/useListFilters";
import { cn } from "@/lib/cn";
import { imageUrl } from "@/lib/imageUrl";
import {
  EMPTY_FILTERS,
  ORDER_LABELS,
  ORDER_VALUES,
  UNCATEGORIZED,
  applyFilters,
  categoryCounts,
  filtersQueryString,
  firstTag,
  groupIntoSections,
  hasActiveFilters,
  sortCategories,
  type Filters,
} from "@/lib/listFilters";
import { tagColorVar } from "@/lib/tagColors";
import { plural } from "@/lib/text";
import { itemName, type ListContent, type ListInfo } from "@/types/models";
import { FilterSheet } from "./FilterSheet";

type ListBrowserProps = { list: ListInfo; content: ListContent };

export type CategoryTab = { key: string | null; label: string; count: number };

/** Onglets de catégories non vides, avec « Tout » et « Non classé ». */
function useCategoryTabs(content: ListContent): CategoryTab[] {
  return useMemo(() => {
    const counts = categoryCounts(content.items);
    const known = new Set(content.categories.map((c) => c.id));
    const uncategorized = content.items.filter((i) => !i.categoryId || !known.has(i.categoryId)).length;
    return [
      { key: null, label: "Tout", count: content.items.length },
      ...sortCategories(content.categories)
        .map((c) => ({ key: c.ref, label: c.name, count: counts.get(c.id) ?? 0 }))
        .filter((t) => t.count > 0),
      ...(uncategorized > 0 ? [{ key: UNCATEGORIZED, label: "Non classé", count: uncategorized }] : []),
    ];
  }, [content]);
}

/** Filtres + sections de la page liste (visiteur). */
export function ListBrowser({ list, content }: ListBrowserProps) {
  const [filters, setFilters] = useListFilters();
  const tabs = useCategoryTabs(content);
  const visible = useMemo(() => applyFilters(content, filters), [content, filters]);
  const sections = useMemo(
    () => groupIntoSections(visible, content.categories),
    [visible, content.categories],
  );
  const query = filtersQueryString(filters);
  const update = (patch: Partial<Filters>) => setFilters({ ...filters, ...patch });

  return (
    <>
      <div className="sticky top-2 z-30 mx-auto -mt-[30px] max-w-[1320px] px-3 sm:px-12 lg:top-3 lg:-mt-11">
        <DesktopFilterBar content={content} tabs={tabs} filters={filters} update={update} />
        <MobileFilterBar
          content={content}
          tabs={tabs}
          filters={filters}
          onApply={setFilters}
          update={update}
        />
      </div>

      {list.description ? (
        <p className="mx-auto mt-6 mb-0 max-w-[1320px] px-4 font-note text-lg leading-[1.4] text-ink-soft sm:px-12 lg:hidden">
          {list.description}
        </p>
      ) : null}

      <div role="status" aria-live="polite" className="sr-only">
        {hasActiveFilters(filters) ? plural(visible.length, "article", "articles") : ""}
      </div>

      {content.items.length === 0 ? (
        <p className="m-0 px-4 py-24 text-center font-note text-[26px] text-ink sm:py-32">
          Cette liste est encore vide.
        </p>
      ) : sections.length === 0 ? (
        <NoResult filters={filters} content={content} onClear={() => setFilters(EMPTY_FILTERS)} />
      ) : (
        <div className="relative pt-6 pb-16 sm:pt-[84px] sm:pb-[110px]">
          {sections.map((section, index) => {
            const title = section.category?.name ?? "Non classé";
            const light = index % 2 === 1;
            return (
              <section
                key={section.category?.id ?? "non-classe"}
                id={`c-${section.category?.ref ?? UNCATEGORIZED}`}
                aria-labelledby={`h-${section.category?.ref ?? UNCATEGORIZED}`}
                className={cn(
                  "scroll-mt-28",
                  light && "section-light",
                  light ? "py-16 sm:py-[150px]" : "py-5 sm:py-0",
                )}
              >
                <div className="mx-auto max-w-[1320px] px-4 sm:px-12">
                  <div className="mb-4 flex items-baseline justify-between gap-4 sm:mb-[34px] sm:border-b sm:border-ink/16 sm:pb-4">
                    <span id={`h-${section.category?.ref ?? UNCATEGORIZED}`} className="contents">
                      <SplitTitle
                        title={title}
                        restColor={light ? "text-ochre-deep" : "text-ochre"}
                        className="text-[42px] sm:text-[72px]"
                      />
                    </span>
                    <span
                      className={cn(
                        "text-[11px] caps sm:text-[13px]",
                        light ? "text-[#5A4A30]" : "text-muted",
                      )}
                    >
                      <span className="sm:hidden">{section.items.length}</span>
                      <span className="hidden sm:inline">
                        {plural(section.items.length, "article", "articles")}
                      </span>
                    </span>
                  </div>
                  <ul
                    role="list"
                    className="m-0 grid list-none grid-cols-2 gap-x-3.5 gap-y-[22px] p-0 sm:grid-cols-[repeat(auto-fill,minmax(min(260px,100%),1fr))] sm:gap-x-8 sm:gap-y-12"
                  >
                    {section.items.map((item) => {
                      const tag = firstTag(item, content.tags);
                      return (
                        <li key={item.id} className="min-w-0">
                          <ItemCard
                            href={`/l/${list.slug}/a/${item.ref}${query}`}
                            title={itemName(item)}
                            priceCents={item.priceCents}
                            currency={item.currency ?? list.currency}
                            domain={item.domain}
                            tag={tag ? { name: tag.name, color: tagColorVar[tag.color] } : null}
                            isFavorite={item.isFavorite}
                            photo={
                              item.imagePath
                                ? {
                                    src480: imageUrl(item.imagePath, 480),
                                    src1200: imageUrl(item.imagePath, 1200),
                                    lightBackground: item.lightBackground,
                                  }
                                : null
                            }
                            photoClassName="h-[210px] sm:h-[340px]"
                          />
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </section>
            );
          })}
        </div>
      )}
    </>
  );
}

type BarProps = {
  content: ListContent;
  tabs: CategoryTab[];
  filters: Filters;
  update: (patch: Partial<Filters>) => void;
};

function CategoryTabs({
  tabs,
  active,
  onSelect,
  compact,
}: {
  tabs: CategoryTab[];
  active: string | null;
  onSelect: (key: string | null) => void;
  compact?: boolean;
}) {
  return (
    <nav
      aria-label="Catégories"
      className={cn(
        "flex min-w-0 [scrollbar-width:none] overflow-x-auto whitespace-nowrap",
        compact ? "flex-1 gap-5" : "gap-[26px]",
      )}
    >
      {tabs.map((tab) => {
        const on = active === tab.key;
        return (
          <button
            key={tab.key ?? "tout"}
            type="button"
            aria-pressed={on}
            onClick={() => onSelect(tab.key)}
            className={cn(
              "h-11 shrink-0 border-b-2 px-0 transition-colors duration-180",
              compact ? "text-[15px]" : "text-base",
              on
                ? "border-ochre font-bold text-ink"
                : "border-transparent font-semibold text-ink-soft hover:text-ink",
            )}
          >
            {tab.label}
            {compact ? null : (
              <span className={cn("ml-1.5 font-medium", on ? "text-[#7A5A2A]" : "")}>{tab.count}</span>
            )}
          </button>
        );
      })}
    </nav>
  );
}

function DesktopFilterBar({ content, tabs, filters, update }: BarProps) {
  const [searchOpen, setSearchOpen] = useState(Boolean(filters.query));
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (searchOpen) inputRef.current?.focus();
  }, [searchOpen]);

  return (
    <div className="hidden items-center justify-between gap-5 rounded-sheet py-3.5 pr-[18px] pl-7 glass-light lg:flex">
      {searchOpen ? (
        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          <Search aria-hidden="true" size={18} strokeWidth={1.75} className="shrink-0" />
          <label htmlFor="list-search" className="sr-only">
            Chercher dans la liste
          </label>
          <input
            ref={inputRef}
            id="list-search"
            type="search"
            value={filters.query}
            onChange={(e) => update({ query: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                update({ query: "" });
                setSearchOpen(false);
              }
            }}
            placeholder="Chercher dans la liste"
            className="h-11 min-w-0 flex-1 border-0 bg-transparent text-base text-ink outline-none focus-visible:outline-none"
          />
        </div>
      ) : (
        <CategoryTabs tabs={tabs} active={filters.category} onSelect={(key) => update({ category: key })} />
      )}
      <div className="flex shrink-0 items-center gap-1.5">
        <button
          type="button"
          aria-pressed={filters.favorites}
          onClick={() => update({ favorites: !filters.favorites })}
          className={cn(
            "inline-flex h-[42px] items-center gap-1.5 rounded-full px-3.5 text-sm font-bold transition-colors duration-180",
            filters.favorites ? "bg-rust text-linen" : "text-rust hover:bg-rust/8",
          )}
        >
          <Heart aria-hidden="true" size={16} className="fill-current" strokeWidth={1.6} />
          Coups de cœur
        </button>
        <TagsPopover content={content} filters={filters} update={update} />
        <OrderPopover filters={filters} update={update} />
        <button
          type="button"
          aria-label={searchOpen ? "Fermer la recherche" : "Chercher dans la liste"}
          aria-expanded={searchOpen}
          onClick={() => {
            if (searchOpen) update({ query: "" });
            setSearchOpen((v) => !v);
          }}
          className="inline-flex size-[42px] items-center justify-center rounded-full bg-ink text-linen transition-colors duration-180 hover:bg-ink-soft"
        >
          {searchOpen ? (
            <X aria-hidden="true" size={17} strokeWidth={1.75} />
          ) : (
            <Search aria-hidden="true" size={17} strokeWidth={1.75} />
          )}
        </button>
      </div>
    </div>
  );
}

const popoverButton =
  "inline-flex h-[42px] items-center gap-1.5 rounded-full border px-3.5 text-sm font-semibold transition-colors duration-180";
const popoverPanel =
  "z-50 min-w-[240px] rounded-[20px] border border-white/55 bg-paper p-2 shadow-[0_30px_60px_-24px_rgb(43_36_22/0.45)] outline-none";

function TagsPopover({ content, filters, update }: Omit<BarProps, "tabs">) {
  if (content.tags.length === 0) return null;
  const count = filters.tags.length;
  return (
    <Popover.Root>
      <Popover.Trigger
        className={cn(
          popoverButton,
          count
            ? "border-ink bg-ink text-linen"
            : "border-line-strong bg-white/35 text-ink hover:bg-white/70",
        )}
      >
        Tags{count ? ` · ${count}` : ""}
        <ChevronDown aria-hidden="true" size={15} strokeWidth={2} />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content align="end" sideOffset={10} className={popoverPanel}>
          <fieldset className="m-0 border-0 p-0">
            <legend className="px-3 pt-2 pb-1 text-[11px] caps text-muted">Tags</legend>
            {content.tags.map((tag) => {
              const checked = filters.tags.includes(tag.slug);
              return (
                <label
                  key={tag.id}
                  className="flex h-11 cursor-pointer items-center gap-3 rounded-btn px-3 text-[15px] font-medium hover:bg-ink/5"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() =>
                      update({
                        tags: checked
                          ? filters.tags.filter((t) => t !== tag.slug)
                          : [...filters.tags, tag.slug],
                      })
                    }
                    className="size-[18px] accent-ink"
                  />
                  <span
                    aria-hidden="true"
                    className="size-2 shrink-0 rounded-full"
                    style={{ background: tagColorVar[tag.color] }}
                  />
                  {tag.name}
                </label>
              );
            })}
          </fieldset>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

function OrderPopover({ filters, update }: Omit<BarProps, "tabs" | "content">) {
  return (
    <Popover.Root>
      <Popover.Trigger
        className={cn(popoverButton, "border-line-strong bg-white/35 text-ink hover:bg-white/70")}
      >
        {ORDER_LABELS[filters.order]}
        <ChevronDown aria-hidden="true" size={15} strokeWidth={2} />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content align="end" sideOffset={10} className={popoverPanel}>
          <fieldset className="m-0 border-0 p-0">
            <legend className="px-3 pt-2 pb-1 text-[11px] caps text-muted">Ordre</legend>
            {ORDER_VALUES.map((order) => (
              <label
                key={order}
                className="flex h-11 cursor-pointer items-center gap-3 rounded-btn px-3 text-[15px] font-medium hover:bg-ink/5"
              >
                <input
                  type="radio"
                  name="list-order"
                  checked={filters.order === order}
                  onChange={() => update({ order })}
                  className="size-[18px] accent-ink"
                />
                {ORDER_LABELS[order]}
              </label>
            ))}
          </fieldset>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

function MobileFilterBar({
  content,
  tabs,
  filters,
  update,
  onApply,
}: BarProps & { onApply: (f: Filters) => void }) {
  const [open, setOpen] = useState(false);
  const extra = filters.tags.length + (filters.favorites ? 1 : 0) + (filters.order !== "liste" ? 1 : 0);
  return (
    <div className="flex items-center gap-1.5 rounded-[22px] py-1.5 pr-1.5 pl-[18px] glass-light lg:hidden">
      <CategoryTabs
        tabs={tabs}
        active={filters.category}
        onSelect={(key) => update({ category: key })}
        compact
      />
      <Button
        variant="ink"
        size={44}
        className="rounded-field px-3.5 text-sm shadow-none"
        icon={<SlidersHorizontal aria-hidden="true" />}
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
      >
        Filtres{extra ? ` · ${extra}` : ""}
      </Button>
      <FilterSheet
        open={open}
        onOpenChange={setOpen}
        content={content}
        tabs={tabs}
        filters={filters}
        onApply={onApply}
      />
    </div>
  );
}

function NoResult({
  filters,
  content,
  onClear,
}: {
  filters: Filters;
  content: ListContent;
  onClear: () => void;
}) {
  const parts: string[] = [];
  if (filters.category) {
    parts.push(
      filters.category === UNCATEGORIZED
        ? "Non classé"
        : (content.categories.find((c) => c.ref === filters.category)?.name ?? ""),
    );
  }
  for (const slug of filters.tags) {
    const tag = content.tags.find((t) => t.slug === slug);
    if (tag) parts.push(tag.name);
  }
  if (filters.favorites) parts.push("coups de cœur");
  if (filters.query.trim()) parts.push(`« ${filters.query.trim()} »`);
  return (
    <div className="flex flex-col items-center gap-3 px-4 py-24 text-center sm:py-32">
      <p className="m-0 font-note text-[28px] text-ink">Rien avec ces filtres.</p>
      {parts.length ? <p className="m-0 text-sm text-muted">{parts.filter(Boolean).join(" · ")}</p> : null}
      <Button variant="outline" className="mt-3" onClick={onClear}>
        Tout effacer
      </Button>
    </div>
  );
}
