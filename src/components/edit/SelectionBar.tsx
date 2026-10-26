"use client";

import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Check, ChevronDown, Folder, Heart, Tag, Trash2, X } from "lucide-react";
import { useEffect } from "react";
import { cn } from "@/lib/cn";
import { sortCategories } from "@/lib/listFilters";
import { tagColorVar } from "@/lib/tagColors";
import { useBoard } from "./board";
import { menuItem, menuPanel } from "./menuStyles";

const barButton =
  "inline-flex h-11 shrink-0 items-center gap-2 rounded-full border border-linen/25 px-3.5 text-sm font-semibold text-linen hover:bg-linen/10";

/** Barre flottante de sélection : catégorie, tags, coup de cœur, suppression. Échap désélectionne. */
export function SelectionBar() {
  const board = useBoard();
  const ids = [...board.selection];
  const count = ids.length;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (e.key === "Escape" && !t?.closest("input, textarea, [role=menu], [role=dialog]"))
        board.clearSelection();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [board]);

  if (!board.selectionMode) return null;
  const selected = board.items.filter((i) => board.selection.has(i.id));
  const allFavorite = selected.length > 0 && selected.every((i) => i.isFavorite);

  return (
    <div
      role="toolbar"
      aria-label="Sélection"
      className="fixed inset-x-3 bottom-[88px] z-50 mx-auto flex max-w-[780px] [scrollbar-width:none] items-center gap-1.5 overflow-x-auto rounded-full bg-ink/92 py-1.5 pr-1.5 pl-5 text-linen shadow-modal backdrop-blur-[14px] lg:bottom-8"
    >
      <span className="mr-2 shrink-0 text-[15px] font-bold" aria-live="polite">
        {count === 1 ? "1 sélectionné" : `${count} sélectionnés`}
      </span>

      <DropdownMenu.Root>
        <DropdownMenu.Trigger className={barButton} disabled={!count}>
          <Folder aria-hidden="true" size={16} strokeWidth={1.7} />
          Catégorie
          <ChevronDown aria-hidden="true" size={15} strokeWidth={2} />
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content side="top" sideOffset={10} className={menuPanel}>
            {sortCategories(board.categories).map((c) => (
              <DropdownMenu.Item
                key={c.id}
                className={menuItem}
                onSelect={() => board.bulk(ids, { categoryId: c.id })}
              >
                {c.name}
              </DropdownMenu.Item>
            ))}
            <DropdownMenu.Item className={menuItem} onSelect={() => board.bulk(ids, { categoryId: null })}>
              Non classé
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>

      {board.tags.length ? (
        <DropdownMenu.Root>
          <DropdownMenu.Trigger className={barButton} disabled={!count}>
            <Tag aria-hidden="true" size={16} strokeWidth={1.7} />
            Tags
            <ChevronDown aria-hidden="true" size={15} strokeWidth={2} />
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content side="top" sideOffset={10} className={menuPanel}>
              {board.tags.map((t) => {
                const all = selected.length > 0 && selected.every((i) => i.tagIds.includes(t.id));
                return (
                  <DropdownMenu.CheckboxItem
                    key={t.id}
                    checked={all}
                    className={menuItem}
                    onSelect={(e) => e.preventDefault()}
                    onCheckedChange={(on) =>
                      board.bulk(ids, on ? { addTagIds: [t.id] } : { removeTagIds: [t.id] })
                    }
                  >
                    <span className="flex items-center gap-2.5">
                      <span
                        aria-hidden="true"
                        className="size-2 rounded-full"
                        style={{ background: tagColorVar[t.color] }}
                      />
                      {t.name}
                    </span>
                    <DropdownMenu.ItemIndicator>
                      <Check aria-hidden="true" size={16} strokeWidth={2.2} />
                    </DropdownMenu.ItemIndicator>
                  </DropdownMenu.CheckboxItem>
                );
              })}
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      ) : null}

      <button
        type="button"
        aria-pressed={allFavorite}
        disabled={!count}
        onClick={() => board.bulk(ids, { isFavorite: !allFavorite })}
        className={barButton}
      >
        <Heart aria-hidden="true" size={16} strokeWidth={1.7} className={cn(allFavorite && "fill-current")} />
        Coup de cœur
      </button>
      <button
        type="button"
        disabled={!count}
        onClick={() => {
          board.remove(ids);
          board.clearSelection();
        }}
        className="inline-flex h-11 shrink-0 items-center gap-2 rounded-full bg-rust px-4 text-sm font-semibold text-linen"
      >
        <Trash2 aria-hidden="true" size={16} strokeWidth={1.7} />
        Supprimer
      </button>
      <button
        type="button"
        aria-label="Annuler la sélection"
        onClick={board.clearSelection}
        className="flex size-11 shrink-0 items-center justify-center rounded-full border border-linen/25 hover:bg-linen/10"
      >
        <X aria-hidden="true" size={18} strokeWidth={1.8} />
      </button>
    </div>
  );
}
