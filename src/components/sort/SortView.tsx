"use client";

import { ArrowLeft, ArrowRight, Heart, Pencil, Plus, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { ItemPhoto } from "@/components/ui/ItemPhoto";
import { Kbd, KeyChip } from "@/components/ui/Kbd";
import { DESKTOP_QUERY, useMediaQuery } from "@/hooks/useMediaQuery";
import { cn } from "@/lib/cn";
import { formatPrice } from "@/lib/format";
import { imageUrl } from "@/lib/imageUrl";
import { parseManualPrice, priceToInput } from "@/lib/price";
import { formatRelative } from "@/lib/relativeDate";
import {
  breadcrumbLabel,
  categoryIndex,
  isTyping,
  keyLabel,
  TAG_CODES,
  tagIndex,
  tagLegend,
  type LayoutMap,
} from "@/lib/sortKeys";
import { tagColorVar } from "@/lib/tagColors";
import { plural } from "@/lib/text";
import { deleteItems, restoreItems, sortItem } from "@/server/actions/items";
import { createCategory } from "@/server/actions/taxonomy";
import { itemName, type CategoryInfo, type ItemInfo, type ListInfo, type TagInfo } from "@/types/models";

// Tri rapide (docs/03-ecrans.md) : un article à la fois. Desktop au clavier, mobile au doigt.

type Draft = {
  categoryId: string | null;
  tagIds: string[];
  isFavorite: boolean;
  title: string;
  price: string;
};

type Props = { list: ListInfo; items: ItemInfo[]; categories: CategoryInfo[]; tags: TagInfo[] };

const NETWORK_ERROR = "Pas enregistré. Vérifiez la connexion.";
const PRICE_ERROR = "Ce prix n'est pas lu.";
const MAX_CATEGORY_KEYS = 9;
const SWIPE_RATIO = 0.3;
const SWIPE_SPEED = 0.6; // px/ms

function initialDraft(item: ItemInfo, categories: CategoryInfo[]): Draft {
  const suggested = categories.some((c) => c.id === item.suggestedCategoryId)
    ? item.suggestedCategoryId
    : null;
  return {
    categoryId: item.categoryId ?? suggested,
    tagIds: item.tagIds,
    isFavorite: item.isFavorite,
    title: item.title ?? "",
    price: priceToInput(item.priceCents),
  };
}

/** Disposition réelle du clavier (Chrome, Edge) et langue du navigateur, lues après le montage. */
function useKeyboardLayout() {
  const [layout, setLayout] = useState<{ map: LayoutMap | null; language: string }>({
    map: null,
    language: "fr",
  });
  useEffect(() => {
    const language = navigator.language || "fr";
    const keyboard = (navigator as Navigator & { keyboard?: { getLayoutMap?: () => Promise<LayoutMap> } })
      .keyboard;
    let cancelled = false;
    if (keyboard?.getLayoutMap) {
      keyboard
        .getLayoutMap()
        .then((map) => !cancelled && setLayout({ map, language }))
        .catch(() => !cancelled && setLayout({ map: null, language }));
    } else {
      // Lecture de la langue après le montage (le serveur ne la connaît pas).
      queueMicrotask(() => !cancelled && setLayout({ map: null, language }));
    }
    return () => {
      cancelled = true;
    };
  }, []);
  return layout;
}

export function SortView({ list, items, categories: initialCategories, tags }: Props) {
  const router = useRouter();
  const isDesktop = useMediaQuery(DESKTOP_QUERY);
  const editHref = `/l/${list.slug}/edition`;
  const [queue, setQueue] = useState(items);
  const [index, setIndex] = useState(0);
  const [categories, setCategories] = useState(initialCategories);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [leaving, setLeaving] = useState<{ item: ItemInfo; draft: Draft; kind: "validate" | "skip" } | null>(
    null,
  );
  const [creating, setCreating] = useState(false);
  const [priceError, setPriceError] = useState<string | null>(null);
  const sortedCount = useRef(0);
  const done = useRef(false);
  const { map, language } = useKeyboardLayout();

  const current = queue[index] ?? null;
  const draft = current ? (drafts[current.id] ?? initialDraft(current, categories)) : null;

  const finish = useCallback(() => {
    if (done.current) return;
    done.current = true;
    const n = sortedCount.current;
    if (n > 0) toast(plural(n, "article rangé", "articles rangés"), { duration: 4000 });
    router.push(editHref, { scroll: false });
  }, [editHref, router]);

  // Rien à trier en arrivant : message et retour.
  useEffect(() => {
    if (items.length > 0 || done.current) return;
    done.current = true;
    toast("Rien à trier.", { duration: 4000 });
    router.replace(editHref);
  }, [items.length, editHref, router]);

  const setDraft = useCallback(
    (patch: Partial<Draft>) => {
      if (!current) return;
      setDrafts((all) => ({
        ...all,
        [current.id]: { ...(all[current.id] ?? initialDraft(current, categories)), ...patch },
      }));
    },
    [current, categories],
  );

  const advance = useCallback(
    (kind: "validate" | "skip") => {
      if (!current || !draft) return;
      setLeaving({ item: current, draft, kind });
      setPriceError(null);
      setCreating(false);
      if (index + 1 >= queue.length) {
        window.setTimeout(finish, 240);
      } else {
        setIndex(index + 1);
      }
      window.setTimeout(() => setLeaving((l) => (l?.item.id === current.id ? null : l)), 260);
    },
    [current, draft, index, queue.length, finish],
  );

  const validate = useCallback(() => {
    if (!current || !draft) return;
    const priceText = draft.price.trim();
    const priceCents = priceText === "" ? null : parseManualPrice(priceText);
    if (priceText !== "" && priceCents === null) {
      setPriceError(PRICE_ERROR);
      return;
    }
    const item = current;
    const payload = {
      itemId: item.id,
      categoryId: draft.categoryId,
      tagIds: draft.tagIds,
      isFavorite: draft.isFavorite,
      ...(draft.title.trim() && draft.title.trim() !== (item.title ?? "") ? { title: draft.title } : {}),
      ...(priceCents !== item.priceCents ? { priceCents } : {}),
    };
    sortedCount.current += 1;
    advance("validate");
    sortItem(payload)
      .then((r) => {
        if (!r.ok) {
          sortedCount.current -= 1;
          toast(r.error.message, { duration: 4000 });
        }
      })
      .catch(() => {
        sortedCount.current -= 1;
        toast(NETWORK_ERROR, { duration: 8000 });
      });
  }, [current, draft, advance]);

  const skip = useCallback(() => advance("skip"), [advance]);

  const previous = useCallback(() => {
    if (index === 0) return;
    setPriceError(null);
    setCreating(false);
    setIndex(index - 1);
  }, [index]);

  const remove = useCallback(() => {
    if (!current) return;
    const item = current;
    const at = index;
    setQueue((q) => q.filter((i) => i.id !== item.id));
    if (queue.length === 1) window.setTimeout(finish, 0);
    else if (at >= queue.length - 1) setIndex(Math.max(0, at - 1));
    deleteItems({ itemIds: [item.id] })
      .then((r) => {
        if (!r.ok) {
          toast(r.error.message, { duration: 4000 });
          return;
        }
        toast("Article supprimé", {
          duration: 8000,
          action: {
            label: "Annuler",
            onClick: () => {
              void restoreItems({ itemIds: [item.id] }).then((res) => {
                if (!res.ok) {
                  toast(res.error.message, { duration: 4000 });
                  return;
                }
                if (done.current) return;
                setQueue((q) => [...q.slice(0, at), item, ...q.slice(at)]);
                setIndex(at);
              });
            },
          },
        });
      })
      .catch(() => toast(NETWORK_ERROR, { duration: 8000 }));
  }, [current, index, queue.length, finish]);

  const quit = useCallback(() => finish(), [finish]);

  const toggleCategory = useCallback(
    (id: string) => draft && setDraft({ categoryId: draft.categoryId === id ? null : id }),
    [draft, setDraft],
  );
  const toggleTag = useCallback(
    (id: string) =>
      draft &&
      setDraft({
        tagIds: draft.tagIds.includes(id) ? draft.tagIds.filter((t) => t !== id) : [...draft.tagIds, id],
      }),
    [draft, setDraft],
  );
  const toggleHeart = useCallback(
    () => draft && setDraft({ isFavorite: !draft.isFavorite }),
    [draft, setDraft],
  );

  const addCategory = useCallback(
    async (name: string) => {
      const clean = name.trim();
      if (!clean) {
        setCreating(false);
        return;
      }
      try {
        const r = await createCategory({ listId: list.id, name: clean });
        if (!r.ok) {
          toast(r.error.message, { duration: 4000 });
          return;
        }
        if (!r.data.existed) setCategories((c) => [...c, r.data.category]);
        setDraft({ categoryId: r.data.category.id });
        setCreating(false);
      } catch {
        toast(NETWORK_ERROR, { duration: 8000 });
      }
    },
    [list.id, setDraft],
  );

  // Raccourcis (position physique des touches), inactifs pendant la saisie.
  const handlers = useRef({ validate, skip, previous, remove, quit, toggleCategory, toggleTag, toggleHeart });
  useLayoutEffect(() => {
    handlers.current = { validate, skip, previous, remove, quit, toggleCategory, toggleTag, toggleHeart };
  });
  const categoryIds = useRef<string[]>([]);
  const tagIds = useRef<string[]>([]);
  useLayoutEffect(() => {
    categoryIds.current = categories.slice(0, MAX_CATEGORY_KEYS).map((c) => c.id);
    tagIds.current = tags.slice(0, TAG_CODES.length).map((t) => t.id);
  }, [categories, tags]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
      if (isTyping(e.target)) {
        if (e.key === "Escape") (e.target as HTMLElement).blur();
        return;
      }
      // Entrée ou Espace sur un bouton : le bouton s'en charge.
      const onControl = e.target instanceof HTMLElement && e.target.closest("button, a");
      const h = handlers.current;
      const run = (fn: () => void) => {
        e.preventDefault();
        fn();
      };
      if (e.code === "Enter" || e.code === "NumpadEnter") {
        if (!onControl) run(h.validate);
        return;
      }
      if (e.code === "ArrowRight") return run(h.skip);
      if (e.code === "ArrowLeft") return run(h.previous);
      if (e.code === "Delete") return run(h.remove);
      if (e.code === "Escape") return run(h.quit);
      if (e.code === "KeyC") return run(h.toggleHeart);
      if (e.code === "KeyN") return run(() => setCreating(true));
      const ci = categoryIndex(e.code);
      if (ci !== null && categoryIds.current[ci])
        return run(() => h.toggleCategory(categoryIds.current[ci]!));
      const ti = tagIndex(e.code);
      if (ti !== null && tagIds.current[ti]) return run(() => h.toggleTag(tagIds.current[ti]!));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const labels = useMemo(
    () => ({
      tags: TAG_CODES.map((code) => keyLabel(code, map, language)),
      legend: tagLegend(tags.length, map, language),
      heart: keyLabel("KeyC", map, language),
      newCategory: keyLabel("KeyN", map, language),
    }),
    [map, language, tags.length],
  );

  if (!current || !draft || isDesktop === null) {
    return <div className="fixed inset-0 z-40 tex-feuillage" aria-hidden="true" />;
  }

  const progress = { index, total: queue.length };
  const shared = {
    list,
    item: current,
    draft,
    categories,
    tags,
    labels,
    creating,
    priceError,
    progress,
    leaving,
    onDraft: (patch: Partial<Draft>) => {
      if (patch.price !== undefined) setPriceError(null);
      setDraft(patch);
    },
    onCategory: toggleCategory,
    onTag: toggleTag,
    onHeart: toggleHeart,
    onCreate: (open: boolean) => setCreating(open),
    onAddCategory: (name: string) => void addCategory(name),
    onValidate: validate,
    onSkip: skip,
    editHref,
    onQuit: quit,
  };
  return isDesktop ? <DesktopSort {...shared} /> : <MobileSort {...shared} />;
}

type ViewProps = {
  list: ListInfo;
  item: ItemInfo;
  draft: Draft;
  categories: CategoryInfo[];
  tags: TagInfo[];
  labels: { tags: string[]; legend: string; heart: string; newCategory: string };
  creating: boolean;
  priceError: string | null;
  progress: { index: number; total: number };
  leaving: { item: ItemInfo; draft: Draft; kind: "validate" | "skip" } | null;
  onDraft: (patch: Partial<Draft>) => void;
  onCategory: (id: string) => void;
  onTag: (id: string) => void;
  onHeart: () => void;
  onCreate: (open: boolean) => void;
  onAddCategory: (name: string) => void;
  onValidate: () => void;
  onSkip: () => void;
  editHref: string;
  onQuit: () => void;
};

// ---------------------------------------------------------------------------
// Éléments communs
// ---------------------------------------------------------------------------

function Progress({ index, total, width }: { index: number; total: number; width: string }) {
  const segments = total <= 24;
  return (
    <div className="flex items-center gap-3 text-linen">
      <b className="text-sm whitespace-nowrap">
        {index + 1} sur {total}
      </b>
      <div
        role="progressbar"
        aria-label="Progression du tri"
        aria-valuemin={1}
        aria-valuenow={index + 1}
        aria-valuemax={total}
        className={cn("flex gap-1", width)}
      >
        {segments ? (
          Array.from({ length: total }, (_, i) => (
            <span
              key={i}
              className={cn(
                "h-[5px] flex-1 rounded-[3px]",
                i < index ? "bg-olive" : i === index ? "bg-honey-deep" : "bg-linen/25",
              )}
            />
          ))
        ) : (
          <span className="relative h-[5px] flex-1 overflow-hidden rounded-[3px] bg-linen/25">
            <span
              className="absolute inset-y-0 left-0 bg-olive"
              style={{ width: `${(index / total) * 100}%` }}
            />
          </span>
        )}
      </div>
    </div>
  );
}

function Backdrop({ mobile = false }: { mobile?: boolean }) {
  return (
    <>
      <div aria-hidden="true" className="absolute inset-0 tex-feuillage" />
      <div
        aria-hidden="true"
        className={cn(
          "absolute inset-0",
          mobile
            ? "bg-[rgb(14_16_6/0.35)]"
            : "bg-[radial-gradient(70%_60%_at_50%_52%,rgb(14_16_6/0.25),rgb(14_16_6/0.6))]",
        )}
      />
      <div aria-hidden="true" className="absolute inset-0 grain-overlay opacity-45 mix-blend-overlay" />
    </>
  );
}

function Suggestion({ item, draft }: { item: ItemInfo; draft: Draft }) {
  if (!item.suggestedCategoryId || draft.categoryId !== item.suggestedCategoryId) return null;
  const crumbs = breadcrumbLabel(item.breadcrumb);
  if (!crumbs) return null;
  return (
    <span className="inline-flex h-6 items-center rounded-full bg-olive/14 px-2.5 text-xs font-semibold text-olive-deep">
      proposée d&apos;après la page : {crumbs}
    </span>
  );
}

function NewCategoryField({
  onAdd,
  onCancel,
  className,
}: {
  onAdd: (name: string) => void;
  onCancel: () => void;
  className?: string;
}) {
  const [value, setValue] = useState("");
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border border-ink bg-white/80 pr-1 pl-4",
        className,
      )}
    >
      <label htmlFor="sort-new-category" className="sr-only">
        Nouvelle catégorie
      </label>
      <input
        id="sort-new-category"
        autoFocus
        maxLength={40}
        value={value}
        placeholder="Nom de la catégorie"
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            onAdd(value);
          } else if (e.key === "Escape") {
            e.preventDefault();
            e.stopPropagation();
            onCancel();
          }
        }}
        className="h-full w-44 min-w-0 border-0 bg-transparent text-[15px] text-ink outline-none focus-visible:outline-none"
      />
      <button
        type="button"
        aria-label="Créer la catégorie"
        onClick={() => onAdd(value)}
        className="flex size-9 items-center justify-center rounded-full bg-ink text-linen"
      >
        <Plus aria-hidden="true" size={16} strokeWidth={2} />
      </button>
    </span>
  );
}

