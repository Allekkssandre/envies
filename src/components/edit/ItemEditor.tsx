"use client";

import * as Dialog from "@radix-ui/react-dialog";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Camera, CircleAlert, FileImage, Heart, ImageIcon, Plus, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
import { toast } from "sonner";
import { Drawer } from "vaul";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { IconButton } from "@/components/ui/IconButton";
import { ItemPhoto } from "@/components/ui/ItemPhoto";
import { Toggle } from "@/components/ui/Toggle";
import { DESKTOP_QUERY, useMediaQuery } from "@/hooks/useMediaQuery";
import { cn } from "@/lib/cn";
import { imageUrl } from "@/lib/imageUrl";
import { sortCategories } from "@/lib/listFilters";
import { parseManualPrice, priceToInput } from "@/lib/price";
import { resizeForUpload } from "@/lib/resizeImage";
import { tagColorVar } from "@/lib/tagColors";
import { deleteItems, restoreItems, setItemImage, updateItem, type ItemPatch } from "@/server/actions/items";
import type { Result } from "@/server/actions/result";
import { createCategory, createTag } from "@/server/actions/taxonomy";
import { itemName, type CategoryInfo, type ItemInfo, type ListInfo, type TagInfo } from "@/types/models";
import { menuItem, menuPanel } from "./menuStyles";

type EditorProps = {
  list: ListInfo;
  item: ItemInfo;
  categories: CategoryInfo[];
  tags: TagInfo[];
  /** `modal` : ouvert depuis l'édition (route interceptée) ; `page` : lien direct. */
  mode: "modal" | "page";
};

type Draft = {
  title: string;
  price: string;
  url: string;
  note: string;
  categoryId: string | null;
  tagIds: string[];
  isFavorite: boolean;
};

type FieldName = "title" | "price" | "url" | "note";
type Errors = Partial<Record<FieldName, string>>;

const NETWORK_ERROR = "Pas enregistré. Vérifiez la connexion.";
const PRICE_ERROR = "Ce prix n'est pas lu.";

const toDraft = (item: ItemInfo): Draft => ({
  title: item.title ?? "",
  price: priceToInput(item.priceCents),
  url: item.url ?? "",
  note: item.note ?? "",
  categoryId: item.categoryId,
  tagIds: item.tagIds,
  isFavorite: item.isFavorite,
});

const currencySymbol = (currency: string) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency })
    .formatToParts(0)
    .find((p) => p.type === "currency")?.value ?? currency;

/** Différences entre le brouillon et l'article (ce qu'il faut envoyer). `null` si un prix est illisible. */
function diff(item: ItemInfo, draft: Draft): ItemPatch | null {
  const patch: ItemPatch = {};
  if (draft.title.trim() !== (item.title ?? "")) patch.title = draft.title;
  const price = draft.price.trim() === "" ? null : parseManualPrice(draft.price);
  if (draft.price.trim() !== "" && price === null) return null;
  if (price !== item.priceCents) patch.priceCents = price;
  if (draft.url.trim() !== (item.url ?? "")) patch.url = draft.url.trim() || null;
  if (draft.note.trim() !== (item.note ?? "")) patch.note = draft.note;
  if (draft.categoryId !== item.categoryId) patch.categoryId = draft.categoryId;
  if (draft.isFavorite !== item.isFavorite) patch.isFavorite = draft.isFavorite;
  const tagsChanged =
    draft.tagIds.length !== item.tagIds.length || draft.tagIds.some((t) => !item.tagIds.includes(t));
  if (tagsChanged) patch.tagIds = draft.tagIds;
  return patch;
}

