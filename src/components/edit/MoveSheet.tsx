"use client";

import * as Popover from "@radix-ui/react-popover";
import { useState, type ReactNode } from "react";
import { Drawer } from "vaul";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { sortCategories } from "@/lib/listFilters";
import { byPosition } from "@/lib/positions";
import type { ItemInfo } from "@/types/models";
import { useBoard } from "./board";

/** Choix de la catégorie, puis « En premier » / « En dernier ». Partagé desktop et mobile. */
function MoveChooser({ item, onDone }: { item: ItemInfo; onDone: () => void }) {
  const board = useBoard();
  const [categoryId, setCategoryId] = useState<string | null>(item.categoryId);
  const destinations = [
    ...sortCategories(board.categories).map((c) => ({ id: c.id as string | null, name: c.name })),
    { id: null, name: "Non classé" },
  ];

  const place = (where: "first" | "last") => {
    const inCategory = board.items
      .filter((i) => i.categoryId === categoryId && i.id !== item.id)
      .sort(byPosition);
    if (where === "first") board.move(item.id, categoryId, null, inCategory[0]?.id ?? null);
    else board.move(item.id, categoryId, inCategory.at(-1)?.id ?? null, null);
    onDone();
  };

  return (
    <>
      <div role="radiogroup" aria-label="Catégorie" className="flex flex-wrap gap-2">
        {destinations.map((d) => (
          <Chip
            key={d.id ?? "none"}
            role="radio"
            aria-checked={categoryId === d.id}
            pressed={categoryId === d.id}
            onClick={() => setCategoryId(d.id)}
            className="h-11 text-[15px]"
          >
            {d.name}
          </Chip>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Button variant="outline" size={52} onClick={() => place("first")}>
          En premier
        </Button>
        <Button variant="ink" size={52} onClick={() => place("last")}>
          En dernier
        </Button>
      </div>
    </>
  );
}

/** « Déplacer » sur mobile : feuille depuis le bas. */
export function MoveSheet({
  item,
  open,
  onOpenChange,
}: {
  item: ItemInfo;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-[60] bg-[rgb(24_20_10/0.55)]" />
        <Drawer.Content
          aria-describedby={undefined}
          className="fixed inset-x-0 bottom-0 z-[60] flex max-h-[90dvh] flex-col gap-5 rounded-t-sheet bg-paper px-4 pt-3 pb-[max(20px,env(safe-area-inset-bottom))] text-ink outline-none"
        >
          <Drawer.Handle className="h-[5px]! w-11! bg-ink/22!" />
          <Drawer.Title className="m-0 font-display-72 text-[30px] font-normal">Déplacer</Drawer.Title>
          <MoveChooser item={item} onDone={() => onOpenChange(false)} />
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}

/** « Déplacer » sur desktop : petit panneau sous le bouton de la carte. */
export function MovePopover({ item, trigger }: { item: ItemInfo; trigger: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>{trigger}</Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={8}
          aria-label="Déplacer"
          role="dialog"
          className="z-[70] flex w-[340px] flex-col gap-4 rounded-[22px] border border-white/55 bg-paper p-4 text-ink shadow-[0_30px_60px_-24px_rgb(43_36_22/0.45)] outline-none"
        >
          <p className="m-0 text-[11px] caps text-muted">Déplacer vers</p>
          <MoveChooser item={item} onDone={() => setOpen(false)} />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