function meta(item: ItemInfo): string {
  return [item.domain, `ajouté ${formatRelative(new Date(item.createdAt))}`].filter(Boolean).join("  ·  ");
}

// ---------------------------------------------------------------------------
// Desktop
// ---------------------------------------------------------------------------

function DesktopSort(props: ViewProps) {
  const { list, progress, leaving } = props;
  return (
    <div className="fixed inset-0 z-40 flex flex-col overflow-y-auto bg-[#2A3014] text-ink">
      <Backdrop />
      <header className="relative flex h-[100px] shrink-0 items-center justify-between gap-6 px-12 text-linen">
        <div className="flex min-w-0 items-baseline gap-3.5">
          <h1 className="m-0 font-display-72 text-[34px] font-light italic">Tri rapide</h1>
          <span className="truncate text-xs caps text-honey">{list.title} · à trier</span>
        </div>
        <Progress index={progress.index} total={progress.total} width="w-[220px]" />
        <Button variant="glass" size={44} onClick={props.onQuit} className="px-4 text-sm">
          Quitter
        </Button>
      </header>
      <main className="relative flex flex-1 items-center justify-center px-12 py-4">
        <div className="relative w-full max-w-[1080px]">
          <div
            aria-hidden="true"
            className="absolute inset-0 translate-x-9 translate-y-[26px] scale-96 rounded-[34px] bg-paper/35 shadow-[0_40px_80px_-40px_rgb(0_0_0/0.6)]"
          />
          <div
            aria-hidden="true"
            className="absolute inset-0 translate-x-[18px] translate-y-[13px] scale-98 rounded-[34px] bg-paper/60"
          />
          <DesktopCard key={props.item.id} {...props} className="animate-sort-enter" />
          {leaving ? (
            <div
              aria-hidden="true"
              inert
              className={cn(
                "sort-leaving pointer-events-none absolute inset-0",
                leaving.kind === "validate" ? "animate-sort-validate" : "animate-sort-skip",
              )}
            >
              <DesktopCard
                {...props}
                item={leaving.item}
                draft={leaving.draft}
                creating={false}
                priceError={null}
                still
              />
            </div>
          ) : null}
        </div>
      </main>
      <footer className="relative flex shrink-0 justify-center px-12 pt-2 pb-8">
        <Legend {...props} />
      </footer>
    </div>
  );
}

