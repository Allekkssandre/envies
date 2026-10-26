"use client";

import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import * as Popover from "@radix-ui/react-popover";
import { GripVertical, Plus, Trash2 } from "lucide-react";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { sortCategories } from "@/lib/listFilters";
import { tagColorVar } from "@/lib/tagColors";
import { plural } from "@/lib/text";
import { createCategory, createTag, moveCategory, renameCategory } from "@/server/actions/taxonomy";
import {
  deleteCategory,
  deleteTag,
  moveTag,
  restoreCategory,
  restoreTag,
  updateTag,
} from "@/server/actions/settings";
import type { CategoryInfo, TagColor, TagInfo } from "@/types/models";
import { Card, type Track } from "./Card";

const COLORS: { value: TagColor; label: string }[] = [
  { value: "rouille", label: "Rouille" },
  { value: "ocre", label: "Ocre" },
  { value: "miel", label: "Miel" },
  { value: "olive", label: "Olive" },
  { value: "sauge", label: "Sauge" },
  { value: "ardoise", label: "Ardoise" },
  { value: "prune", label: "Prune" },
  { value: "sable", label: "Sable" },
];

type Row = { id: string; name: string; position: string };

/** Nouvel ordre après un glisser-déposer : voisins avant / après dans la liste réordonnée. */
function neighbours<T extends Row>(rows: T[], from: number, to: number) {
  const next = [...rows];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved!);
  return { next, before: next[to - 1] ?? null, after: next[to + 1] ?? null };
}

function useSortableRows<T extends Row>(
  rows: T[],
  onMove: (id: string, before: T | null, after: T | null, next: T[]) => void,
) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const name = (id: string | number) => rows.find((r) => r.id === String(id))?.name ?? "";
  const announcements: Announcements = {
    onDragStart: ({ active }) => `${name(active.id)} saisi.`,
    onDragOver: ({ active, over }) =>
      over ? `${name(active.id)} à la place de ${name(over.id)}.` : `${name(active.id)} déplacé.`,
    onDragEnd: ({ active, over }) => (over ? `${name(active.id)} déposé.` : `${name(active.id)} relâché.`),
    onDragCancel: ({ active }) => `Déplacement de ${name(active.id)} annulé.`,
  };
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const from = rows.findIndex((r) => r.id === active.id);
    const to = rows.findIndex((r) => r.id === over.id);
    if (from < 0 || to < 0) return;
    const { next, before, after } = neighbours(rows, from, to);
    onMove(String(active.id), before, after, next);
  };
  return {
    sensors,
    onDragEnd,
    accessibility: {
      announcements,
      screenReaderInstructions: {
        draggable:
          "Pour déplacer, appuyez sur Espace, utilisez les flèches, puis Espace pour déposer ou Échap pour annuler.",
      },
    },
  };
}

function SortableRow({ id, label, children }: { id: string; label: string; children: ReactNode }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
    useSortable({ id });
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "flex min-h-14 items-center gap-2 border-b border-ink/10 bg-transparent",
        isDragging && "relative z-10 rounded-[14px] bg-paper shadow-[0_20px_40px_-20px_rgb(43_36_22/0.5)]",
      )}
    >
      <button
        type="button"
        ref={setActivatorNodeRef}
        aria-label={`Déplacer : ${label}`}
        className="flex size-11 shrink-0 cursor-grab touch-none items-center justify-center rounded-[12px] text-muted active:cursor-grabbing"
        {...attributes}
        {...listeners}
      >
        <GripVertical aria-hidden="true" size={17} strokeWidth={1.7} />
      </button>
      {children}
    </li>
  );
}

