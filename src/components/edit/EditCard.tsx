"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Check, Ellipsis, Folder, GripVertical, Heart, Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, type MouseEvent, type PointerEvent } from "react";
import { ItemPhoto } from "@/components/ui/ItemPhoto";
import { cn } from "@/lib/cn";
import { formatPrice } from "@/lib/format";
import { imageUrl } from "@/lib/imageUrl";
import { firstTag } from "@/lib/listFilters";
import { tagColorVar } from "@/lib/tagColors";
import { itemName, type ItemInfo } from "@/types/models";
import { isTemp, useBoard } from "./board";
import { menuItem, menuPanel } from "./menuStyles";
import { MovePopover, MoveSheet } from "./MoveSheet";

type EditCardProps = { item: ItemInfo; overlay?: boolean };

/**
 * Carte en édition : cœur cliquable, case de sélection, poignée, barre d'actions au survol (desktop),
 * menu ⋯ (mobile). Toucher la carte ouvre « Modifier l'article » ; appui long = sélection.
 */
export function EditCard({ item, overlay = false }: EditCardProps) {
  const board = useBoard();
  const router = useRouter();
  const temp = isTemp(item.id);
  const selected = board.selection.has(item.id);
  const name = itemName(item);
  const tag = firstTag(item, board.tags);
  const [moving, setMoving] = useState(false);
  const longPress = useRef<{ timer: ReturnType<typeof setTimeout> | null; fired: boolean }>({
    timer: null,
    fired: false,
  });

  const { setNodeRef, setActivatorNodeRef, attributes, listeners, transform, transition, isDragging } =
    useSortable({
      id: item.id,
      data: { type: "item", categoryId: item.categoryId },
      disabled: temp || overlay,
    });
  const style = overlay ? undefined : { transform: CSS.Transform.toString(transform), transition };

  const href = temp ? undefined : board.editHref(item.ref);

  // Carte fantôme pendant le glisser-déposer : visuelle seulement (aucun contrôle en double).
  if (overlay) {
    return (
      <div aria-hidden="true" className="flex flex-col gap-4">
        <ItemPhoto
          name={name}
          src480={item.imagePath ? imageUrl(item.imagePath, 480) : null}
          lightBackground={item.lightBackground}
          className="h-[340px]"
        />
        <span className="px-0.5 text-base font-medium">{name}</span>
      </div>
    );
  }

  const onCardClick = (e: MouseEvent) => {
    if (longPress.current.fired) {
      e.preventDefault();
      longPress.current.fired = false;
      return;
    }
    if (board.selectionMode || e.shiftKey) {
      e.preventDefault();
      board.toggleSelect(item.id, { range: e.shiftKey });
    }
  };

  const onPointerDown = (e: PointerEvent) => {
    if (e.pointerType !== "touch" || temp) return;
    longPress.current.fired = false;
    longPress.current.timer = setTimeout(() => {
      longPress.current.fired = true;
      board.setSelectionMode(true);
      board.toggleSelect(item.id);
      navigator.vibrate?.(10);
    }, 500);
  };
  const cancelLongPress = () => {
    if (longPress.current.timer) clearTimeout(longPress.current.timer);
  };

  return (
    <article
      ref={setNodeRef}
      style={style}
      data-item-ref={item.ref || undefined}
      className={cn(
        "group/card relative flex min-w-0 flex-col gap-3.5 sm:gap-4",
        isDragging && "opacity-40",
        board.highlight === item.ref && item.ref && "animate-pulse",
      )}
    >
      <div className="relative">
        <Link
          prefetch={false}
          href={href ?? "#"}
          scroll={false}
          aria-disabled={temp || undefined}
          tabIndex={temp ? -1 : undefined}
          onClick={onCardClick}
          onPointerDown={onPointerDown}
          onPointerUp={cancelLongPress}
          onPointerLeave={cancelLongPress}
          onContextMenu={(e) => longPress.current.fired && e.preventDefault()}
          className={cn("block rounded-photo", temp && "pointer-events-none")}
          aria-label={`Modifier : ${name}`}
        >
          <ItemPhoto
            name={name}
            src480={item.imagePath ? imageUrl(item.imagePath, 480) : null}
            src1200={item.imagePath ? imageUrl(item.imagePath, 1200) : null}
            lightBackground={item.lightBackground}
            className={cn(
              "h-[210px] sm:h-[340px]",
              selected && "outline-3 outline-offset-4 outline-ink",
              board.highlight === item.ref && item.ref && "outline-3 outline-offset-4 outline-ochre",
            )}
          />
        </Link>

        {/* Cœur : toujours visible, cliquable */}
        <button
          type="button"
          aria-pressed={item.isFavorite}
          aria-label={item.isFavorite ? "Retirer des coups de cœur" : "Ajouter aux coups de cœur"}
          disabled={temp}
          onClick={() => void board.update(item, { isFavorite: !item.isFavorite })}
          className="absolute top-2 right-2 flex size-11 items-center justify-center rounded-full bg-linen/75 shadow-[0_6px_14px_-6px_rgb(43_36_22/0.4)] backdrop-blur-[10px] sm:top-3 sm:right-3"
        >
          <Heart
            aria-hidden="true"
            size={18}
            strokeWidth={1.8}
            className={item.isFavorite ? "fill-rust text-rust" : "text-ink"}
          />
        </button>

        {/* Case de sélection : au survol, au focus, ou toujours en mode sélection */}
        {!temp ? (
          <button
            type="button"
            role="checkbox"
            aria-checked={selected}
            aria-label={`Sélectionner : ${name}`}
            onClick={(e) => board.toggleSelect(item.id, { range: e.shiftKey })}
            className={cn(
              "absolute top-2 left-2 flex size-11 items-center justify-center sm:top-3 sm:left-3",
              board.selectionMode || selected
                ? "opacity-100"
                : "opacity-0 group-hover/card:opacity-100 focus-visible:opacity-100 max-lg:pointer-events-none",
            )}
          >
            <span
              aria-hidden="true"
              className={cn(
                "flex size-7 items-center justify-center rounded-[8px] border-2 transition-colors duration-180",
                selected ? "border-ink bg-ink text-linen" : "border-white/90 bg-white/55 backdrop-blur-[6px]",
              )}
            >
              {selected ? <Check size={16} strokeWidth={2.6} /> : null}
            </span>
          </button>
        ) : null}

        {/* Poignée (glisser-déposer, clavier : Espace puis flèches) */}
        {!temp ? (
          <button
            type="button"
            ref={setActivatorNodeRef}
            {...attributes}
            {...listeners}
            aria-label={`Déplacer : ${name}`}
            aria-roledescription="élément déplaçable"
            className="absolute top-1/2 -left-4 hidden h-11 w-7 -translate-y-1/2 cursor-grab touch-none items-center justify-center rounded-[10px] border border-line bg-paper/90 text-ink-soft opacity-0 shadow-sm group-hover/card:opacity-100 focus-visible:opacity-100 active:cursor-grabbing lg:flex"
          >
            <GripVertical aria-hidden="true" size={16} strokeWidth={1.8} />
          </button>
        ) : null}

        {/* Barre d'actions au survol (desktop) */}
        {!temp ? (
          <div className="absolute inset-x-2 bottom-2 hidden items-center gap-1.5 rounded-full p-1.5 opacity-0 glass-light transition-opacity duration-180 group-focus-within/card:opacity-100 group-hover/card:opacity-100 lg:flex">
            <Link
              prefetch={false}
              href={href!}
              scroll={false}
              className="inline-flex h-10 items-center gap-1.5 rounded-full bg-ink px-3.5 text-sm font-semibold text-linen no-underline"
            >
              <Pencil aria-hidden="true" size={15} strokeWidth={1.7} />
              Modifier
            </Link>
            <MovePopover
              item={item}
              trigger={
                <button
                  type="button"
                  className="inline-flex h-10 items-center gap-1.5 rounded-full border border-line-strong bg-white/60 px-3.5 text-sm font-semibold"
                >
                  <Folder aria-hidden="true" size={15} strokeWidth={1.7} />
                  Déplacer
                </button>
              }
            />
            <button
              type="button"
              aria-label="Supprimer"
              onClick={() => board.remove([item.id])}
              className="ml-auto flex size-10 items-center justify-center rounded-full border border-line-strong bg-white/60 text-ink hover:text-rust"
            >
              <Trash2 aria-hidden="true" size={16} strokeWidth={1.7} />
            </button>
          </div>
        ) : null}

        {/* Menu ⋯ (mobile) */}
        {!temp ? (
          <DropdownMenu.Root>
            <DropdownMenu.Trigger
              aria-label="Actions"
              className="absolute right-2 bottom-2 flex size-11 items-center justify-center rounded-full bg-linen/75 backdrop-blur-[10px] lg:hidden"
            >
              <Ellipsis aria-hidden="true" size={18} strokeWidth={1.8} />
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content align="end" sideOffset={6} className={menuPanel}>
                <DropdownMenu.Item
                  className={menuItem}
                  onSelect={() => router.push(href!, { scroll: false })}
                >
                  Modifier
                </DropdownMenu.Item>
                <DropdownMenu.Item className={menuItem} onSelect={() => setMoving(true)}>
                  Déplacer
                </DropdownMenu.Item>
                <DropdownMenu.Item
                  className={menuItem}
                  onSelect={() => void board.update(item, { isFavorite: !item.isFavorite })}
                >
                  {item.isFavorite ? "Retirer des coups de cœur" : "Coup de cœur"}
                </DropdownMenu.Item>
                <DropdownMenu.Item
                  className={cn(menuItem, "text-rust")}
                  onSelect={() => board.remove([item.id])}
                >
                  Supprimer
                </DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        ) : null}
      </div>

      <span className="flex flex-col gap-1.5 px-0.5">
        <span className="flex items-baseline justify-between gap-3">
          <h3 className="m-0 line-clamp-2 text-sm leading-[1.35] font-medium sm:text-base">{name}</h3>
          {item.priceCents != null ? (
            <b className="font-serif text-lg leading-none font-medium tabular sm:text-[21px]">
              {formatPrice(item.priceCents, item.currency ?? board.list.currency)}
            </b>
          ) : null}
        </span>
        {item.domain || tag ? (
          <span className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[13px] text-muted">
            {item.domain}
            {tag ? (
              <span className="inline-flex items-center gap-[5px]">
                <span
                  aria-hidden="true"
                  className="size-[7px] rounded-full"
                  style={{ background: tagColorVar[tag.color] }}
                />
                {tag.name}
              </span>
            ) : null}
          </span>
        ) : null}
      </span>
      {!temp && !overlay ? <MoveSheet item={item} open={moving} onOpenChange={setMoving} /> : null}
    </article>
  );
}
