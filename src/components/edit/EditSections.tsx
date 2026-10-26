"use client";

import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  pointerWithin,
  useDroppable,
  useSensor,
  useSensors,
  type Announcements,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Check, GripVertical, Pencil, Plus, X } from "lucide-react";
import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import { SplitTitle } from "@/components/ui/SplitTitle";
import { cn } from "@/lib/cn";
import { sortCategories } from "@/lib/listFilters";
import { byPosition } from "@/lib/positions";
import { plural } from "@/lib/text";
import { itemName, type CategoryInfo, type ItemInfo } from "@/types/models";
import { useBoard } from "./board";
import { EditCard } from "./EditCard";

const SECTION = "sec:";
const NONE = "none";

type Group = { category: CategoryInfo | null; items: ItemInfo[] };

/** Sections du mode édition, avec glisser-déposer des cartes (dans et entre sections) et des sections. */
export function EditSections() {
  const board = useBoard();
  const [active, setActive] = useState<{ type: "item" | "section"; id: string } | null>(null);

  const groups: Group[] = useMemo(() => {
    const sorted = [...board.items].sort(byPosition);
    const known = new Set(board.categories.map((c) => c.id));
    const list: Group[] = sortCategories(board.categories).map((category) => ({
      category,
      items: sorted.filter((i) => i.categoryId === category.id),
    }));
    list.push({ category: null, items: sorted.filter((i) => !i.categoryId || !known.has(i.categoryId)) });
    // Les catégories vides restent visibles (on peut y déposer) ; « Non classé » seulement s'il contient des articles.
    return list.filter((g) => g.category || g.items.length);
  }, [board.items, board.categories]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // Sections : seulement entre sections. Cartes : sous le pointeur, sinon la plus proche.
  const collision: CollisionDetection = (args) => {
    const type = args.active.data.current?.type;
    if (type === "section") {
      return closestCenter({
        ...args,
        droppableContainers: args.droppableContainers.filter((c) => String(c.id).startsWith(SECTION)),
      });
    }
    const within = pointerWithin(args);
    const overItem = within.filter(
      (c) => !String(c.id).startsWith(SECTION) && !String(c.id).startsWith("drop:"),
    );
    if (overItem.length) return overItem;
    if (within.length) return within;
    return closestCenter({
      ...args,
      droppableContainers: args.droppableContainers.filter((c) => !String(c.id).startsWith(SECTION)),
    });
  };

  const findItem = (id: string) => board.items.find((i) => i.id === id);

  const onDragStart = (e: DragStartEvent) => {
    const id = String(e.active.id);
    setActive(
      id.startsWith(SECTION) ? { type: "section", id: id.slice(SECTION.length) } : { type: "item", id },
    );
  };

  const onDragEnd = (e: DragEndEvent) => {
    setActive(null);
    const { active: dragged, over } = e;
    if (!over) return;
    const activeId = String(dragged.id);
    const overId = String(over.id);

    if (activeId.startsWith(SECTION)) {
      if (!overId.startsWith(SECTION) || overId === activeId) return;
      const ordered = sortCategories(board.categories);
      const from = ordered.findIndex((c) => SECTION + c.id === activeId);
      const to = ordered.findIndex((c) => SECTION + c.id === overId);
      if (from < 0 || to < 0) return;
      const without = ordered.filter((_, i) => i !== from);
      const before = to > from ? ordered[to] : without[to - 1];
      const after = to > from ? without[to] : ordered[to];
      board.moveCategory(ordered[from]!.id, before?.id ?? null, after?.id ?? null);
      return;
    }

    const item = findItem(activeId);
    if (!item) return;
    let categoryId: string | null;
    let overItem: ItemInfo | undefined;
    if (overId.startsWith(SECTION) || overId.startsWith("drop:")) {
      const key = overId.replace(SECTION, "").replace("drop:", "");
      categoryId = key === NONE ? null : key;
    } else {
      overItem = findItem(overId);
      if (!overItem || overItem.id === item.id) return;
      categoryId = overItem.categoryId;
    }

    const dest = [...board.items]
      .filter((i) => i.categoryId === categoryId && i.id !== item.id)
      .sort(byPosition);
    if (!overItem) {
      board.move(item.id, categoryId, dest.at(-1)?.id ?? null, null);
      return;
    }
    const overIndex = dest.findIndex((i) => i.id === overItem.id);
    // Même section en descendant : après la cible ; sinon avant.
    const sameSection = item.categoryId === categoryId;
    const original = [...board.items].filter((i) => i.categoryId === categoryId).sort(byPosition);
    const movingDown = sameSection && original.indexOf(item) < original.indexOf(overItem);
    const before = movingDown ? overItem : dest[overIndex - 1];
    const after = movingDown ? dest[overIndex + 1] : overItem;
    board.move(item.id, categoryId, before?.id ?? null, after?.id ?? null);
  };

  const label = (id: string | number) => {
    const s = String(id);
    if (s.startsWith(SECTION))
      return board.categories.find((c) => SECTION + c.id === s)?.name ?? "la section";
    if (s.startsWith("drop:")) return "Non classé";
    const item = findItem(s);
    return item ? itemName(item) : "l'article";
  };
  const announcements: Announcements = {
    onDragStart: ({ active: a }) => `${label(a.id)} saisi.`,
    onDragOver: ({ active: a, over }) =>
      over ? `${label(a.id)} au-dessus de ${label(over.id)}.` : `${label(a.id)} déplacé.`,
    onDragEnd: ({ active: a, over }) =>
      over ? `${label(a.id)} déposé près de ${label(over.id)}.` : `${label(a.id)} relâché.`,
    onDragCancel: ({ active: a }) => `Déplacement de ${label(a.id)} annulé.`,
  };

  const activeItem = active?.type === "item" ? findItem(active.id) : undefined;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collision}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragCancel={() => setActive(null)}
      accessibility={{
        announcements,
        screenReaderInstructions: {
          draggable:
            "Pour déplacer, appuyez sur Espace, utilisez les flèches, puis Espace pour déposer ou Échap pour annuler.",
        },
      }}
    >
      <SortableContext
        items={groups.filter((g) => g.category).map((g) => SECTION + g.category!.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="relative pt-8 pb-32 sm:pt-16 lg:pb-[110px]">
          {groups.map((group, index) =>
            group.category ? (
              <SortableSection key={group.category.id} group={group} light={index % 2 === 1} />
            ) : (
              <UncategorizedSection key="none" group={group} light={index % 2 === 1} />
            ),
          )}
        </div>
      </SortableContext>
      <DragOverlay dropAnimation={null}>
        {activeItem ? (
          <div className="w-[260px] rotate-2 opacity-95 shadow-modal">
            <EditCard item={activeItem} overlay />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

function SectionShell({
  group,
  light,
  handle,
  setRef,
  style,
  dragging,
}: {
  group: Group;
  light: boolean;
  handle?: ReactNode;
  setRef?: (el: HTMLElement | null) => void;
  style?: React.CSSProperties;
  dragging?: boolean;
}) {
  const board = useBoard();
  const [renaming, setRenaming] = useState(false);
  const category = group.category;
  const key = category?.ref ?? "non-classe";
  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: `drop:${category?.id ?? NONE}`,
    data: { type: "container", categoryId: category?.id ?? null },
  });

  return (
    <section
      ref={setRef}
      style={style}
      aria-labelledby={`h-${key}`}
      className={cn(
        "relative",
        light ? "section-light py-14 sm:py-[120px]" : "py-6 sm:py-10",
        dragging && "z-10 opacity-60",
      )}
    >
      <div className="mx-auto max-w-[1320px] px-4 sm:px-12">
        <div className="mb-4 flex items-center gap-2 sm:mb-[34px] sm:border-b sm:border-ink/16 sm:pb-4">
          {handle}
          {renaming && category ? (
            <RenameForm category={category} onDone={() => setRenaming(false)} />
          ) : (
            <span id={`h-${key}`} className="min-w-0">
              <SplitTitle
                title={category?.name ?? "Non classé"}
                restColor={light ? "text-ochre-deep" : "text-ochre"}
                className="text-[42px] sm:text-[72px]"
              />
            </span>
          )}
          {category && !renaming ? (
            <button
              type="button"
              aria-label="Renommer la catégorie"
              onClick={() => setRenaming(true)}
              className="flex size-11 shrink-0 items-center justify-center rounded-full text-ink-soft hover:bg-ink/6 hover:text-ink"
            >
              <Pencil aria-hidden="true" size={18} strokeWidth={1.6} />
            </button>
          ) : null}
          <span
            className={cn("ml-auto text-[11px] caps sm:text-[13px]", light ? "text-[#5A4A30]" : "text-muted")}
          >
            <span className="sm:hidden">{group.items.length}</span>
            <span className="hidden sm:inline">{plural(group.items.length, "article", "articles")}</span>
          </span>
          {category ? (
            <button
              type="button"
              onClick={() => {
                board.setAddTarget(category);
                if (window.matchMedia("(min-width: 1024px)").matches)
                  window.scrollTo({ top: 0, behavior: "smooth" });
              }}
              aria-label={`Ajouter ici : ${category.name}`}
              className="inline-flex h-11 shrink-0 items-center gap-2 rounded-full border-line-strong px-3 text-sm font-semibold text-ink sm:border sm:bg-white/45 sm:px-4"
            >
              <Plus aria-hidden="true" size={18} strokeWidth={1.8} />
              <span className="hidden sm:inline">Ajouter ici</span>
            </button>
          ) : null}
        </div>

        <SortableContext items={group.items.map((i) => i.id)} strategy={rectSortingStrategy}>
          <div
            ref={setDropRef}
            className={cn(
              "grid min-h-24 grid-cols-2 gap-x-3.5 gap-y-[22px] rounded-[22px] sm:grid-cols-[repeat(auto-fill,minmax(min(260px,100%),1fr))] sm:gap-x-8 sm:gap-y-12",
              isOver && "bg-ochre/8 outline-2 outline-offset-8 outline-ochre/50 outline-dashed",
            )}
          >
            {group.items.map((item) => (
              <EditCard key={item.id} item={item} />
            ))}
            {group.items.length === 0 ? (
              <p className="col-span-full m-0 self-center text-center text-sm text-muted">
                Glissez des articles ici, ou ajoutez-en.
              </p>
            ) : null}
          </div>
        </SortableContext>
      </div>
    </section>
  );
}

function SortableSection({ group, light }: { group: Group; light: boolean }) {
  const category = group.category!;
  const { setNodeRef, setActivatorNodeRef, attributes, listeners, transform, transition, isDragging } =
    useSortable({
      id: SECTION + category.id,
      data: { type: "section" },
    });
  return (
    <SectionShell
      group={group}
      light={light}
      setRef={setNodeRef}
      dragging={isDragging}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      handle={
        <button
          type="button"
          ref={setActivatorNodeRef}
          {...attributes}
          {...listeners}
          aria-label={`Déplacer la section ${category.name}`}
          aria-roledescription="section déplaçable"
          className="-ml-3 hidden size-11 shrink-0 cursor-grab touch-none items-center justify-center rounded-full text-ink-soft hover:bg-ink/6 active:cursor-grabbing sm:-ml-11 lg:flex"
        >
          <GripVertical aria-hidden="true" size={20} strokeWidth={1.8} />
        </button>
      }
    />
  );
}

function UncategorizedSection({ group, light }: { group: Group; light: boolean }) {
  return <SectionShell group={group} light={light} />;
}

function RenameForm({ category, onDone }: { category: CategoryInfo; onDone: () => void }) {
  const board = useBoard();
  const [name, setName] = useState(category.name);
  const save = async (e?: FormEvent) => {
    e?.preventDefault();
    const value = name.trim();
    if (value && value !== category.name) await board.renameCategory(category.id, value);
    onDone();
  };
  return (
    <form onSubmit={save} className="flex min-w-0 flex-1 items-center gap-2">
      <label htmlFor={`rename-${category.id}`} className="sr-only">
        Renommer la catégorie
      </label>
      <input
        id={`rename-${category.id}`}
        autoFocus
        value={name}
        maxLength={40}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => e.key === "Escape" && onDone()}
        className="min-w-0 flex-1 rounded-field border border-ink bg-white/70 px-4 py-1 font-display text-[34px] leading-tight outline-none focus:shadow-[0_0_0_4px_rgb(167_106_25/0.2)] sm:text-[56px]"
      />
      <button
        type="submit"
        aria-label="Enregistrer"
        className="flex size-11 items-center justify-center rounded-full bg-ink text-linen"
      >
        <Check aria-hidden="true" size={18} strokeWidth={2} />
      </button>
      <button
        type="button"
        aria-label="Annuler"
        onClick={onDone}
        className="flex size-11 items-center justify-center rounded-full"
      >
        <X aria-hidden="true" size={18} strokeWidth={1.8} />
      </button>
    </form>
  );
}