function DesktopCard(props: ViewProps & { className?: string; still?: boolean }) {
  const { item, draft, categories, tags, labels, list, still } = props;
  const currency = item.currency ?? list.currency;
  const name = itemName({ title: draft.title || null, domain: item.domain });
  return (
    <article
      aria-label={still ? undefined : name}
      className={cn(
        "relative grid grid-cols-[minmax(0,440px)_minmax(0,1fr)] gap-11 overflow-hidden rounded-[34px] bg-paper py-7 pr-11 pl-7",
        "shadow-[inset_0_1px_0_rgb(255_255_255/0.8),0_60px_120px_-40px_rgb(5_6_1/0.85)]",
        props.className,
      )}
    >
      <span aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-50 grain-fine" />
      <ItemPhoto
        name={name}
        src480={item.imagePath ? imageUrl(item.imagePath, 480) : null}
        src1200={item.imagePath ? imageUrl(item.imagePath, 1200) : null}
        lightBackground={item.lightBackground}
        sizes="440px"
        initialSize={130}
        className="h-[500px] rounded-[24px]"
      />
      <div className="relative flex min-w-0 flex-col gap-[18px] pt-2">
        <p className="m-0 text-[13px] whitespace-pre text-muted">{meta(item)}</p>
        <div className="flex flex-col gap-2">
          <div className="flex items-start gap-2.5">
            <textarea
              aria-label="Nom"
              rows={2}
              value={draft.title}
              maxLength={200}
              placeholder={item.domain ?? "Nom"}
              onChange={(e) => props.onDraft({ title: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  e.currentTarget.blur();
                }
              }}
              className="h-[86px] min-w-0 flex-1 resize-none border-0 border-b border-dashed border-ink/30 bg-transparent pb-1.5 font-display-72 text-[36px] leading-[1.1] text-ink outline-none focus-visible:border-ink focus-visible:outline-none"
            />
            <Pencil aria-hidden="true" size={18} strokeWidth={1.7} className="mt-2.5 shrink-0 text-muted" />
          </div>
          <div className="flex items-baseline gap-2">
            <input
              aria-label="Prix"
              inputMode="decimal"
              value={draft.price}
              placeholder="prix inconnu"
              onChange={(e) => props.onDraft({ price: e.target.value })}
              aria-invalid={props.priceError ? true : undefined}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  e.currentTarget.blur();
                }
              }}
              style={{ width: draft.price ? `${Math.max(2, draft.price.length + 0.5)}ch` : "7em" }}
              className="min-w-0 border-0 border-b border-dashed border-transparent bg-transparent font-display text-[40px] leading-none text-ink outline-none placeholder:text-xl placeholder:text-muted hover:border-ink/30 focus-visible:border-ink focus-visible:outline-none"
            />
            {draft.price.trim() ? (
              <span className="font-display text-[40px] leading-none">{currencySymbol(currency)}</span>
            ) : null}
          </div>
          {props.priceError ? (
            <p className="m-0 text-[13px] font-semibold text-rust">{props.priceError}</p>
          ) : null}
        </div>

        <div className="flex flex-col gap-2.5">
          <div className="flex flex-wrap items-center gap-2.5">
            <span id={still ? undefined : "sort-category"} className="text-xs caps text-muted">
              Catégorie
            </span>
            <Suggestion item={item} draft={draft} />
          </div>
          <div
            role="group"
            aria-labelledby={still ? undefined : "sort-category"}
            className="flex flex-wrap gap-2"
          >
            {categories.map((c, i) => (
              <KeyChip
                key={c.id}
                keyLabel={i < MAX_CATEGORY_KEYS ? String(i + 1) : ""}
                pressed={draft.categoryId === c.id}
                onClick={() => props.onCategory(c.id)}
              >
                {c.name}
              </KeyChip>
            ))}
            {props.creating && !still ? (
              <NewCategoryField
                onAdd={props.onAddCategory}
                onCancel={() => props.onCreate(false)}
                className="h-[46px]"
              />
            ) : (
              <KeyChip keyLabel={labels.newCategory} onClick={() => props.onCreate(true)}>
                Nouvelle catégorie…
              </KeyChip>
            )}
          </div>
        </div>

        {tags.length ? (
          <div className="flex flex-col gap-2.5">
            <span id={still ? undefined : "sort-tags"} className="text-xs caps text-muted">
              Tags
            </span>
            <div
              role="group"
              aria-labelledby={still ? undefined : "sort-tags"}
              className="flex flex-wrap gap-2"
            >
              {tags.map((t, i) => (
                <KeyChip
                  key={t.id}
                  keyLabel={labels.tags[i] ?? ""}
                  pressed={draft.tagIds.includes(t.id)}
                  tone={tagColorVar[t.color]}
                  dot={tagColorVar[t.color]}
                  onClick={() => props.onTag(t.id)}
                >
                  {t.name}
                </KeyChip>
              ))}
            </div>
          </div>
        ) : null}

        <div className="mt-auto flex items-center gap-2.5 pt-2">
          <KeyChip
            keyLabel={labels.heart}
            pressed={draft.isFavorite}
            tone="var(--color-rust)"
            onClick={props.onHeart}
          >
            Coup de cœur
          </KeyChip>
          <span className="flex-1" />
          <Button
            variant="outline"
            size={52}
            onClick={props.onSkip}
            iconRight={<ArrowRight aria-hidden="true" />}
          >
            Passer
          </Button>
          <Button variant="ink" size={52} onClick={props.onValidate} className="px-[22px]">
            Valider et suivant
          </Button>
        </div>
      </div>
    </article>
  );
}

