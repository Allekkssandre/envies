"use client";

import { ArrowLeft, ArrowRight, Check, ChevronDown, FileSpreadsheet, Heart, Info } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Button, buttonClasses } from "@/components/ui/Button";
import { SplitTitle } from "@/components/ui/SplitTitle";
import { cn } from "@/lib/cn";
import { formatPrice } from "@/lib/format";
import {
  assignTarget,
  detectHeader,
  guessColumns,
  TARGETS,
  type Guess,
  type Target,
} from "@/lib/import/columns";
import { convertRows, type ImportRow } from "@/lib/import/convert";
import { takePendingImport } from "@/lib/import/pendingFile";
import { READ_ERRORS, readFile, type Sheet } from "@/lib/import/read";
import { plural } from "@/lib/text";
import { importItems } from "@/server/actions/import";
import type { ListInfo } from "@/types/models";

// Import en 3 étapes (docs/08-import-export.md, maquettes ImportV4 et MImportV4).

type Props = { list: ListInfo; existingKeys: string[]; categories: string[]; tags: string[] };

type Loaded = { name: string; sheets: Sheet[] };
type Done = {
  created: number;
  duplicates: number;
  ignored: number;
  categories: string[];
  tags: string[];
  enrich: boolean;
};

const BATCH = 200;
const NETWORK_ERROR = "Pas enregistré. Vérifiez la connexion.";
const STEPS = ["Fichier", "Colonnes", "Vérifier"] as const;

const columnsOf = (rows: string[][], header: boolean) => {
  const body = header ? rows.slice(1) : rows;
  const width = rows[0]?.length ?? 0;
  return Array.from({ length: width }, (_, c) => body.map((r) => r[c] ?? ""));
};