/** Panneau « Modifier l'article » : panneau à droite (desktop) ou feuille plein écran (mobile). */
export function ItemEditor({
  list,
  item: initial,
  categories: initialCategories,
  tags: initialTags,
  mode,
}: EditorProps) {
  const router = useRouter();
  const isDesktop = useMediaQuery(DESKTOP_QUERY);
  const [open, setOpen] = useState(true);
  const [item, setItem] = useState(initial);
  const [draft, setDraft] = useState(() => toDraft(initial));
  const [errors, setErrors] = useState<Errors>({});
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [categories, setCategories] = useState(initialCategories);
  const [tags, setTags] = useState(initialTags);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const leaving = useRef(false);

  const leave = useCallback(() => {
    if (mode === "modal") router.back();
    else router.push(`/l/${list.slug}/edition`, { scroll: false });
  }, [mode, router, list.slug]);

  const close = useCallback(() => {
    setOpen(false);
    if (leaving.current) return;
    leaving.current = true;
    window.setTimeout(leave, 320);
  }, [leave]);

  // « Réessayer » rappelle la dernière version de save.
  const saveRef = useRef<(patch: ItemPatch) => Promise<boolean>>(async () => false);
  /** Envoie un patch ; met à jour l'article et la liste en fond. */
  const save = useCallback(
    async (patch: ItemPatch): Promise<boolean> => {
      if (Object.keys(patch).length === 0) return true;
      setStatus("saving");
      let result: Result<ItemInfo>;
      try {
        result = await updateItem({ itemId: item.id, patch });
      } catch {
        setStatus("idle");
        toast(NETWORK_ERROR, {
          duration: 8000,
          action: { label: "Réessayer", onClick: () => void saveRef.current(patch) },
        });
        return false;
      }
      if (!result.ok) {
        setStatus("idle");
        const field = result.error.field as FieldName | undefined;
        if (field) setErrors((e) => ({ ...e, [field]: result.error.message }));
        else toast(result.error.message, { duration: 4000 });
        if (result.error.code === "EDIT_LOCKED") router.refresh();
        return false;
      }
      setItem(result.data);
      setStatus("saved");
      router.refresh();
      return true;
    },
    [item.id, router],
  );

  useLayoutEffect(() => {
    saveRef.current = save;
  }, [save]);

  /** Desktop : enregistrement d'un champ texte à la sortie. */
  const commit = (field: FieldName) => {
    if (!isDesktop) return;
    if (field === "price") {
      const value = draft.price.trim();
      const cents = value === "" ? null : parseManualPrice(value);
      if (value !== "" && cents === null) {
        setErrors((e) => ({ ...e, price: PRICE_ERROR }));
        return;
      }
      if (cents !== item.priceCents) void save({ priceCents: cents });
      return;
    }
    const patch = diff(item, { ...toDraft(item), [field]: draft[field] });
    if (patch) void save(patch);
  };

  /** Desktop : catégorie, tags et cœur enregistrés tout de suite. Mobile : dans le brouillon. */
  const setInstant = (patch: Partial<Draft>) => {
    setDraft((d) => ({ ...d, ...patch }));
    if (isDesktop) {
      void save({
        ...(patch.categoryId !== undefined ? { categoryId: patch.categoryId } : {}),
        ...(patch.tagIds !== undefined ? { tagIds: patch.tagIds } : {}),
        ...(patch.isFavorite !== undefined ? { isFavorite: patch.isFavorite } : {}),
      });
    }
  };

  const remove = async () => {
    try {
      const result = await deleteItems({ itemIds: [item.id] });
      if (!result.ok) {
        toast(result.error.message, { duration: 4000 });
        return;
      }
    } catch {
      toast(NETWORK_ERROR, { duration: 8000 });
      return;
    }
    router.refresh();
    toast("Article supprimé", {
      duration: 8000,
      action: {
        label: "Annuler",
        onClick: async () => {
          const r = await restoreItems({ itemIds: [item.id] });
          if (!r.ok) toast(r.error.message, { duration: 4000 });
          router.refresh();
        },
      },
    });
    close();
  };

  const changePhoto = async (file: File | null) => {
    const form = new FormData();
    form.set("itemId", item.id);
    if (file) form.set("file", await resizeForUpload(file));
    else form.set("remove", "1");
    setStatus("saving");
    try {
      const result = await setItemImage(form);
      if (!result.ok) {
        setStatus("idle");
        toast(result.error.message, { duration: 4000 });
        return;
      }
      setItem(result.data);
      setStatus("saved");
      router.refresh();
    } catch {
      setStatus("idle");
      toast(NETWORK_ERROR, { duration: 8000 });
    }
  };

  const addCategory = async (name: string) => {
    const r = await createCategory({ listId: list.id, name });
    if (!r.ok) {
      toast(r.error.message, { duration: 4000 });
      return;
    }
    if (!r.data.existed) setCategories((c) => [...c, r.data.category]);
    setInstant({ categoryId: r.data.category.id });
  };

  const addTag = async (name: string) => {
    const r = await createTag({ listId: list.id, name });
    if (!r.ok) {
      toast(r.error.message, { duration: 4000 });
      return;
    }
    if (!r.data.existed) setTags((t) => [...t, r.data.tag]);
    if (!draft.tagIds.includes(r.data.tag.id)) setInstant({ tagIds: [...draft.tagIds, r.data.tag.id] });
  };

  // Mobile : « Enregistrer » envoie tout ; fermer avec des modifications → confirmation.
  const pending = diff(item, draft);
  const dirty = pending === null || Object.keys(pending).length > 0;

  const saveAll = async () => {
    if (pending === null) {
      setErrors((e) => ({ ...e, price: PRICE_ERROR }));
      return;
    }
    if (await save(pending)) close();
  };

  const requestClose = () => {
    if (!isDesktop && dirty) setConfirmDiscard(true);
    else close();
  };

  if (isDesktop === null) return null;

  const body = (
    <EditorFields
      list={list}
      item={item}
      draft={draft}
      errors={errors}
      categories={categories}
      tags={tags}
      mobile={!isDesktop}
      onDraft={(patch) => {
        setDraft((d) => ({ ...d, ...patch }));
        const changed = Object.keys(patch) as FieldName[];
        setErrors((e) => {
          const next = { ...e };
          for (const k of changed) delete next[k];
          return next;
        });
      }}
      onInstant={setInstant}
      onCommit={commit}
      onPhoto={(file) => void changePhoto(file)}
      onAddCategory={(n) => void addCategory(n)}
      onAddTag={(n) => void addTag(n)}
      onDelete={() => void remove()}
    />
  );

  return (
    <>
      <Drawer.Root
        open={open}
        onOpenChange={(next) => (next ? setOpen(true) : requestClose())}
        direction={isDesktop ? "right" : "bottom"}
        handleOnly
        dismissible={isDesktop || !dirty}
        repositionInputs={false}
      >
        <Drawer.Portal>
          <Drawer.Overlay className="fixed inset-0 z-50 bg-[rgb(24_20_10/0.5)] backdrop-blur-[6px]" />
          <Drawer.Content
            aria-describedby={undefined}
            className={cn(
              "fixed z-50 flex flex-col bg-paper text-ink outline-none",
              isDesktop
                ? "inset-y-0 right-0 w-[min(640px,100vw)] rounded-l-[30px] shadow-panel-right"
                : "inset-x-0 top-10 bottom-0 rounded-t-sheet",
            )}
          >
            <span
              aria-hidden="true"
              className={cn(
                "pointer-events-none absolute inset-0 opacity-50 grain-fine",
                isDesktop ? "rounded-l-[30px]" : "rounded-t-sheet",
              )}
            />
            {isDesktop ? (
              <div className="relative flex items-center justify-between gap-3 pt-4 pr-5 pb-2 pl-8">
                <Drawer.Title className="m-0 flex items-baseline gap-2 text-xs font-normal">
                  <span className="caps text-ink-soft">Modifier l&apos;article</span>
                  <span className="text-[13px] text-muted" aria-live="polite">
                    ·{" "}
                    {status === "saving"
                      ? "Enregistrement…"
                      : status === "saved"
                        ? "Enregistré"
                        : "enregistré automatiquement"}
                  </span>
                </Drawer.Title>
                <div className="flex gap-1.5">
                  <IconButton
                    variant="outline"
                    aria-label="Supprimer l'article"
                    onClick={() => void remove()}
                  >
                    <Trash2 aria-hidden="true" />
                  </IconButton>
                  <IconButton variant="ink" aria-label="Fermer" onClick={close}>
                    <X aria-hidden="true" />
                  </IconButton>
                </div>
              </div>
            ) : (
              <div className="relative grid grid-cols-[1fr_auto_1fr] items-center gap-2 px-3 pt-3 pb-2">
                <button
                  type="button"
                  onClick={requestClose}
                  className="min-h-11 justify-self-start px-2 text-[15px] font-semibold"
                >
                  Annuler
                </button>
                <Drawer.Title className="m-0 text-base font-bold">Modifier l&apos;article</Drawer.Title>
                <Button
                  variant="ink"
                  size={44}
                  className="justify-self-end px-4"
                  disabled={status === "saving"}
                  onClick={() => void saveAll()}
                >
                  Enregistrer
                </Button>
              </div>
            )}
            <div
              className="relative flex-1 overflow-y-auto"
              onKeyDown={(e: KeyboardEvent) => {
                // ⌘ Entrée : enregistre le champ en cours (sortie de champ).
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey))
                  (document.activeElement as HTMLElement | null)?.blur();
              }}
            >
              {body}
            </div>
          </Drawer.Content>
        </Drawer.Portal>
      </Drawer.Root>

      <Dialog.Root open={confirmDiscard} onOpenChange={setConfirmDiscard}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-[80] bg-[rgb(24_20_10/0.5)]" />
          <Dialog.Content
            aria-describedby={undefined}
            className="fixed top-1/2 left-1/2 z-[80] flex w-[min(400px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 flex-col gap-5 rounded-panel bg-paper p-6 text-ink shadow-modal"
          >
            <Dialog.Title className="m-0 font-display-72 text-2xl font-normal">
              Abandonner les modifications ?
            </Dialog.Title>
            <div className="flex justify-end gap-2">
              <Button variant="outline" size={44} onClick={() => setConfirmDiscard(false)}>
                Continuer
              </Button>
              <Button
                variant="rust"
                size={44}
                onClick={() => {
                  setConfirmDiscard(false);
                  close();
                }}
              >
                Abandonner
              </Button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}

