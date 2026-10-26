"use client";

import { FileSpreadsheet } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { buttonClasses } from "@/components/ui/Button";
import { Foliage } from "@/components/ui/Foliage";
import type { ListContent, ListInfo } from "@/types/models";
import { AddBar, DropImages } from "./AddBar";
import { MobileAddBar } from "./AddSheet";
import { BoardProvider, useBoard } from "./board";
import { EditSections } from "./EditSections";
import { Inbox } from "./Inbox";
import { SelectionBar } from "./SelectionBar";

/** Mode édition : barre d'ajout, « À trier », sections modifiables, sélection, ajout mobile. */
export function EditView({ list, content, hero }: { list: ListInfo; content: ListContent; hero: ReactNode }) {
  return (
    <BoardProvider list={list} content={content}>
      {hero}
      <EditMain />
    </BoardProvider>
  );
}

function EditMain() {
  const board = useBoard();
  return (
    <main className="relative" aria-busy={board.saving}>
      <AddBar />
      <DropImages />
      <Inbox />
      <EmptyOrSections />
      <SelectionBar />
      <MobileAddBar />
    </main>
  );
}

function EmptyOrSections() {
  const board = useBoard();
  if (board.items.length === 0 && board.categories.length === 0) {
    return (
      <div className="mx-auto flex max-w-[560px] flex-col items-center gap-3 px-6 py-20 text-center sm:py-28">
        <Foliage className="relative! h-[130px] w-[72px] stroke-ochre opacity-80" />
        <p className="m-0 font-display-72 text-[30px] leading-tight sm:text-[34px]">
          Collez un premier lien, <i className="font-light">ou écrivez un nom.</i>
        </p>
        <p className="m-0 text-[15px] text-ink-soft">
          La photo, la description et le prix arrivent tout seuls.
        </p>
        <Link
          href={`/l/${board.list.slug}/edition/importer`}
          className={buttonClasses("outline", 46, "mt-3")}
        >
          <FileSpreadsheet aria-hidden="true" />
          Importer un fichier Excel
        </Link>
      </div>
    );
  }
  return <EditSections />;
}