export function ImportView({ list, existingKeys, categories, tags }: Props) {
  const router = useRouter();
  const editHref = `/l/${list.slug}/edition`;
  const [file, setFile] = useState<Loaded | null>(null);
  const [sheetIndex, setSheetIndex] = useState(0);
  const [headerRow, setHeaderRow] = useState(true);
  const [guess, setGuess] = useState<Guess | null>(null);
  const [enrich, setEnrich] = useState(true);
  const [sorted, setSorted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [done, setDone] = useState<Done | null>(null);

  const sheet = file?.sheets[sheetIndex] ?? null;

  const choose = (loaded: Loaded, index = 0) => {
    const s = loaded.sheets[index]!;
    const header = detectHeader(s.rows[0] ?? []);
    setFile(loaded);
    setSheetIndex(index);
    setHeaderRow(header);
    setGuess(guessColumns(headersOf(s, header), columnsOf(s.rows, header)));
  };

  const load = async (f: File) => {
    setError(null);
    const res = await readFile(new Uint8Array(await f.arrayBuffer()), f.name);
    if (!res.ok) {
      setError(READ_ERRORS[res.error]);
      return;
    }
    choose({ name: f.name, sheets: res.sheets });
  };

  // Fichier glissé sur la page d'édition.
  const loadRef = useRef(load);
  useEffect(() => {
    const pending = takePendingImport();
    if (pending) void loadRef.current(pending);
  }, []);

  const headers = sheet ? headersOf(sheet, headerRow) : [];
  const conversion = useMemo(
    () =>
      sheet && guess
        ? convertRows(sheet.rows, sheet.links, guess.targets, headers, {
            headerRow,
            listCurrency: list.currency,
            existingKeys: new Set(existingKeys),
            existingCategories: categories,
            existingTags: tags,
          })
        : null,
    // `headers` se déduit de `sheet` et `headerRow`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sheet, guess, headerRow, list.currency, existingKeys, categories, tags],
  );

  const runImport = async () => {
    if (!conversion || !guess) return;
    const rows = conversion.rows;
    const batches: ImportRow[][] = [];
    for (let i = 0; i < rows.length; i += BATCH) batches.push(rows.slice(i, i + BATCH));
    const totals: Done = {
      created: 0,
      duplicates: conversion.duplicates,
      ignored: conversion.empty,
      categories: [],
      tags: [],
      enrich: enrich && rows.some((r) => r.url),
    };
    setProgress({ done: 0, total: rows.length });
    // Chaque lot se place en tête de liste : du dernier au premier, l'ordre du fichier est gardé.
    for (const batch of batches.reverse()) {
      try {
        const r = await importItems({ listId: list.id, rows: batch, enrich, sorted });
        if (!r.ok) {
          toast(r.error.message, { duration: 6000 });
          if (r.error.code === "EDIT_LOCKED") router.refresh();
          break;
        }
        totals.created += r.data.created;
        totals.duplicates += r.data.duplicates;
        totals.ignored += r.data.ignored;
        totals.categories.push(...r.data.categoriesCreated);
        totals.tags.push(...r.data.tagsCreated);
      } catch {
        toast(NETWORK_ERROR, { duration: 8000 });
        break;
      }
      setProgress((p) => (p ? { ...p, done: p.done + batch.length } : p));
    }
    setProgress(null);
    if (totals.created > 0 || totals.duplicates > 0) setDone(totals);
  };

  const step = done ? 2 : file ? 1 : 0;
  const canImport =
    !!guess &&
    (guess.targets.includes("title") || guess.targets.includes("url")) &&
    !!conversion?.rows.length;

  return (
    <div className="relative isolate min-h-dvh overflow-x-clip bg-cream pb-28 text-ink lg:pb-16">
      <span aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 grain-fine" />
      <header>
        <Hero list={list} editHref={editHref} />
        <MobileHeader editHref={editHref} />

        <div className="relative z-10 mx-auto max-w-[1320px] px-4 lg:-mt-11 lg:px-12">
          <div className="flex flex-col gap-3 rounded-[26px] lg:flex-row lg:items-center lg:justify-between lg:gap-6 lg:border lg:border-white/55 lg:bg-linen/80 lg:py-3.5 lg:pr-3.5 lg:pl-7 lg:shadow-[inset_0_1px_0_rgb(255_255_255/0.7),0_2px_6px_rgb(43_36_22/0.08),0_30px_60px_-24px_rgb(43_36_22/0.45)] lg:backdrop-blur-[22px] lg:backdrop-saturate-[1.3]">
            <Steps current={step} />
            {file && sheet && !done ? (
              <FilePill
                name={file.name}
                sheets={file.sheets}
                sheetIndex={sheetIndex}
                rows={sheet.rows.length - (headerRow ? 1 : 0)}
                columns={sheet.rows[0]?.length ?? 0}
                onSheet={(i) => choose(file, i)}
                onChange={() => {
                  setFile(null);
                  setGuess(null);
                }}
              />
            ) : null}
          </div>
        </div>
      </header>

      <main className="relative mx-auto max-w-[1320px] px-4 pt-6 lg:px-12 lg:pt-12">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute top-0 -right-52 size-[900px] rounded-full bg-[radial-gradient(closest-side,rgb(214_160_70/0.2),rgb(214_160_70/0))] max-lg:hidden"
        />
        {done ? (
          <Summary done={done} slug={list.slug} />
        ) : !file || !sheet || !guess || !conversion ? (
          <FileStep onFile={(f) => void load(f)} error={error} />
        ) : (
          <div className="relative grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_420px] lg:gap-12">
            <section aria-labelledby="columns-title" className="flex min-w-0 flex-col gap-5">
              <div className="flex flex-col gap-1.5">
                <span id="columns-title" className="contents">
                  <SplitTitle
                    title="Les colonnes"
                    restColor="text-ochre"
                    className="text-[38px] lg:text-[52px]"
                  />
                </span>
                <p className="m-0 text-[15px] text-muted">
                  Les correspondances sont devinées d&apos;après les titres. Changez celles qui ne vont pas.
                </p>
              </div>
              <ColumnTable
                sheet={sheet}
                headers={headers}
                columns={columnsOf(sheet.rows, headerRow)}
                guess={guess}
                newCategories={conversion.newCategories}
                onTarget={(col, target) => setGuess((g) => (g ? assignTarget(g, col, target) : g))}
              />
              <SubmitBar
                count={conversion.rows.length}
                total={conversion.total}
                duplicates={conversion.duplicates}
                disabled={!canImport || !!progress}
                progress={progress}
                onSubmit={() => void runImport()}
                onBack={() => {
                  setFile(null);
                  setGuess(null);
                }}
              />
              {!canImport && !progress ? (
                <p role="alert" className="m-0 text-sm font-semibold text-rust">
                  Choisissez au moins une colonne Nom ou Lien.
                </p>
              ) : null}
            </section>
            <Preview
              rows={conversion.rows.slice(0, 3)}
              currency={list.currency}
              duplicates={conversion.duplicates}
              options={
                <>
                  <Option
                    checked={headerRow}
                    onChange={(v) => {
                      setHeaderRow(v);
                      setGuess(guessColumns(headersOf(sheet, v), columnsOf(sheet.rows, v)));
                    }}
                    label="La première ligne contient les titres"
                  />
                  <Option
                    checked={enrich}
                    onChange={setEnrich}
                    label="Compléter depuis les liens"
                    hint="Photo, description et prix manquant, en arrière-plan."
                  />
                  <Option
                    checked={sorted}
                    onChange={setSorted}
                    label="Ranger directement"
                    hint="Sinon, tout arrive dans « À trier »."
                  />
                </>
              }
            />
          </div>
        )}
      </main>
    </div>
  );
}

function headersOf(sheet: Sheet, header: boolean): string[] {
  return header
    ? (sheet.rows[0] ?? []).map((h, i) => h || `Colonne ${sheet.letters[i]}`)
    : sheet.letters.map((l) => `Colonne ${l}`);
}

// ---------------------------------------------------------------------------

function Hero({ list, editHref }: { list: ListInfo; editHref: string }) {
  return (
    <section className="relative hidden h-[300px] overflow-hidden tex-feuillage text-linen lg:block">
      <span aria-hidden="true" className="absolute inset-0 grain-overlay opacity-55 mix-blend-overlay" />
      <div className="relative mx-auto flex h-full max-w-[1320px] flex-col px-12">
        <div className="flex h-24 items-center justify-between">
          <Link
            href={editHref}
            className="inline-flex items-center gap-2 text-[15px] font-semibold text-linen no-underline"
          >
            <ArrowLeft aria-hidden="true" size={18} strokeWidth={1.7} />
            {list.title}
          </Link>
          <Link href={editHref} className={buttonClasses("glass", 44, "px-[18px] text-sm")}>
            Annuler
          </Link>
        </div>
        <div className="mt-auto flex items-end justify-between pb-20">
          <SplitTitle
            as="h1"
            title="Importer un fichier"
            tracking="list"
            leading="leading-[0.95]"
            className="text-[96px]"
          />
          <span className="pb-2.5 text-[15px] text-[#EADFC6]">Excel, CSV ou Numbers exporté</span>
        </div>
      </div>
    </section>
  );
}

function MobileHeader({ editHref }: { editHref: string }) {
  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-center px-3 pt-3 pb-2 lg:hidden">
      <Link
        href={editHref}
        aria-label="Retour à l'édition"
        className="flex size-11 items-center justify-center rounded-full border border-line-strong bg-white/45"
      >
        <ArrowLeft aria-hidden="true" size={19} strokeWidth={1.7} />
      </Link>
      <h1 className="m-0 text-base font-bold">Importer</h1>
      <Link
        href={editHref}
        className="justify-self-end px-2 py-3 text-[15px] font-semibold text-ink no-underline"
      >
        Annuler
      </Link>
    </div>
  );
}