type FieldsProps = {
  list: ListInfo;
  item: ItemInfo;
  draft: Draft;
  errors: Errors;
  categories: CategoryInfo[];
  tags: TagInfo[];
  mobile: boolean;
  onDraft: (patch: Partial<Draft>) => void;
  onInstant: (patch: Partial<Draft>) => void;
  onCommit: (field: FieldName) => void;
  onPhoto: (file: File | null) => void;
  onAddCategory: (name: string) => void;
  onAddTag: (name: string) => void;
  onDelete: () => void;
};

const label = "caps text-xs text-muted";
const box =
  "flex items-center gap-2.5 rounded-field border bg-field px-[18px] shadow-[inset_0_1px_2px_rgb(43_36_22/0.06)] transition-[border-color,box-shadow] duration-180 focus-within:border-ink focus-within:shadow-[0_0_0_4px_rgb(167_106_25/0.2)]";
const input =
  "min-w-0 flex-1 border-0 bg-transparent text-base text-ink outline-none focus-visible:outline-none";

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="m-0 flex items-center gap-1.5 text-[13px] font-semibold text-rust">
      <CircleAlert aria-hidden="true" size={15} strokeWidth={2} />
      {message}
    </p>
  );
}

function EditorFields(props: FieldsProps) {
  const { list, item, draft, errors, mobile, onDraft, onCommit } = props;
  const file = useRef<HTMLInputElement>(null);
  const camera = useRef<HTMLInputElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const name = itemName({ title: draft.title || null, domain: item.domain });

  useEffect(() => {
    // Article sans nom (photo envoyée) : on commence par le nom.
    if (!item.title) setTimeout(() => nameRef.current?.focus(), 350);
  }, [item.title]);

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (f) props.onPhoto(f);
  };

  return (
    <div className={cn("flex flex-col gap-6", mobile ? "px-4 pt-2 pb-10" : "px-12 pt-3 pb-12")}>
      <ItemPhoto
        name={name}
        src480={item.imagePath ? imageUrl(item.imagePath, 480) : null}
        src1200={item.imagePath ? imageUrl(item.imagePath, 1200) : null}
        lightBackground={item.lightBackground}
        sizes={mobile ? "100vw" : "544px"}
        initialSize={mobile ? 90 : 130}
        className={cn("rounded-[22px]", mobile ? "h-[220px]" : "h-[300px]")}
      >
        <DropdownMenu.Root>
          <DropdownMenu.Trigger className="absolute bottom-3 left-3 inline-flex h-10 items-center gap-2 rounded-full border border-white/60 bg-linen/85 px-3.5 text-sm font-semibold text-ink backdrop-blur-[10px]">
            <ImageIcon aria-hidden="true" size={17} strokeWidth={1.7} />
            Changer la photo
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content align="start" sideOffset={8} className={menuPanel}>
              <DropdownMenu.Item className={menuItem} onSelect={() => file.current?.click()}>
                <span className="flex items-center gap-2.5">
                  <FileImage aria-hidden="true" size={17} strokeWidth={1.7} />
                  Choisir un fichier
                </span>
              </DropdownMenu.Item>
              {mobile ? (
                <DropdownMenu.Item className={menuItem} onSelect={() => camera.current?.click()}>
                  <span className="flex items-center gap-2.5">
                    <Camera aria-hidden="true" size={17} strokeWidth={1.7} />
                    Prendre une photo
                  </span>
                </DropdownMenu.Item>
              ) : null}
              {item.imagePath ? (
                <DropdownMenu.Item className={cn(menuItem, "text-rust")} onSelect={() => props.onPhoto(null)}>
                  <span className="flex items-center gap-2.5">
                    <Trash2 aria-hidden="true" size={17} strokeWidth={1.7} />
                    Retirer la photo
                  </span>
                </DropdownMenu.Item>
              ) : null}
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </ItemPhoto>
      <input ref={file} type="file" accept="image/*" hidden onChange={onFile} />
      <input ref={camera} type="file" accept="image/*" capture="environment" hidden onChange={onFile} />

      <div className="flex flex-col gap-2">
        <label htmlFor="edit-title" className={label}>
          Nom
        </label>
        <span className={cn(box, "h-13", errors.title ? "border-rust" : "border-ink/16")}>
          <input
            ref={nameRef}
            id="edit-title"
            value={draft.title}
            maxLength={200}
            onChange={(e) => onDraft({ title: e.target.value })}
            onBlur={() => onCommit("title")}
            className={input}
          />
        </span>
        <FieldError id="edit-title-msg" message={errors.title} />
      </div>

      <div className="grid grid-cols-[minmax(0,0.42fr)_minmax(0,1fr)] gap-3">
        <div className="flex flex-col gap-2">
          <label htmlFor="edit-price" className={label}>
            Prix
          </label>
          <span className={cn(box, "h-13", errors.price ? "border-rust" : "border-ink/16")}>
            <input
              id="edit-price"
              inputMode="decimal"
              value={draft.price}
              onChange={(e) => onDraft({ price: e.target.value })}
              onBlur={() => onCommit("price")}
              aria-invalid={errors.price ? true : undefined}
              aria-describedby={errors.price ? "edit-price-msg" : undefined}
              className={input}
            />
            <span aria-hidden="true" className="text-base text-ink-soft">
              {currencySymbol(item.currency ?? list.currency)}
            </span>
          </span>
          <FieldError id="edit-price-msg" message={errors.price} />
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor="edit-url" className={label}>
            Lien
          </label>
          <span className={cn(box, "h-13", errors.url ? "border-rust" : "border-ink/16")}>
            <input
              id="edit-url"
              type="url"
              inputMode="url"
              value={draft.url}
              onChange={(e) => onDraft({ url: e.target.value })}
              onBlur={() => onCommit("url")}
              aria-invalid={errors.url ? true : undefined}
              aria-describedby={errors.url ? "edit-url-msg" : undefined}
              className={input}
            />
          </span>
          <FieldError id="edit-url-msg" message={errors.url} />
        </div>
      </div>

      <fieldset className="m-0 flex flex-col gap-3 border-0 p-0">
        <legend className={cn(label, "mb-3")}>Catégorie</legend>
        <div className="flex flex-wrap gap-2">
          {sortCategories(props.categories).map((c) => (
            <Chip
              key={c.id}
              pressed={draft.categoryId === c.id}
              onClick={() => props.onInstant({ categoryId: draft.categoryId === c.id ? null : c.id })}
              className="h-11 text-[15px]"
            >
              {c.name}
            </Chip>
          ))}
          <InlineCreate
            label="Nouvelle"
            placeholder="Nom de la catégorie"
            maxLength={40}
            onCreate={props.onAddCategory}
          />
        </div>
      </fieldset>

      <fieldset className="m-0 flex flex-col gap-3 border-0 p-0">
        <legend className={cn(label, "mb-3")}>Tags</legend>
        <div className="flex flex-wrap gap-2">
          {props.tags.map((t) => {
            const on = draft.tagIds.includes(t.id);
            return (
              <Chip
                key={t.id}
                pressed={on}
                tone={tagColorVar[t.color]}
                dot={tagColorVar[t.color]}
                onClick={() =>
                  props.onInstant({
                    tagIds: on ? draft.tagIds.filter((id) => id !== t.id) : [...draft.tagIds, t.id],
                  })
                }
                className="h-11 text-[15px]"
              >
                {t.name}
              </Chip>
            );
          })}
          <InlineCreate
            label="Nouveau tag"
            placeholder="Avis, priorité, taille…"
            maxLength={30}
            onCreate={props.onAddTag}
          />
        </div>
      </fieldset>

      <div className="flex min-h-16 items-center gap-3 rounded-[18px] border border-rust/18 bg-rust/10 py-2 pr-3 pl-4">
        <Heart aria-hidden="true" size={18} className="fill-rust text-rust" />
        <span className="flex-1 text-base font-semibold">Coup de cœur</span>
        <Toggle
          label="Coup de cœur"
          hideLabel
          tone="rust"
          checked={draft.isFavorite}
          onCheckedChange={(isFavorite) => props.onInstant({ isFavorite })}
        />
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="edit-note" className={label}>
          Note pour les visiteurs
        </label>
        <textarea
          id="edit-note"
          rows={3}
          maxLength={500}
          value={draft.note}
          onChange={(e) => onDraft({ note: e.target.value })}
          onBlur={() => onCommit("note")}
          className={cn(
            box,
            "h-auto resize-y border-ink/16 py-3.5 font-note text-lg leading-normal outline-none",
          )}
        />
      </div>

      {mobile ? (
        <button
          type="button"
          onClick={props.onDelete}
          className="mx-auto inline-flex min-h-11 items-center gap-2 text-[15px] font-semibold text-rust"
        >
          <Trash2 aria-hidden="true" size={18} strokeWidth={1.7} />
          Supprimer l&apos;article
        </button>
      ) : (
        <Button
          variant="rust-outline"
          className="self-start"
          icon={<Trash2 aria-hidden="true" />}
          onClick={props.onDelete}
        >
          Supprimer l&apos;article
        </Button>
      )}
    </div>
  );
}

