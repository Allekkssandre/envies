"use client";

import { Camera, CircleCheck, ClipboardPaste, ImageIcon, LoaderCircle, Plus, X } from "lucide-react";
import Link from "next/link";
import { useRef, useState } from "react";
import { Drawer } from "vaul";
import { Button, buttonClasses } from "@/components/ui/Button";
import { ItemPhoto } from "@/components/ui/ItemPhoto";
import { cn } from "@/lib/cn";
import { formatPrice } from "@/lib/format";
import { imageUrl } from "@/lib/imageUrl";
import { itemName, type ItemInfo } from "@/types/models";
import { splitLines } from "./AddBar";
import { isTemp, useBoard } from "./board";

/** Barre basse mobile : faux champ, appareil photo, bouton +. Ouvre la feuille « Ajouter ». */
export function MobileAddBar() {
  const board = useBoard();
  const [open, setOpen] = useState(false);
  const camera = useRef<HTMLInputElement>(null);

  return (
    <>
      <div className="fixed inset-x-0 bottom-0 z-40 px-3 pb-[max(12px,env(safe-area-inset-bottom))] lg:hidden">
        <div className="flex h-[60px] items-center gap-1 rounded-full py-1.5 pr-1.5 pl-5 glass-light">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="h-full min-w-0 flex-1 truncate text-left text-base text-placeholder"
          >
            {board.addTarget ? `Ajouter dans ${board.addTarget.name}` : "Coller un lien, écrire un nom"}
          </button>
          <button
            type="button"
            aria-label="Photo"
            onClick={() => camera.current?.click()}
            className="flex size-11 shrink-0 items-center justify-center rounded-full text-ink"
          >
            <Camera aria-hidden="true" size={21} strokeWidth={1.6} />
          </button>
          <button
            type="button"
            aria-label="Ajouter"
            onClick={() => setOpen(true)}
            className="flex size-12 shrink-0 items-center justify-center rounded-full bg-ink text-linen shadow-ink"
          >
            <Plus aria-hidden="true" size={22} strokeWidth={1.8} />
          </button>
          <input
            ref={camera}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) void board.addPhoto(file, board.addTarget?.id ?? null);
            }}
          />
        </div>
      </div>
      <AddSheet open={open} onOpenChange={setOpen} />
    </>
  );
}

function AddSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const board = useBoard();
  const [text, setText] = useState("");
  const [sessionIds, setSessionIds] = useState<string[]>([]);
  const photo = useRef<HTMLInputElement>(null);
  const field = useRef<HTMLTextAreaElement>(null);
  const target = board.addTarget;

  const recent = sessionIds
    .map((id) => board.items.find((i) => i.id === id))
    .filter((i): i is ItemInfo => Boolean(i));
  const pendingTemps = board.items.filter((i) => isTemp(i.id));

  const add = async () => {
    const lines = splitLines(text);
    if (!lines.length) return;
    setText("");
    const created = await board.addLines(lines, target?.id ?? null);
    if (created) setSessionIds((ids) => [...created.map((i) => i.id), ...ids]);
    field.current?.focus();
  };

  const paste = async () => {
    try {
      const value = await navigator.clipboard.readText();
      setText((t) => [t, value].filter(Boolean).join("\n"));
      field.current?.focus();
    } catch {
      field.current?.focus();
    }
  };

  const change = (next: boolean) => {
    if (!next) {
      setSessionIds([]);
      board.setAddTarget(null);
    }
    onOpenChange(next);
  };

  return (
    <Drawer.Root open={open} onOpenChange={change}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-50 bg-[rgb(24_20_10/0.55)]" />
        <Drawer.Content
          aria-describedby={undefined}
          className="fixed inset-x-0 bottom-0 z-50 flex max-h-[94dvh] flex-col rounded-t-sheet bg-paper text-ink outline-none"
        >
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 rounded-t-sheet opacity-50 grain-fine"
          />
          <Drawer.Handle className="relative mt-2 h-[5px]! w-11! bg-ink/22!" />
          <div className="relative flex items-baseline justify-between px-4 pt-3">
            <Drawer.Title className="m-0 font-display-72 text-[34px] font-normal">Ajouter</Drawer.Title>
            <Drawer.Close className="min-h-11 px-1 text-[15px] font-semibold">Fermer</Drawer.Close>
          </div>

          <div className="relative flex flex-1 flex-col gap-3 overflow-y-auto px-4 pt-3 pb-4">
            <div className="rounded-[22px] border-2 border-ink bg-white/75 shadow-[0_0_0_5px_rgb(167_106_25/0.18)]">
              {target ? (
                <span className="m-3 mb-0 inline-flex h-8 items-center gap-1 rounded-full bg-ink/8 pr-1 pl-3 text-sm font-semibold">
                  dans {target.name}
                  <button
                    type="button"
                    aria-label="Ajouter sans catégorie"
                    onClick={() => board.setAddTarget(null)}
                    className="flex size-7 items-center justify-center"
                  >
                    <X aria-hidden="true" size={14} strokeWidth={2} />
                  </button>
                </span>
              ) : null}
              <label htmlFor="add-sheet-field" className="sr-only">
                Un lien ou un nom par ligne
              </label>
              <textarea
                ref={field}
                id="add-sheet-field"
                autoFocus
                rows={3}
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Un lien ou un nom par ligne"
                className="block w-full resize-none border-0 bg-transparent px-4 pt-3.5 pb-2 text-[17px] leading-normal text-ink outline-none focus-visible:outline-none"
              />
              <div className="flex items-center gap-1 border-t border-ink/10 py-2 pr-2 pl-2">
                <button
                  type="button"
                  onClick={() => void paste()}
                  className="inline-flex min-h-11 items-center gap-2 px-3 text-[15px] font-semibold"
                >
                  <ClipboardPaste aria-hidden="true" size={19} strokeWidth={1.6} />
                  Coller
                </button>
                <button
                  type="button"
                  onClick={() => photo.current?.click()}
                  className="inline-flex min-h-11 items-center gap-2 px-3 text-[15px] font-semibold"
                >
                  <Camera aria-hidden="true" size={19} strokeWidth={1.6} />
                  Photo
                </button>
                <Button variant="ink" size={52} className="ml-auto px-6" onClick={() => void add()}>
                  Ajouter
                </Button>
                <input
                  ref={photo}
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    e.target.value = "";
                    if (!file) return;
                    const created = await board.addPhoto(file, target?.id ?? null);
                    if (created) setSessionIds((ids) => [created.id, ...ids]);
                  }}
                />
              </div>
            </div>
            <p className="m-0 text-sm leading-normal text-ink-soft">
              Ajoutez en rafale : la fiche se complète toute seule (photo, prix, description). Vous rangerez
              plus tard.
            </p>

            {recent.length || pendingTemps.length ? (
              <section aria-labelledby="recent-title" className="mt-2">
                <div className="flex items-baseline justify-between">
                  <h3 id="recent-title" className="m-0 text-xs caps text-muted">
                    Ajoutés à l&apos;instant
                  </h3>
                  <span className="text-sm text-muted">{recent.length + pendingTemps.length}</span>
                </div>
                <ul role="list" aria-live="polite" className="m-0 mt-2 list-none p-0">
                  {[...pendingTemps, ...recent].map((item) => (
                    <RecentRow key={item.id} item={item} onComplete={() => onOpenChange(false)} />
                  ))}
                </ul>
              </section>
            ) : null}
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}