function Steps({ current }: { current: number }) {
  return (
    <ol
      aria-label="Étapes"
      className="m-0 flex list-none items-center justify-center gap-2 p-0 lg:justify-start lg:gap-3.5"
    >
      {STEPS.map((label, i) => (
        <li
          key={label}
          aria-current={i === current ? "step" : undefined}
          className="flex items-center gap-2 lg:gap-3.5"
        >
          {i > 0 ? <span aria-hidden="true" className="h-px w-4 bg-ink/25 lg:w-10" /> : null}
          <span className="flex items-center gap-2 text-sm font-medium lg:text-[15px]">
            <span
              className={cn(
                "flex size-7 items-center justify-center rounded-full text-[13px] font-bold",
                i < current
                  ? "bg-olive text-linen"
                  : i === current
                    ? "bg-ink text-linen"
                    : "border border-ink/30 text-ink-soft",
              )}
            >
              {i < current ? <Check aria-hidden="true" size={15} strokeWidth={2.4} /> : i + 1}
            </span>
            <span className={cn(i === current ? "font-bold" : i > current ? "text-ink-soft" : undefined)}>
              {label}
            </span>
          </span>
        </li>
      ))}
    </ol>
  );
}

function FilePill(props: {
  name: string;
  sheets: Sheet[];
  sheetIndex: number;
  rows: number;
  columns: number;
  onSheet: (i: number) => void;
  onChange: () => void;
}) {
  return (
    <div className="flex items-center gap-3 rounded-[20px] border border-line bg-[rgb(222_212_190/0.6)] py-2.5 pr-2 pl-3 lg:bg-[rgb(222_212_190/0.55)]">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-olive text-linen">
        <FileSpreadsheet aria-hidden="true" size={20} strokeWidth={1.7} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <b className="truncate text-[15px]">{props.name}</b>
        <span className="text-[13px] text-muted">
          {plural(props.rows, "ligne", "lignes")} · {plural(props.columns, "colonne", "colonnes")}
        </span>
      </span>
      {props.sheets.length > 1 ? (
        <span className="relative">
          <select
            aria-label="Feuille"
            value={props.sheetIndex}
            onChange={(e) => props.onSheet(Number(e.target.value))}
            className="h-11 appearance-none rounded-[14px] border border-white bg-white pr-9 pl-4 text-[15px] font-semibold text-ink shadow-[0_1px_2px_rgb(43_36_22/0.1)]"
          >
            {props.sheets.map((s, i) => (
              <option key={s.name} value={i}>
                Feuille « {s.name} »
              </option>
            ))}
          </select>
          <ChevronDown
            aria-hidden="true"
            size={16}
            className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2"
          />
        </span>
      ) : null}
      <button type="button" onClick={props.onChange} className="min-h-11 px-3 text-sm font-semibold">
        Changer
      </button>
    </div>
  );
}