/** « + Nouvelle » / « + Nouveau tag » : champ en ligne, Entrée crée et sélectionne. */
function InlineCreate({
  label: text,
  placeholder,
  maxLength,
  onCreate,
}: {
  label: string;
  placeholder: string;
  maxLength: number;
  onCreate: (name: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");
  if (!editing) {
    return (
      <Chip
        icon={<Plus aria-hidden="true" size={15} strokeWidth={2} />}
        onClick={() => setEditing(true)}
        className="h-11 text-[15px]"
      >
        {text}
      </Chip>
    );
  }
  const submit = () => {
    const name = value.trim();
    if (name) onCreate(name);
    setValue("");
    setEditing(false);
  };
  return (
    <span className="inline-flex h-11 items-center rounded-full border border-ink bg-white/80 pr-1 pl-4 shadow-[0_0_0_4px_rgb(167_106_25/0.2)]">
      <label className="sr-only" htmlFor={`create-${text}`}>
        {text}
      </label>
      <input
        id={`create-${text}`}
        autoFocus
        value={value}
        maxLength={maxLength}
        placeholder={placeholder}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            submit();
          }
          if (e.key === "Escape") {
            e.stopPropagation();
            setEditing(false);
          }
        }}
        onBlur={submit}
        className="w-44 border-0 bg-transparent text-[15px] outline-none focus-visible:outline-none"
      />
    </span>
  );
}