function RecentRow({ item, onComplete }: { item: ItemInfo; onComplete: () => void }) {
  const board = useBoard();
  const temp = isTemp(item.id);
  const pending = temp || item.fetchStatus === "pending";
  const failed = item.fetchStatus === "failed";
  const name = item.title?.trim() || (item.url ? item.url.replace(/^https?:\/\/(www\.)?/, "") : "Sans nom");
  let subtitle = "Sans lien";
  if (pending) subtitle = "Récupération des infos…";
  else if (failed) subtitle = "Rien trouvé sur la page";
  else if (item.url) {
    subtitle = [
      item.priceCents != null ? formatPrice(item.priceCents, item.currency ?? board.list.currency) : null,
      item.domain,
    ]
      .filter(Boolean)
      .join(" · ");
  }

  return (
    <li className="flex min-h-[68px] items-center gap-3 border-b border-ink/10 py-2">
      {failed ? (
        <span className="flex size-[52px] shrink-0 items-center justify-center rounded-[14px] border-[1.5px] border-dashed border-rust/40 text-rust">
          <ImageIcon aria-hidden="true" size={20} strokeWidth={1.6} />
        </span>
      ) : pending ? (
        <span className="flex size-[52px] shrink-0 items-center justify-center rounded-[14px] tex-studio">
          <LoaderCircle
            aria-hidden="true"
            size={20}
            strokeWidth={2}
            className="animate-spin motion-reduce:animate-none"
          />
        </span>
      ) : (
        <ItemPhoto
          name={itemName(item)}
          src480={item.imagePath ? imageUrl(item.imagePath, 480) : null}
          lightBackground={item.lightBackground}
          sizes="52px"
          initialSize={26}
          className="size-[52px] shrink-0 rounded-[14px] shadow-none"
        />
      )}
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-[15px] font-bold">{name}</span>
        <span className={cn("truncate text-sm", failed ? "text-rust" : "text-ink-soft")}>{subtitle}</span>
      </span>
      {pending ? (
        <span className="text-[13px] text-muted">en cours</span>
      ) : failed || (!item.title && !temp) ? (
        <Link
          prefetch={false}
          href={board.editHref(item.ref)}
          onClick={onComplete}
          className={buttonClasses("rust-outline", 40, "px-4")}
        >
          Compléter
        </Link>
      ) : (
        <CircleCheck aria-label="Ajouté" size={22} strokeWidth={1.6} className="shrink-0 text-olive" />
      )}
    </li>
  );
}