function FileStep({ onFile, error }: { onFile: (f: File) => void; error: string | null }) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  return (
    <div className="relative mx-auto flex max-w-[860px] flex-col gap-3">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          const f = e.dataTransfer.files[0];
          if (f) onFile(f);
        }}
        className={cn(
          "flex min-h-[280px] flex-col items-center justify-center gap-3 rounded-[28px] border-2 border-dashed px-6 py-10 text-center transition-colors",
          over ? "border-ochre bg-ochre/10" : "border-ink/25 bg-white/40",
        )}
      >
        <span className="flex size-16 items-center justify-center rounded-[18px] bg-olive/14 text-olive-deep">
          <FileSpreadsheet aria-hidden="true" size={30} strokeWidth={1.5} />
        </span>
        <p className="m-0 font-display-72 text-[26px] leading-tight lg:text-[30px]">
          Déposez un fichier ici, ou choisissez-le
        </p>
        <p className="m-0 text-sm text-muted">.xlsx, .xls, .csv, .ods · 5 Mo max</p>
        <Button variant="ink" size={52} className="mt-2" onClick={() => input.current?.click()}>
          Choisir un fichier
        </Button>
        <input
          ref={input}
          type="file"
          aria-label="Choisir un fichier"
          accept=".xlsx,.xls,.csv,.ods,.tsv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv,application/vnd.oasis.opendocument.spreadsheet"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f) onFile(f);
          }}
        />
      </div>
      {error ? (
        <p role="alert" className="m-0 text-center text-sm font-semibold text-rust">
          {error}
        </p>
      ) : null}
    </div>
  );
}

