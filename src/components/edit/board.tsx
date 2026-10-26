"use client";

import { generateKeyBetween } from "fractional-indexing";
import { useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { toast } from "sonner";
import { byPosition, keyBetween, keysAtEndOf, keysAtStart } from "@/lib/positions";
import { resizeForUpload } from "@/lib/resizeImage";
import { plural } from "@/lib/text";
import type { Result } from "@/server/actions/result";
import {
  addItemWithPhoto,
  addItems,
  bulkUpdate,
  deleteItems,
  moveItem,
  restoreItems,
  sortAllInbox,
  updateItem,
  type ItemPatch,
} from "@/server/actions/items";
import { createCategory, createTag, moveCategory, renameCategory } from "@/server/actions/taxonomy";
import type { CategoryInfo, ItemInfo, ListContent, ListInfo, TagInfo } from "@/types/models";

// État du mode édition : copie locale des articles, mise à jour tout de suite (optimiste),
// puis confirmée par l'action serveur et `router.refresh()`. En cas d'échec, on revient en arrière.

export const TEMP_PREFIX = "tmp-";
export const isTemp = (id: string) => id.startsWith(TEMP_PREFIX);

export type BulkPatch = {
  categoryId?: string | null;
  addTagIds?: string[];
  removeTagIds?: string[];
  isFavorite?: boolean;
};

type Board = {
  list: ListInfo;
  items: ItemInfo[];
  categories: CategoryInfo[];
  tags: TagInfo[];
  /** Ajout « ici » : catégorie présélectionnée dans la barre d'ajout. */
  addTarget: CategoryInfo | null;
  setAddTarget: (c: CategoryInfo | null) => void;
  /** Article mis en évidence (doublon), par `ref`. */
  highlight: string | null;
  /** Articles ajoutés pendant la session (feuille « Ajouter » mobile). */
  recentIds: string[];
  selection: Set<string>;
  selectionMode: boolean;
  toggleSelect: (id: string, opts?: { range?: boolean }) => void;
  setSelectionMode: (on: boolean) => void;
  clearSelection: () => void;
  addLines: (lines: string[], categoryId?: string | null) => Promise<ItemInfo[] | null>;
  addPhoto: (file: File, categoryId?: string | null) => Promise<ItemInfo | null>;
  update: (item: ItemInfo, patch: ItemPatch) => Promise<ItemInfo | null>;
  remove: (ids: string[]) => void;
  move: (itemId: string, categoryId: string | null, beforeId: string | null, afterId: string | null) => void;
  bulk: (ids: string[], patch: BulkPatch) => void;
  sortAll: (categoryId: string) => void;
  createCategory: (name: string) => Promise<CategoryInfo | null>;
  createTag: (name: string) => Promise<TagInfo | null>;
  renameCategory: (id: string, name: string) => Promise<boolean>;
  moveCategory: (id: string, beforeId: string | null, afterId: string | null) => void;
  editHref: (ref: string) => string;
  refresh: () => void;
  /** Un enregistrement est en cours. */
  saving: boolean;
};

const BoardContext = createContext<Board | null>(null);

export function useBoard(): Board {
  const board = useContext(BoardContext);
  if (!board) throw new Error("useBoard hors du mode édition");
  return board;
}

const NETWORK_ERROR = "Pas enregistré. Vérifiez la connexion.";
const LOCKED_ERROR = "La modification s'est verrouillée. Saisissez le mot de passe pour continuer.";

function tempItem(fields: Partial<ItemInfo> & { position: string }, n: number): ItemInfo {
  return {
    id: `${TEMP_PREFIX}${Date.now()}-${n}`,
    ref: "",
    title: null,
    url: null,
    domain: null,
    description: null,
    note: null,
    priceCents: null,
    currency: null,
    priceSource: null,
    priceCheckedAt: null,
    imagePath: null,
    imageWidth: null,
    imageHeight: null,
    lightBackground: false,
    isFavorite: false,
    createdAt: new Date(Date.now() + n).toISOString(),
    categoryId: null,
    tagIds: [],
    fetchStatus: "none",
    sortedAt: null,
    imageCandidates: [],
    ...fields,
  };
}

/** Ligne → aperçu local immédiat (lien : domaine en attendant ; nom : tel quel). */
function draftFromLine(line: string) {
  const isLink = /^(https?:\/\/)?([a-z0-9-]+\.)+[a-z]{2,}(\/|\?|$)/i.test(line) && !/\s/.test(line);
  if (!isLink) return { title: line.slice(0, 200), url: null, domain: null, fetchStatus: "none" as const };
  const host = line
    .replace(/^https?:\/\//i, "")
    .split(/[/?#]/)[0]!
    .toLowerCase();
  return { title: null, url: line, domain: host.replace(/^(www|m)\./, ""), fetchStatus: "pending" as const };
}

type Props = { list: ListInfo; content: ListContent; children: ReactNode };

export function BoardProvider({ list, content, children }: Props) {
  const router = useRouter();
  // Copie locale, remplacée quand le serveur renvoie un nouveau contenu (après `router.refresh()`).
  const [source, setSource] = useState(content);
  const [items, setItems] = useState(content.items);
  const [categories, setCategories] = useState(content.categories);
  const [tags, setTags] = useState(content.tags);
  // Un contenu serveur n'est repris que s'il a été lu après la dernière écriture locale
  // (dates du serveur) et qu'aucune action n'est en cours. Sinon il est périmé : un
  // rafraîchissement lancé plus tôt peut arriver après une action (Next fusionne les
  // rafraîchissements simultanés), et l'état local, déjà à jour, ferait un retour en arrière.
  const [inFlight, setInFlight] = useState(0);
  const [lastWriteAt, setLastWriteAt] = useState(0);
  if (content !== source) {
    setSource(content);
    if (inFlight === 0 && content.loadedAt >= lastWriteAt) {
      setItems(content.items);
      setCategories(content.categories);
      setTags(content.tags);
    }
  }

  // Quitter la page pendant un enregistrement l'annulerait : le navigateur demande confirmation.
  useEffect(() => {
    if (inFlight === 0) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [inFlight]);

  const [addTarget, setAddTarget] = useState<CategoryInfo | null>(null);
  const [highlight, setHighlight] = useState<string | null>(null);
  const [recentIds, setRecentIds] = useState<string[]>([]);
  const [selection, setSelection] = useState<Set<string>>(new Set());
  const [selectionMode, setSelectionMode] = useState(false);
  const lastSelected = useRef<string | null>(null);
  const itemsRef = useRef(items);
  useLayoutEffect(() => {
    itemsRef.current = items;
  }, [items]);

  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const refresh = useCallback(() => {
    if (refreshTimer.current) clearTimeout(refreshTimer.current);
    refreshTimer.current = setTimeout(() => router.refresh(), 250);
  }, [router]);

  /** Exécute une action ; en cas d'échec : retour en arrière + message (et « Réessayer » si réseau). */
  const call = useCallback(
    async <T,>(
      run: () => Promise<Result<T>>,
      rollback: () => void,
      retry?: () => void,
    ): Promise<T | null> => {
      setInFlight((n) => n + 1);
      try {
        const result = await run();
        if (result.ok) {
          if (result.at) setLastWriteAt((t) => Math.max(t, result.at!));
          refresh();
          return result.data;
        }
        rollback();
        if (result.error.code === "EDIT_LOCKED") {
          toast(LOCKED_ERROR, { duration: 4000 });
          router.refresh();
        } else {
          toast(result.error.message, { duration: 4000 });
        }
        return null;
      } catch {
        rollback();
        toast(NETWORK_ERROR, {
          duration: 8000,
          action: retry ? { label: "Réessayer", onClick: retry } : undefined,
        });
        return null;
      } finally {
        setInFlight((n) => n - 1);
      }
    },
    [refresh, router],
  );

  const snapshot = () => itemsRef.current;
  const restore = (previous: ItemInfo[]) => () => setItems(previous);

  const showDuplicate = useCallback((ref: string) => {
    setHighlight(ref);
    toast("Déjà dans la liste", { duration: 4000 });
    requestAnimationFrame(() =>
      document
        .querySelector(`[data-item-ref="${ref}"]`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" }),
    );
    setTimeout(() => setHighlight((h) => (h === ref ? null : h)), 2400);
  }, []);

  // « Réessayer » rappelle la dernière version de addLines.
  const addLinesRef = useRef<(lines: string[], categoryId?: string | null) => Promise<ItemInfo[] | null>>(
    async () => null,
  );
  const addLines = useCallback(
    async (lines: string[], categoryId: string | null = null) => {
      const clean = lines
        .map((l) => l.trim())
        .filter(Boolean)
        .slice(0, 50);
      if (!clean.length) return null;
      const previous = snapshot();
      const now = new Date().toISOString();
      const positions = categoryId
        ? keysAtEndOf(previous, categoryId, clean.length)
        : keysAtStart([...previous].sort(byPosition)[0]?.position ?? null, clean.length);
      const temps = clean.map((line, i) =>
        tempItem(
          { ...draftFromLine(line), position: positions[i]!, categoryId, sortedAt: categoryId ? now : null },
          clean.length - i,
        ),
      );
      setItems((cur) => [...temps, ...cur]);
      const result = await call(
        () => addItems({ listId: list.id, lines: clean, categoryId }),
        restore(previous),
        () => void addLinesRef.current(clean, categoryId),
      );
      if (!result) return null;
      const tempIds = new Set(temps.map((t) => t.id));
      setItems((cur) => [...result.created, ...cur.filter((i) => !tempIds.has(i.id))]);
      setRecentIds((ids) => [...result.created.map((i) => i.id), ...ids].slice(0, 30));
      if (result.created.length > 0) {
        toast(result.created.length === 1 ? "Article ajouté" : `${result.created.length} articles ajoutés`, {
          duration: 4000,
        });
      }
      if (result.duplicates[0]) showDuplicate(result.duplicates[0].itemRef);
      return result.created;
    },
    [call, list.id, showDuplicate],
  );

  useLayoutEffect(() => {
    addLinesRef.current = addLines;
  }, [addLines]);

  const addPhoto = useCallback(
    async (file: File, categoryId: string | null = null) => {
      const previous = snapshot();
      const [position] = categoryId
        ? keysAtEndOf(previous, categoryId, 1)
        : keysAtStart([...previous].sort(byPosition)[0]?.position ?? null, 1);
      const temp = tempItem({ title: "", position: position!, categoryId }, 0);
      setItems((cur) => [temp, ...cur]);
      const form = new FormData();
      form.set("listId", list.id);
      form.set("file", await resizeForUpload(file));
      if (categoryId) form.set("categoryId", categoryId);
      const created = await call(() => addItemWithPhoto(form), restore(previous));
      if (!created) return null;
      setItems((cur) => [created, ...cur.filter((i) => i.id !== temp.id)]);
      setRecentIds((ids) => [created.id, ...ids].slice(0, 30));
      toast("Article ajouté", { duration: 4000 });
      return created;
    },
    [call, list.id],
  );

  const update = useCallback(
    async (item: ItemInfo, patch: ItemPatch) => {
      const previous = snapshot();
      setItems((cur) =>
        cur.map((i) =>
          i.id === item.id
            ? {
                ...i,
                ...(patch.isFavorite !== undefined ? { isFavorite: patch.isFavorite } : {}),
                ...(patch.categoryId !== undefined
                  ? {
                      categoryId: patch.categoryId,
                      sortedAt: i.sortedAt ?? (patch.categoryId ? new Date().toISOString() : null),
                    }
                  : {}),
                ...(patch.tagIds !== undefined ? { tagIds: patch.tagIds } : {}),
              }
            : i,
        ),
      );
      const updated = await call(() => updateItem({ itemId: item.id, patch }), restore(previous));
      if (updated) setItems((cur) => cur.map((i) => (i.id === updated.id ? updated : i)));
      return updated;
    },
    [call],
  );

  const remove = useCallback(
    (ids: string[]) => {
      const realIds = ids.filter((id) => !isTemp(id));
      if (!realIds.length) return;
      const previous = snapshot();
      setItems((cur) => cur.filter((i) => !realIds.includes(i.id)));
      setSelection((s) => new Set([...s].filter((id) => !realIds.includes(id))));
      void call(() => deleteItems({ itemIds: realIds }), restore(previous)).then((done) => {
        if (!done) return;
        toast(realIds.length === 1 ? "Article supprimé" : `${realIds.length} articles supprimés`, {
          duration: 8000,
          action: {
            label: "Annuler",
            onClick: () => {
              const removed = previous.filter((i) => realIds.includes(i.id));
              setItems((cur) => [...cur, ...removed]);
              void call(
                () => restoreItems({ itemIds: realIds }),
                () => setItems((cur) => cur.filter((i) => !realIds.includes(i.id))),
              ).then((r) => {
                if (r && r.restored.length < realIds.length) {
                  setItems((cur) => cur.filter((i) => !realIds.includes(i.id) || r.restored.includes(i.id)));
                  toast("Un article avec ce lien existe déjà.", { duration: 4000 });
                }
              });
            },
          },
        });
      });
    },
    [call],
  );

  const move = useCallback(
    (itemId: string, categoryId: string | null, beforeId: string | null, afterId: string | null) => {
      const previous = snapshot();
      const others = previous.filter((i) => i.id !== itemId);
      const before = others.find((i) => i.id === beforeId) ?? null;
      const after = others.find((i) => i.id === afterId) ?? null;
      const position =
        before || after ? keyBetween(others, before, after) : keysAtEndOf(others, categoryId, 1)[0]!;
      setItems((cur) =>
        cur.map((i) =>
          i.id === itemId
            ? {
                ...i,
                position,
                categoryId,
                sortedAt: i.sortedAt ?? (categoryId ? new Date().toISOString() : null),
              }
            : i,
        ),
      );
      void call(() => moveItem({ itemId, categoryId, beforeId, afterId }), restore(previous)).then((r) => {
        if (r) setItems((cur) => cur.map((i) => (i.id === itemId ? { ...i, position: r.position } : i)));
      });
    },
    [call],
  );

  const bulk = useCallback(
    (ids: string[], patch: BulkPatch) => {
      const realIds = ids.filter((id) => !isTemp(id));
      if (!realIds.length) return;
      const previous = snapshot();
      const now = new Date().toISOString();
      setItems((cur) =>
        cur.map((i) => {
          if (!realIds.includes(i.id)) return i;
          let tagIds = i.tagIds;
          if (patch.addTagIds) tagIds = [...new Set([...tagIds, ...patch.addTagIds])];
          if (patch.removeTagIds) tagIds = tagIds.filter((t) => !patch.removeTagIds!.includes(t));
          return {
            ...i,
            tagIds,
            ...(patch.isFavorite !== undefined ? { isFavorite: patch.isFavorite } : {}),
            ...(patch.categoryId !== undefined
              ? { categoryId: patch.categoryId, sortedAt: i.sortedAt ?? (patch.categoryId ? now : null) }
              : {}),
          };
        }),
      );
      void call(() => bulkUpdate({ itemIds: realIds, ...patch }), restore(previous));
    },
    [call],
  );

  const sortAll = useCallback(
    (categoryId: string) => {
      const previous = snapshot();
      const now = new Date().toISOString();
      const count = previous.filter((i) => !i.sortedAt).length;
      setItems((cur) => cur.map((i) => (i.sortedAt ? i : { ...i, categoryId, sortedAt: now })));
      void call(() => sortAllInbox({ listId: list.id, categoryId }), restore(previous)).then((r) => {
        if (r) toast(`${plural(r.count || count, "article rangé", "articles rangés")}`, { duration: 4000 });
      });
    },
    [call, list.id],
  );

  const createCategoryFn = useCallback(
    async (name: string) => {
      const result = await call(
        () => createCategory({ listId: list.id, name }),
        () => undefined,
      );
      if (!result) return null;
      if (!result.existed) setCategories((cur) => [...cur, result.category]);
      return result.category;
    },
    [call, list.id],
  );

  const createTagFn = useCallback(
    async (name: string) => {
      const result = await call(
        () => createTag({ listId: list.id, name }),
        () => undefined,
      );
      if (!result) return null;
      if (!result.existed) setTags((cur) => [...cur, result.tag]);
      return result.tag;
    },
    [call, list.id],
  );

  const renameCategoryFn = useCallback(
    async (id: string, name: string) => {
      const previous = categories;
      setCategories((cur) => cur.map((c) => (c.id === id ? { ...c, name } : c)));
      const result = await call(
        () => renameCategory({ listId: list.id, categoryId: id, name }),
        () => setCategories(previous),
      );
      return Boolean(result);
    },
    [call, categories, list.id],
  );

  const moveCategoryFn = useCallback(
    (id: string, beforeId: string | null, afterId: string | null) => {
      const previous = categories;
      const before = categories.find((c) => c.id === beforeId)?.position ?? null;
      const after = categories.find((c) => c.id === afterId)?.position ?? null;
      const position =
        before && after && before >= after
          ? generateKeyBetween(before, null)
          : generateKeyBetween(before, after);
      setCategories((cur) => cur.map((c) => (c.id === id ? { ...c, position } : c)));
      void call(
        () => moveCategory({ listId: list.id, categoryId: id, beforeId, afterId }),
        () => setCategories(previous),
      );
    },
    [call, categories, list.id],
  );

  const toggleSelect = useCallback((id: string, opts?: { range?: boolean }) => {
    if (isTemp(id)) return;
    setSelection((current) => {
      const next = new Set(current);
      const anchor = lastSelected.current;
      if (opts?.range && anchor && anchor !== id) {
        // Plage dans l'ordre affiché (sections dans l'ordre, puis position).
        const order = [...itemsRef.current].sort(byPosition).map((i) => i.id);
        const [a, b] = [order.indexOf(anchor), order.indexOf(id)].sort((x, y) => x - y);
        if (a! >= 0) for (const rid of order.slice(a, b! + 1)) next.add(rid);
      } else if (next.has(id)) next.delete(id);
      else next.add(id);
      lastSelected.current = id;
      return next;
    });
  }, []);

  const clearSelection = useCallback(() => {
    setSelection(new Set());
    setSelectionMode(false);
    lastSelected.current = null;
  }, []);

  const value = useMemo<Board>(
    () => ({
      list,
      items,
      categories,
      tags,
      addTarget,
      setAddTarget,
      highlight,
      recentIds,
      selection,
      selectionMode: selectionMode || selection.size > 0,
      toggleSelect,
      setSelectionMode,
      clearSelection,
      addLines,
      addPhoto,
      update,
      remove,
      move,
      bulk,
      sortAll,
      createCategory: createCategoryFn,
      createTag: createTagFn,
      renameCategory: renameCategoryFn,
      moveCategory: moveCategoryFn,
      editHref: (ref: string) => `/l/${list.slug}/edition/a/${ref}`,
      refresh,
      saving: inFlight > 0,
    }),
    [
      list,
      items,
      categories,
      tags,
      addTarget,
      highlight,
      recentIds,
      selection,
      selectionMode,
      toggleSelect,
      clearSelection,
      addLines,
      addPhoto,
      update,
      remove,
      move,
      bulk,
      sortAll,
      createCategoryFn,
      createTagFn,
      renameCategoryFn,
      moveCategoryFn,
      refresh,
      inFlight,
    ],
  );

  return <BoardContext.Provider value={value}>{children}</BoardContext.Provider>;
}