/** Nom modifiable en place : enregistré à la sortie du champ (ou Entrée), Échap annule. */
function InlineName({
  value,
  label,
  maxLength,
  onSave,
}: {
  value: string;
  label: string;
  maxLength: number;
  onSave: (name: string) => Promise<boolean>;
}) {
  const [draft, setDraft] = useState(value);
  const [source, setSource] = useState(value);
  if (value !== source) {
    setSource(value);
    setDraft(value);
  }
  const commit = async () => {
    const name = draft.trim().replace(/\s+/g, " ");
    if (!name || name === value) {
      setDraft(value);
      return;
    }
    if (!(await onSave(name))) setDraft(value);
  };
  return (
    <input
      aria-label={label}
      value={draft}
      maxLength={maxLength}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => void commit()}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
        if (e.key === "Escape") {
          setDraft(value);
          e.currentTarget.blur();
        }
      }}
      className="h-11 min-w-0 flex-1 rounded-[10px] border border-transparent bg-transparent px-2 text-[15px] font-medium text-ink outline-none hover:border-ink/12 focus-visible:border-ink focus-visible:bg-white/70 focus-visible:outline-none"
    />
  );
}

function Count({ n }: { n: number }) {
  return (
    <span className="shrink-0 text-[13px] whitespace-nowrap text-muted">
      {plural(n, "article", "articles")}
    </span>
  );
}

function DeleteButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="flex size-11 shrink-0 items-center justify-center rounded-full text-ink-soft hover:bg-rust/8 hover:text-rust"
    >
      <Trash2 aria-hidden="true" size={17} strokeWidth={1.7} />
    </button>
  );
}

