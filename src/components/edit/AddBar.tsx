"use client";

import { ImageIcon, Plus, X } from "lucide-react";
import { useEffect, useRef, useState, type ClipboardEvent, type KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Kbd } from "@/components/ui/Kbd";
import { cn } from "@/lib/cn";
import { setPendingImport, SPREADSHEET } from "@/lib/import/pendingFile";
import { useBoard } from "./board";

/** Lignes non vides d'un texte collé ou saisi. */
export const splitLines = (text: string) =>
  text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

/**
 * Barre d'ajout desktop : chevauche le héros puis reste collée en haut.
 * Entrée ajoute et vide le champ ; un collage de plusieurs lignes ajoute un article par ligne.
 */
export function AddBar() {
  const board = useBoard();
  const [text, setText] = useState("");
  const field = useRef<HTMLTextAreaElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const target = board.addTarget;

  useEffect(() => {
    field.current?.focus({ preventScroll: true });
  }, []);
  useEffect(() => {
    if (target) field.current?.focus();
  }, [target]);

  const submit = (value = text) => {
    const lines = splitLines(value);
    if (!lines.length) return;
    setText("");
    void board.addLines(lines, target?.id ?? null);
    field.current?.focus();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      submit();
    }
    if (e.key === "Escape" && target) board.setAddTarget(null);
  };

  const onPaste = (e: ClipboardEvent<HTMLTextAreaElement>) => {
    const pasted = e.clipboardData.getData("text");
    if (splitLines(pasted).length > 1) {
      e.preventDefault();
      submit([text, pasted].filter(Boolean).join("\n"));
    }
  };

  return (
    <div className="sticky top-3 z-30 mx-auto -mt-16 hidden max-w-[1320px] px-12 lg:block">
      <div className="rounded-[30px] p-3.5 glass-light">
        <div className="flex min-h-[76px] items-center gap-3 rounded-[22px] border-2 border-ink bg-white/75 py-2.5 pr-2.5 pl-6 shadow-[0_0_0_5px_rgb(167_106_25/0.18)]">
          <Plus aria-hidden="true" size={22} strokeWidth={1.6} className="shrink-0" />
          {target ? (
            <span className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-ink/8 pr-1 pl-3 text-sm font-semibold">
              dans {target.name}
              <button
                type="button"
                aria-label="Ajouter sans catégorie"
                onClick={() => board.setAddTarget(null)}
                className="flex size-7 items-center justify-center rounded-full hover:bg-ink/10"
              >
                <X aria-hidden="true" size={14} strokeWidth={2} />
              </button>
            </span>
          ) : null}
          <label htmlFor="add-field" className="sr-only">
            Collez un lien, ou écrivez un nom
          </label>
          <textarea
            ref={field}
            id="add-field"
            rows={1}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={onKeyDown}
            onPaste={onPaste}
            placeholder="Collez un lien, ou écrivez un nom"
            autoComplete="off"
            className="[field-sizing:content] max-h-40 min-w-0 flex-1 resize-none border-0 bg-transparent py-1 font-display-72 text-[28px] leading-tight text-ink outline-none placeholder:text-placeholder focus-visible:outline-none"
          />
          <Button
            variant="ghost"
            icon={<ImageIcon aria-hidden="true" />}
            onClick={() => fileInput.current?.click()}
          >
            Photo
          </Button>
          <Button variant="ink" size={56} className="px-7" onClick={() => submit()}>
            Ajouter
          </Button>
          <input
            ref={fileInput}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) void board.addPhoto(file, target?.id ?? null);
            }}
          />
        </div>
        <p className="m-0 flex flex-wrap items-center gap-x-6 gap-y-1 px-2 pt-3 text-[13px] text-muted">
          <span className="inline-flex items-center gap-2">
            <Kbd>Entrée</Kbd> ajoute et vide le champ
          </span>
          <span className="inline-flex items-center gap-2">
            <Kbd>⌘</Kbd>
            <Kbd>V</Kbd> plusieurs liens collés : un article par ligne
          </span>
          <span className="inline-flex items-center gap-2">
            <ImageIcon aria-hidden="true" size={14} strokeWidth={1.7} /> glissez une image ou un fichier Excel
            n&apos;importe où
          </span>
        </p>
      </div>
    </div>
  );
}

/** Zone de dépôt : une image glissée n'importe où sur la page devient un article (desktop). */
export function DropImages() {
  const board = useBoard();
  const router = useRouter();
  const [over, setOver] = useState(false);
  useEffect(() => {
    let depth = 0;
    const hasFiles = (e: DragEvent) => Array.from(e.dataTransfer?.types ?? []).includes("Files");
    const enter = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      depth++;
      setOver(true);
    };
    const leave = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      depth = Math.max(0, depth - 1);
      if (depth === 0) setOver(false);
    };
    const dragOver = (e: DragEvent) => {
      if (hasFiles(e)) e.preventDefault();
    };
    const drop = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth = 0;
      setOver(false);
      const files = Array.from(e.dataTransfer?.files ?? []);
      // Un tableur ouvre l'import, avec ce fichier.
      const sheet = files.find((f) => SPREADSHEET.test(f.name));
      if (sheet) {
        setPendingImport(sheet);
        router.push(`/l/${board.list.slug}/edition/importer`);
        return;
      }
      for (const file of files.filter((f) => f.type.startsWith("image/"))) {
        void board.addPhoto(file, board.addTarget?.id ?? null);
      }
    };
    window.addEventListener("dragenter", enter);
    window.addEventListener("dragleave", leave);
    window.addEventListener("dragover", dragOver);
    window.addEventListener("drop", drop);
    return () => {
      window.removeEventListener("dragenter", enter);
      window.removeEventListener("dragleave", leave);
      window.removeEventListener("dragover", dragOver);
      window.removeEventListener("drop", drop);
    };
  }, [board, router]);

  return (
    <div
      aria-hidden="true"
      className={cn(
        "pointer-events-none fixed inset-3 z-[60] rounded-[30px] border-2 border-dashed border-ochre bg-ochre/10 transition-opacity duration-180",
        over ? "opacity-100" : "opacity-0",
      )}
    />
  );
}