function Legend({ categories, tags, labels }: ViewProps) {
  const n = Math.min(categories.length, MAX_CATEGORY_KEYS);
  const entries: [ReactNode, string][] = [
    ["←", "précédent"],
    ["→", "passer"],
    ["Entrée", "valider et suivant"],
  ];
  if (n > 0) entries.push([n === 1 ? "1" : `1–${n}`, "catégorie"]);
  if (tags.length) entries.push([labels.legend, "tags"]);
  entries.push([labels.heart, "coup de cœur"], ["Suppr", "supprimer"], ["Échap", "quitter"]);
  return (
    <div
      aria-label="Raccourcis clavier"
      role="note"
      className="flex flex-wrap justify-center gap-x-6 gap-y-2.5 rounded-full border border-linen/32 bg-linen/14 px-6 py-3 text-[13px] text-linen shadow-[inset_0_1px_0_rgb(255_255_255/0.25),0_30px_60px_-30px_rgb(0_0_0/0.6)] backdrop-blur-[20px] backdrop-saturate-[1.2]"
    >
      {entries.map(([key, label]) => (
        <span key={label} className="inline-flex items-center gap-[7px]">
          <Kbd tone="dark" className="tracking-[0.12em]">
            {key}
          </Kbd>
          {label}
        </span>
      ))}
    </div>
  );
}