function AddRow({
  placeholder,
  maxLength,
  onAdd,
}: {
  placeholder: string;
  maxLength: number;
  onAdd: (name: string) => Promise<boolean>;
}) {
  const [value, setValue] = useState("");
  const submit = async () => {
    const name = value.trim();
    if (!name) return;
    if (await onAdd(name)) setValue("");
  };
  return (
    <form
      className="mt-3 flex items-center gap-2.5"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <input
        aria-label={placeholder}
        placeholder={placeholder}
        value={value}
        maxLength={maxLength}
        onChange={(e) => setValue(e.target.value)}
        className="h-12 min-w-0 flex-1 rounded-field border border-dashed border-ink/25 bg-white/45 px-4 text-[15px] text-ink outline-none placeholder:text-placeholder focus-visible:border-solid focus-visible:border-ink focus-visible:bg-white/70"
      />
      <Button
        type="submit"
        variant="outline"
        size={44}
        icon={<Plus aria-hidden="true" />}
        className="max-sm:w-11 max-sm:px-0"
      >
        <span className="max-sm:sr-only">Ajouter</span>
      </Button>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Catégories
// ---------------------------------------------------------------------------

export function CategoriesSection({
  listId,
  initial,
  counts: initialCounts,
  uncategorized: initialNone,
  track,
}: {
  listId: string;
  initial: CategoryInfo[];
  counts: Record<string, number>;
  uncategorized: number;
  track: Track;
}) {
  const [rows, setRows] = useState(() => sortCategories(initial));
  const [counts, setCounts] = useState(initialCounts);
  const [none, setNone] = useState(initialNone);

  const dnd = useSortableRows(rows, (id, before, after, next) => {
    const previous = rows;
    setRows(next);
    void track(() =>
      moveCategory({ listId, categoryId: id, beforeId: before?.id ?? null, afterId: after?.id ?? null }),
    ).then((r) => {
      if (!r?.ok) setRows(previous);
      else setRows((cur) => cur.map((c) => (c.id === id ? { ...c, position: r.data.position } : c)));
    });
  });

  const rename = async (id: string, name: string) => {
    const r = await track(() => renameCategory({ listId, categoryId: id, name }));
    if (!r?.ok) {
      if (r) toast(r.error.message, { duration: 4000 });
      return false;
    }
    setRows((cur) => cur.map((c) => (c.id === id ? { ...c, name: r.data.name } : c)));
    return true;
  };

  const add = async (name: string) => {
    const r = await track(() => createCategory({ listId, name }));
    if (!r?.ok) {
      if (r) toast(r.error.message, { duration: 4000 });
      return false;
    }
    if (r.data.existed) toast("Ce nom existe déjà.", { duration: 4000 });
    else setRows((cur) => [...cur, r.data.category]);
    return true;
  };

  const remove = async (category: CategoryInfo) => {
    const previous = { rows, counts, none };
    const moved = counts[category.id] ?? 0;
    setRows((cur) => cur.filter((c) => c.id !== category.id));
    setNone((n) => n + moved);
    const r = await track(() => deleteCategory({ listId, categoryId: category.id }));
    if (!r?.ok) {
      setRows(previous.rows);
      setNone(previous.none);
      return;
    }
    const deleted = r.data;
    toast("Catégorie supprimée", {
      duration: 8000,
      action: {
        label: "Annuler",
        onClick: () => {
          void track(() => restoreCategory({ listId, ...deleted })).then((res) => {
            if (!res?.ok) {
              if (res) toast(res.error.message, { duration: 4000 });
              return;
            }
            setRows((cur) => sortCategories([...cur, { ...deleted.category }]));
            setCounts((c) => ({ ...c, [deleted.category.id]: deleted.itemIds.length }));
            setNone((n) => Math.max(0, n - deleted.itemIds.length));
          });
        },
      },
    });
  };

  return (
    <Card
      id="categories"
      title="Catégories"
      text="Glissez pour changer l'ordre d'affichage. Supprimer une catégorie remet ses articles dans « Non classé »."
    >
      <DndContext
        id="reglages-categories"
        sensors={dnd.sensors}
        collisionDetection={closestCenter}
        onDragEnd={dnd.onDragEnd}
        accessibility={dnd.accessibility}
      >
        <SortableContext items={rows.map((r) => r.id)} strategy={verticalListSortingStrategy}>
          <ul aria-label="Catégories" className="m-0 list-none border-t border-ink/10 p-0">
            {rows.map((c) => (
              <SortableRow key={c.id} id={c.id} label={c.name}>
                <InlineName
                  value={c.name}
                  label={`Nom de la catégorie : ${c.name}`}
                  maxLength={40}
                  onSave={(n) => rename(c.id, n)}
                />
                <Count n={counts[c.id] ?? 0} />
                <DeleteButton label={`Supprimer la catégorie : ${c.name}`} onClick={() => void remove(c)} />
              </SortableRow>
            ))}
            <li className="flex min-h-14 items-center gap-2 border-b border-ink/10 pl-[52px]">
              <span className="flex-1 px-2 text-[15px] text-ink-soft italic">Non classé</span>
              <Count n={none} />
              <span className="size-11 shrink-0" />
            </li>
          </ul>
        </SortableContext>
      </DndContext>
      <AddRow placeholder="Nouvelle catégorie" maxLength={40} onAdd={add} />
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Tags
// ---------------------------------------------------------------------------

function ColorPicker({ tag, onPick }: { tag: TagInfo; onPick: (c: TagColor) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger
        aria-label={`Couleur du tag : ${tag.name}`}
        className="flex size-11 shrink-0 items-center justify-center rounded-full hover:bg-ink/6"
      >
        <span
          aria-hidden="true"
          className="size-[18px] rounded-full shadow-[inset_0_0_0_1px_rgb(43_36_22/0.15)]"
          style={{ background: tagColorVar[tag.color] }}
        />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={6}
          className="z-50 rounded-[18px] border border-white/60 bg-paper p-2.5 shadow-[0_30px_60px_-24px_rgb(43_36_22/0.5)]"
        >
          <div role="radiogroup" aria-label="Couleur du tag" className="grid grid-cols-4 gap-2">
            {COLORS.map((c) => (
              <button
                key={c.value}
                type="button"
                role="radio"
                aria-checked={tag.color === c.value}
                aria-label={c.label}
                onClick={() => {
                  onPick(c.value);
                  setOpen(false);
                }}
                className={cn(
                  "flex size-11 items-center justify-center rounded-full",
                  tag.color === c.value && "ring-2 ring-ink ring-offset-2 ring-offset-paper",
                )}
              >
                <span
                  aria-hidden="true"
                  className="size-8 rounded-full"
                  style={{ background: tagColorVar[c.value] }}
                />
              </button>
            ))}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

export function TagsSection({
  listId,
  initial,
  counts: initialCounts,
  track,
}: {
  listId: string;
  initial: TagInfo[];
  counts: Record<string, number>;
  track: Track;
}) {
  const [rows, setRows] = useState(initial);
  const [counts, setCounts] = useState(initialCounts);

  const dnd = useSortableRows(rows, (id, before, after, next) => {
    const previous = rows;
    setRows(next);
    void track(() =>
      moveTag({ listId, tagId: id, beforeId: before?.id ?? null, afterId: after?.id ?? null }),
    ).then((r) => {
      if (!r?.ok) setRows(previous);
    });
  });

  const update = async (tag: TagInfo, patch: { name?: string; color?: TagColor }) => {
    const previous = rows;
    setRows((cur) => cur.map((t) => (t.id === tag.id ? { ...t, ...patch } : t)));
    const r = await track(() => updateTag({ listId, tagId: tag.id, ...patch }));
    if (!r?.ok) {
      setRows(previous);
      if (r) toast(r.error.message, { duration: 4000 });
      return false;
    }
    return true;
  };

  const add = async (name: string) => {
    const r = await track(() => createTag({ listId, name }));
    if (!r?.ok) {
      if (r) toast(r.error.message, { duration: 4000 });
      return false;
    }
    if (r.data.existed) toast("Ce nom existe déjà.", { duration: 4000 });
    else setRows((cur) => [...cur, r.data.tag]);
    return true;
  };

  const remove = async (tag: TagInfo) => {
    const previous = rows;
    setRows((cur) => cur.filter((t) => t.id !== tag.id));
    const r = await track(() => deleteTag({ listId, tagId: tag.id }));
    if (!r?.ok) {
      setRows(previous);
      return;
    }
    const deleted = r.data;
    toast("Tag supprimé", {
      duration: 8000,
      action: {
        label: "Annuler",
        onClick: () => {
          void track(() => restoreTag({ listId, ...deleted })).then((res) => {
            if (!res?.ok) {
              if (res) toast(res.error.message, { duration: 4000 });
              return;
            }
            setRows((cur) => [...cur, { ...tag }].sort((a, b) => (a.position < b.position ? -1 : 1)));
            setCounts((c) => ({ ...c, [tag.id]: deleted.itemIds.length }));
          });
        },
      },
    });
  };

  return (
    <Card
      id="tags"
      title="Tags"
      text="Priorité, avis, taille, ce que vous voulez. La couleur sert de repère sur les cartes."
    >
      <DndContext
        id="reglages-tags"
        sensors={dnd.sensors}
        collisionDetection={closestCenter}
        onDragEnd={dnd.onDragEnd}
        accessibility={dnd.accessibility}
      >
        <SortableContext items={rows.map((r) => r.id)} strategy={verticalListSortingStrategy}>
          <ul aria-label="Tags" className="m-0 list-none border-t border-ink/10 p-0">
            {rows.map((t) => (
              <SortableRow key={t.id} id={t.id} label={t.name}>
                <ColorPicker tag={t} onPick={(color) => void update(t, { color })} />
                <InlineName
                  value={t.name}
                  label={`Nom du tag : ${t.name}`}
                  maxLength={30}
                  onSave={(name) => update(t, { name })}
                />
                <Count n={counts[t.id] ?? 0} />
                <DeleteButton label={`Supprimer le tag : ${t.name}`} onClick={() => void remove(t)} />
              </SortableRow>
            ))}
          </ul>
        </SortableContext>
      </DndContext>
      <AddRow placeholder="Nouveau tag : avis, priorité, taille…" maxLength={30} onAdd={add} />
    </Card>
  );
}