const HELP: Partial<Record<Target, string>> = {
  favorite: "oui, x, 1, ✓ comptent comme oui",
  tags: "séparés par des virgules",
};

function ColumnTable(props: {
  sheet: Sheet;
  headers: string[];
  columns: string[][];
  guess: Guess;
  newCategories: string[];
  onTarget: (col: number, target: Target) => void;
}) {
  const { sheet, headers, columns, guess } = props;
  return (
    <div role="table" aria-label="Correspondance des colonnes" className="flex flex-col max-lg:gap-3">
      <div
        role="row"
        className="hidden grid-cols-[200px_minmax(0,1fr)_36px_260px] gap-4 border-b border-ink/25 pb-2.5 lg:grid"
      >
        <span role="columnheader" className="text-xs caps text-muted">
          Colonne du fichier
        </span>
        <span role="columnheader" className="text-xs caps text-muted">
          Exemples
        </span>
        <span role="columnheader">
          <span className="sr-only">vers</span>
        </span>
        <span role="columnheader" className="text-xs caps text-muted">
          Devient
        </span>
      </div>
      {headers.map((header, col) => {
        const target = guess.targets[col] ?? "skip";
        const samples = (columns[col] ?? []).filter(Boolean).slice(0, 3);
        const help =
          target === "category" && props.newCategories.length
            ? `${plural(props.newCategories.length, "nouvelle", "nouvelles")} : ${props.newCategories.slice(0, 4).join(", ")}${props.newCategories.length > 4 ? "…" : ""}`
            : HELP[target];
        const id = `col-${col}`;
        return (
          <div
            key={col}
            role="row"
            className={cn(
              "grid gap-x-4 gap-y-2 max-lg:rounded-[22px] max-lg:border max-lg:border-white/60 max-lg:bg-white/50 max-lg:p-3.5 max-lg:shadow-[0_18px_30px_-24px_rgb(43_36_22/0.5)]",
              "grid-cols-[auto_minmax(0,1fr)] lg:grid-cols-[200px_minmax(0,1fr)_36px_260px] lg:items-center lg:border-b lg:border-ink/12 lg:py-3.5",
            )}
          >
            <span role="cell" className="flex min-w-0 items-center gap-2.5 max-lg:col-span-2">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-ink/8 text-xs font-bold">
                {sheet.letters[col]}
              </span>
              <b
                id={id}
                className={cn(
                  "max-w-[60%] shrink-0 truncate text-[15px] lg:max-w-none lg:shrink",
                  target === "skip" && "font-semibold text-muted",
                )}
              >
                {header}
              </b>
              <span className="min-w-0 truncate text-[13px] text-muted lg:hidden">{samples.join(" · ")}</span>
            </span>
            <span role="cell" className="hidden min-w-0 flex-col gap-0.5 text-[13px] text-muted lg:flex">
              {samples.map((s, i) => (
                <span key={i} className="truncate">
                  {s}
                </span>
              ))}
            </span>
            <span role="cell" aria-hidden="true" className="flex items-center text-muted max-lg:pl-1">
              <ArrowRight size={18} strokeWidth={1.7} />
            </span>
            <span role="cell" className="flex min-w-0 flex-col gap-1.5">
              <span className="relative">
                <select
                  aria-labelledby={`${id} ${id}-to`}
                  value={target}
                  onChange={(e) => props.onTarget(col, e.target.value as Target)}
                  className={cn(
                    "h-[52px] w-full appearance-none rounded-field border border-ink/16 pr-28 pl-4 text-base font-medium shadow-[inset_0_1px_2px_rgb(43_36_22/0.06)]",
                    target === "skip" ? "bg-white/40 text-muted" : "bg-white/80 text-ink",
                  )}
                >
                  {TARGETS.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
                <span id={`${id}-to`} className="sr-only">
                  devient
                </span>
                {guess.guessed[col] ? (
                  <span className="pointer-events-none absolute top-1/2 right-10 -translate-y-1/2 rounded-full bg-olive/14 px-2 py-0.5 text-xs font-semibold text-olive-deep">
                    deviné
                  </span>
                ) : null}
                <ChevronDown
                  aria-hidden="true"
                  size={16}
                  className="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2"
                />
              </span>
              {help ? <span className="text-[13px] text-ink-soft">{help}</span> : null}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function SubmitBar(props: {
  count: number;
  total: number;
  duplicates: number;
  disabled: boolean;
  progress: { done: number; total: number } | null;
  onSubmit: () => void;
  onBack: () => void;
}) {
  const label = props.progress
    ? `Import… ${props.progress.done} / ${props.progress.total}`
    : `Importer ${plural(props.count, "article", "articles")}`;
  const math = `${plural(props.total, "ligne", "lignes")} − ${plural(props.duplicates, "doublon", "doublons")}`;
  return (
    <>
      <div className="hidden items-center gap-3 pt-2.5 lg:flex">
        <Button
          variant="ink"
          size={58}
          className="px-8"
          disabled={props.disabled}
          onClick={props.onSubmit}
          iconRight={props.progress ? undefined : <ArrowRight aria-hidden="true" />}
        >
          {label}
        </Button>
        <Button variant="ghost" size={58} onClick={props.onBack} disabled={!!props.progress}>
          Retour
        </Button>
        <span className="text-[13px] text-muted" aria-live="polite">
          {math}
        </span>
      </div>
      <div className="fixed inset-x-0 bottom-0 z-30 flex flex-col gap-2 bg-[linear-gradient(rgb(243_237_226/0),#F3EDE2_30%)] px-4 pt-6 pb-[max(20px,env(safe-area-inset-bottom))] lg:hidden">
        <span className="text-center text-sm text-muted">{math}</span>
        <Button variant="ink" size={58} className="w-full" disabled={props.disabled} onClick={props.onSubmit}>
          {label}
        </Button>
      </div>
    </>
  );
}

function Option(props: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  return (
    <label className="flex min-h-11 cursor-pointer items-start gap-3 pt-1">
      <input
        type="checkbox"
        checked={props.checked}
        onChange={(e) => props.onChange(e.target.checked)}
        className="peer sr-only"
      />
      <span
        aria-hidden="true"
        className={cn(
          "flex size-6 shrink-0 items-center justify-center rounded-[7px] peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ochre",
          props.checked ? "bg-ink text-linen" : "border-[1.5px] border-ink/35",
        )}
      >
        {props.checked ? <Check size={15} strokeWidth={2.4} /> : null}
      </span>
      <span className="flex flex-col gap-0.5">
        <span className="text-[15px] font-semibold">{props.label}</span>
        {props.hint ? <span className="text-[13px] text-muted">{props.hint}</span> : null}
      </span>
    </label>
  );
}

function Preview(props: { rows: ImportRow[]; currency: string; duplicates: number; options: ReactNode }) {
  return (
    <aside
      aria-labelledby="preview-title"
      className="relative flex flex-col gap-3.5 rounded-[28px] border border-white/55 bg-linen/80 p-[22px] shadow-[inset_0_1px_0_rgb(255_255_255/0.7),0_2px_6px_rgb(43_36_22/0.08),0_30px_60px_-24px_rgb(43_36_22/0.45)] backdrop-blur-[22px] backdrop-saturate-[1.3] lg:sticky lg:top-6 lg:p-[26px]"
    >
      <div className="flex items-baseline justify-between">
        <h2
          id="preview-title"
          className="m-0 font-display-72 text-[34px] leading-none font-normal tracking-[-0.02em]"
        >
          Aperçu
        </h2>
        <span className="text-[13px] text-muted">3 premières lignes</span>
      </div>
      {props.rows.map((row, i) => {
        const name = row.title || (row.url ? row.url.replace(/^https?:\/\/(www\.)?/, "") : "");
        const meta = [row.category, row.url || row.imageUrl ? "photo à venir" : null]
          .filter(Boolean)
          .join(" · ");
        return (
          <div
            key={i}
            className="flex items-center gap-3.5 rounded-[18px] border border-ink/12 bg-white/55 p-2.5"
          >
            <span className="relative w-[84px] shrink-0">
              <span className="flex h-[84px] items-center justify-center overflow-hidden rounded-[14px] shadow-[inset_0_0_0_1px_rgb(167_106_25/0.18),0_18px_30px_-18px_rgb(60_40_10/0.4)] tex-initial">
                <span
                  aria-hidden="true"
                  className="font-display text-[46px] leading-none font-light text-ochre/55 italic"
                >
                  {name.charAt(0).toLocaleUpperCase("fr-FR") || "?"}
                </span>
              </span>
              {row.isFavorite ? (
                <span className="absolute top-2 right-2 flex size-[30px] items-center justify-center rounded-full bg-linen/85">
                  <Heart aria-label="Coup de cœur" size={15} className="fill-rust text-rust" />
                </span>
              ) : null}
            </span>
            <span className="flex min-w-0 flex-col gap-0.5">
              <b className="truncate text-[15px] font-semibold">{name}</b>
              {row.priceCents != null ? (
                <span className="font-display text-lg">
                  {formatPrice(row.priceCents, row.currency ?? props.currency)}
                </span>
              ) : null}
              {meta ? <span className="truncate text-xs text-muted">{meta}</span> : null}
            </span>
          </div>
        );
      })}
      <div className="mt-2 flex flex-col gap-1.5 border-t border-ink/12 pt-4">{props.options}</div>
      {props.duplicates > 0 ? (
        <p className="m-0 flex items-start gap-2 text-[13px] leading-[1.45] text-ink-soft">
          <Info aria-hidden="true" size={16} strokeWidth={1.7} className="mt-px shrink-0" />
          {props.duplicates === 1
            ? "1 ligne a un lien déjà présent dans la liste : elle sera ignorée."
            : `${props.duplicates} lignes ont un lien déjà présent dans la liste : elles seront ignorées.`}
        </p>
      ) : null}
    </aside>
  );
}

function Summary({ done, slug }: { done: Done; slug: string }) {
  const details = [
    done.duplicates ? plural(done.duplicates, "doublon ignoré", "doublons ignorés") : null,
    done.ignored ? plural(done.ignored, "ligne vide ignorée", "lignes vides ignorées") : null,
    done.categories.length
      ? `${plural(done.categories.length, "catégorie créée", "catégories créées")} : ${done.categories.join(", ")}`
      : null,
    done.tags.length ? plural(done.tags.length, "tag créé", "tags créés") : null,
  ].filter(Boolean);
  return (
    <section
      aria-labelledby="done-title"
      className="relative mx-auto flex max-w-[720px] flex-col items-center gap-4 py-10 text-center"
    >
      <span className="flex size-16 items-center justify-center rounded-full bg-olive text-linen">
        <Check aria-hidden="true" size={30} strokeWidth={2} />
      </span>
      <h2
        id="done-title"
        className="m-0 font-display-72 text-[40px] leading-tight font-normal lg:text-[52px]"
      >
        {plural(done.created, "article importé", "articles importés")}
      </h2>
      {details.length ? <p className="m-0 text-[15px] text-ink-soft">{details.join(" · ")}</p> : null}
      {done.enrich ? (
        <p className="m-0 text-[15px] text-muted">
          Les photos et les prix arrivent depuis les liens, en arrière-plan.
        </p>
      ) : null}
      <div className="mt-4 flex flex-wrap justify-center gap-3">
        <Link href={`/l/${slug}/edition`} className={buttonClasses("outline", 52)}>
          Voir les articles à trier
        </Link>
        <Link href={`/l/${slug}/edition/trier`} className={buttonClasses("ink", 52)}>
          Trier maintenant
        </Link>
      </div>
    </section>
  );
}