const currencySymbol = (currency: string) =>
  new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: /^[A-Z]{3}$/.test(currency) ? currency : "EUR",
  })
    .formatToParts(0)
    .find((p) => p.type === "currency")?.value ?? currency;

// ---------------------------------------------------------------------------
// Mobile
// ---------------------------------------------------------------------------

function MobileSort(props: ViewProps) {
  const { draft, categories, tags, progress, leaving } = props;
  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-[#2A3014] text-ink">
      <Backdrop mobile />
      <header className="relative flex h-14 shrink-0 items-center gap-4 px-3 pt-2">
        <Link
          href={props.editHref}
          aria-label="Quitter le tri"
          onClick={(e) => {
            e.preventDefault();
            props.onQuit();
          }}
          className="flex size-11 shrink-0 items-center justify-center rounded-full border border-linen/40 bg-linen/12 text-linen backdrop-blur-[14px]"
        >
          <X aria-hidden="true" size={19} strokeWidth={1.7} />
        </Link>
        <Progress index={progress.index} total={progress.total} width="w-[150px]" />
      </header>

      <main className="relative flex min-h-0 flex-1 flex-col">
        <div className="relative mt-2 h-[300px] shrink-0">
          <div
            aria-hidden="true"
            className="absolute inset-x-[30px] top-[22px] h-[270px] rounded-[26px] bg-paper/40"
          />
          <SwipeCard key={props.item.id} {...props} />
          {leaving ? (
            <div
              aria-hidden="true"
              inert
              className={cn(
                "sort-leaving pointer-events-none absolute inset-0",
                leaving.kind === "validate" ? "animate-sort-validate" : "animate-sort-skip",
              )}
            >
              <MobileCardBody {...props} item={leaving.item} draft={leaving.draft} />
            </div>
          ) : null}
        </div>

        <section className="relative mt-auto flex min-h-0 flex-1 flex-col rounded-t-sheet bg-paper">
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 rounded-t-sheet opacity-50 grain-fine"
          />
          <div className="relative flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 pt-[22px] pb-4">
            <div className="flex flex-col gap-2.5">
              <div className="flex flex-wrap items-center gap-2">
                <span id="sort-category-m" className="text-xs caps text-muted">
                  Ranger dans
                </span>
                <Suggestion item={props.item} draft={draft} />
              </div>
              <div role="group" aria-labelledby="sort-category-m" className="flex flex-wrap gap-2">
                {categories.map((c) => (
                  <Chip
                    key={c.id}
                    pressed={draft.categoryId === c.id}
                    onClick={() => props.onCategory(c.id)}
                    className="h-11"
                  >
                    {c.name}
                  </Chip>
                ))}
                {props.creating ? (
                  <NewCategoryField
                    onAdd={props.onAddCategory}
                    onCancel={() => props.onCreate(false)}
                    className="h-11"
                  />
                ) : (
                  <Chip
                    icon={<Plus aria-hidden="true" size={15} strokeWidth={2} />}
                    onClick={() => props.onCreate(true)}
                    className="h-11"
                  >
                    Nouvelle
                  </Chip>
                )}
              </div>
            </div>
            {tags.length ? (
              <div className="flex flex-col gap-2.5">
                <span id="sort-tags-m" className="text-xs caps text-muted">
                  Tags
                </span>
                <div role="group" aria-labelledby="sort-tags-m" className="flex flex-wrap gap-2">
                  {tags.map((t) => (
                    <Chip
                      key={t.id}
                      pressed={draft.tagIds.includes(t.id)}
                      tone={tagColorVar[t.color]}
                      dot={tagColorVar[t.color]}
                      onClick={() => props.onTag(t.id)}
                      className="h-11"
                    >
                      {t.name}
                    </Chip>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
          <div className="relative flex shrink-0 gap-2 px-4 pt-3 pb-[max(26px,env(safe-area-inset-bottom))]">
            <button
              type="button"
              aria-label="Coup de cœur"
              aria-pressed={draft.isFavorite}
              onClick={props.onHeart}
              className={cn(
                "flex size-14 shrink-0 items-center justify-center rounded-full border border-rust/35",
                draft.isFavorite ? "bg-rust text-linen" : "bg-rust/6 text-rust",
              )}
            >
              <Heart
                aria-hidden="true"
                size={22}
                strokeWidth={1.8}
                className={draft.isFavorite ? "fill-current" : undefined}
              />
            </button>
            <Button variant="outline" size={56} onClick={props.onSkip}>
              Passer
            </Button>
            <Button
              variant="ink"
              size={56}
              onClick={props.onValidate}
              className="flex-1"
              iconRight={<ArrowRight aria-hidden="true" />}
            >
              Valider
            </Button>
          </div>
        </section>
      </main>
    </div>
  );
}

/** Carte glissable : à gauche = passer, à droite = valider (30 % de la largeur, ou geste rapide). */
function SwipeCard(props: ViewProps) {
  const [dx, setDx] = useState(0);
  const start = useRef<{ x: number; y: number; t: number; width: number; id: number } | null>(null);
  const [dragging, setDragging] = useState(false);

  return (
    <div
      className="absolute inset-0 animate-sort-enter touch-pan-y"
      style={{
        transform: dx ? `translateX(${dx}px) rotate(${dx / 24}deg)` : undefined,
        transition: dragging ? "none" : "transform 200ms var(--ease-panel)",
      }}
      onPointerDown={(e) => {
        if (e.pointerType === "mouse" && e.button !== 0) return;
        start.current = {
          x: e.clientX,
          y: e.clientY,
          t: performance.now(),
          width: e.currentTarget.offsetWidth,
          id: e.pointerId,
        };
      }}
      onPointerMove={(e) => {
        const s = start.current;
        if (!s || s.id !== e.pointerId) return;
        const moveX = e.clientX - s.x;
        if (!dragging && Math.abs(moveX) > 8 && Math.abs(moveX) > Math.abs(e.clientY - s.y)) {
          setDragging(true);
          e.currentTarget.setPointerCapture(e.pointerId);
        }
        if (dragging) setDx(moveX);
      }}
      onPointerUp={(e) => {
        const s = start.current;
        start.current = null;
        if (!s || !dragging) return;
        setDragging(false);
        const moveX = e.clientX - s.x;
        const speed = Math.abs(moveX) / Math.max(1, performance.now() - s.t);
        if (Math.abs(moveX) > s.width * SWIPE_RATIO || speed > SWIPE_SPEED) {
          setDx(0);
          if (moveX < 0) props.onSkip();
          else props.onValidate();
        } else {
          setDx(0);
        }
      }}
      onPointerCancel={() => {
        start.current = null;
        setDragging(false);
        setDx(0);
      }}
    >
      <MobileCardBody {...props} />
    </div>
  );
}

function MobileCardBody({ item, draft, list }: ViewProps) {
  const name = itemName({ title: draft.title || null, domain: item.domain });
  const price = draft.price.trim() ? parseManualPrice(draft.price) : null;
  return (
    <article
      aria-label={name}
      className="absolute inset-x-4 top-0 flex h-[284px] -rotate-[1.2deg] gap-3.5 rounded-[28px] bg-paper p-3 shadow-[0_40px_70px_-30px_rgb(0_0_0/0.7)]"
    >
      <ItemPhoto
        name={name}
        src480={item.imagePath ? imageUrl(item.imagePath, 480) : null}
        lightBackground={item.lightBackground}
        sizes="150px"
        initialSize={60}
        className="h-[260px] w-[150px] shrink-0 rounded-[20px]"
      />
      <div className="flex min-w-0 flex-col gap-1.5 pt-2 pr-1">
        {item.domain ? <span className="truncate text-xs text-muted">{item.domain}</span> : null}
        <span className="line-clamp-4 font-display-72 text-2xl leading-[1.1]">{name}</span>
        {price !== null ? (
          <span className="font-display text-[28px]">
            {formatPrice(price, item.currency ?? list.currency)}
          </span>
        ) : null}
        <span className="mt-auto inline-flex items-center gap-1.5 pb-1.5 text-xs text-muted">
          <ArrowLeft aria-hidden="true" size={14} strokeWidth={1.7} />
          glisser pour passer
        </span>
      </div>
    </article>
  );
}
