"use client";

import { Heart } from "lucide-react";
import { useMemo, useState } from "react";
import { Drawer } from "vaul";
import { Button } from "@/components/ui/Button";
import { Caps, Chip } from "@/components/ui/Chip";
import { Toggle } from "@/components/ui/Toggle";
import { cn } from "@/lib/cn";
import { EMPTY_FILTERS, ORDER_LABELS, ORDER_VALUES, applyFilters, type Filters } from "@/lib/listFilters";
import { tagColorVar } from "@/lib/tagColors";
import type { ListContent } from "@/types/models";
import type { CategoryTab } from "./ListBrowser";

type FilterSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  content: ListContent;
  tabs: CategoryTab[];
  filters: Filters;
  onApply: (filters: Filters) => void;
};

function applyLabel(n: number): string {
  if (n === 0) return "Aucun article";
  if (n === 1) return "Voir 1 article";
  return `Voir ${new Intl.NumberFormat("fr-FR").format(n)} articles`;
}

/** Feuille de filtres mobile : brouillon local, appliqué à la fermeture. */
export function FilterSheet({ open, onOpenChange, content, tabs, filters, onApply }: FilterSheetProps) {
  const [draft, setDraft] = useState(filters);
  const count = useMemo(() => applyFilters(content, draft).length, [content, draft]);
  const favoriteCount = useMemo(() => content.items.filter((i) => i.isFavorite).length, [content.items]);

  const change = (next: boolean) => {
    if (next) setDraft(filters);
    else onApply(draft);
    onOpenChange(next);
  };

  const toggleTag = (slug: string) =>
    setDraft((d) => ({
      ...d,
      tags: d.tags.includes(slug) ? d.tags.filter((t) => t !== slug) : [...d.tags, slug],
    }));

  return (
    <Drawer.Root open={open} onOpenChange={change} repositionInputs={false}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-50 bg-[rgb(24_20_10/0.55)]" />
        <Drawer.Content
          aria-describedby={undefined}
          className="fixed inset-x-0 bottom-0 z-50 flex max-h-[92dvh] flex-col rounded-t-sheet bg-paper text-ink outline-none"
        >
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 rounded-t-sheet opacity-50 grain-fine"
          />
          <Drawer.Handle className="relative mt-2 h-[5px]! w-11! bg-ink/22!" />
          <div className="relative flex items-baseline justify-between px-5 pt-4 pb-2">
            <Drawer.Title className="m-0 font-display-72 text-[34px] font-normal">Filtres</Drawer.Title>
            <button
              type="button"
              onClick={() => setDraft({ ...EMPTY_FILTERS, query: draft.query })}
              className="min-h-11 text-[15px] font-semibold text-rust underline underline-offset-4"
            >
              Tout effacer
            </button>
          </div>

          <div className="relative flex-1 overflow-y-auto px-5 pb-4">
            <div className="flex min-h-16 items-center gap-3 rounded-[18px] border border-rust/18 bg-rust/10 py-2.5 pr-3 pl-4">
              <Heart aria-hidden="true" size={18} className="shrink-0 fill-rust text-rust" />
              <span className="flex-1 text-base leading-tight font-semibold">
                Seulement les coups de cœur
              </span>
              <span className="text-sm text-muted">{favoriteCount}</span>
              <Toggle
                label="Seulement les coups de cœur"
                hideLabel
                tone="rust"
                checked={draft.favorites}
                onCheckedChange={(favorites) => setDraft((d) => ({ ...d, favorites }))}
              />
            </div>

            <fieldset className="m-0 mt-6 border-0 p-0">
              <Caps as="legend" size={11} className="mb-3">
                Catégorie
              </Caps>
              <div className="flex flex-wrap gap-2">
                {tabs.map((tab) => (
                  <Chip
                    key={tab.key ?? "tout"}
                    pressed={draft.category === tab.key}
                    count={tab.count}
                    onClick={() => setDraft((d) => ({ ...d, category: tab.key }))}
                    className="h-11 text-[15px]"
                  >
                    {tab.label}
                  </Chip>
                ))}
              </div>
            </fieldset>

            {content.tags.length ? (
              <fieldset className="m-0 mt-6 border-0 p-0">
                <Caps as="legend" size={11} className="mb-3">
                  Tags
                </Caps>
                <div className="flex flex-wrap gap-2">
                  {content.tags.map((tag) => (
                    <Chip
                      key={tag.id}
                      pressed={draft.tags.includes(tag.slug)}
                      tone={tagColorVar[tag.color]}
                      dot={tagColorVar[tag.color]}
                      onClick={() => toggleTag(tag.slug)}
                      className="h-11 text-[15px]"
                    >
                      {tag.name}
                    </Chip>
                  ))}
                </div>
              </fieldset>
            ) : null}

            <fieldset className="m-0 mt-6 border-0 p-0">
              <Caps as="legend" size={11} className="mb-3">
                Ordre
              </Caps>
              <div role="radiogroup" aria-label="Ordre" className="grid grid-cols-2 gap-2">
                {ORDER_VALUES.map((order) => {
                  const on = draft.order === order;
                  return (
                    <button
                      key={order}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      onClick={() => setDraft((d) => ({ ...d, order }))}
                      className={cn(
                        "h-[52px] rounded-field border text-[15px] font-semibold transition-colors duration-180",
                        on ? "border-ink bg-ink text-linen" : "border-line-strong bg-white/55 text-ink",
                      )}
                    >
                      {ORDER_LABELS[order]}
                    </button>
                  );
                })}
              </div>
            </fieldset>
          </div>

          <div className="relative px-4 pt-3 pb-[max(20px,env(safe-area-inset-bottom))]">
            <Button variant="ink" size={56} className="w-full" onClick={() => change(false)}>
              {applyLabel(count)}
            </Button>
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
