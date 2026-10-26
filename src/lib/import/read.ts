// Lecture d'un fichier à importer (docs/08-import-export.md) : .xlsx, .xls, .csv, .ods.
// SheetJS est chargé à la demande pour ne pas alourdir les autres pages.

export const MAX_FILE_BYTES = 5 * 1024 * 1024;
export const MAX_ROWS = 2000;

export type Sheet = {
  name: string;
  /** Lignes non vides, colonnes non vides retirées ; valeurs en texte formaté. */
  rows: string[][];
  /** Lien hypertexte de chaque cellule (même forme que `rows`). */
  links: (string | null)[][];
  /** Lettre d'origine de chaque colonne gardée (A, B…). */
  letters: string[];
};

export type ReadError = "format" | "size" | "empty" | "rows";

export const READ_ERRORS: Record<ReadError, string> = {
  format: "Ce format n'est pas lu. Utilisez .xlsx, .xls, .csv ou .ods.",
  size: "Fichier trop lourd (5 Mo max).",
  empty: "Ce fichier est vide.",
  rows: "Plus de 2 000 lignes : découpez le fichier.",
};

const EXTENSIONS = /\.(xlsx|xlsm|xls|csv|ods|tsv|txt)$/i;

// Octets 0x80–0x9F de Windows-1252 (certains environnements les décodent comme du latin-1).
const CP1252 = "€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ";

/** Texte d'un CSV : UTF-8 si c'en est (avec ou sans BOM), sinon Windows-1252. */
export function decodeCsv(bytes: Uint8Array): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes).replace(/^﻿/, "");
  } catch {
    let out = "";
    for (const b of bytes) out += b >= 0x80 && b <= 0x9f ? CP1252[b - 0x80] : String.fromCharCode(b);
    return out;
  }
}

/** Séparateur d'un CSV : `;`, `,` ou tabulation, le plus présent sur les premières lignes (hors guillemets). */
export function detectSeparator(text: string): string {
  const sample = text
    .split(/\r?\n/)
    .slice(0, 10)
    .join("\n")
    .replace(/"[^"]*"/g, "");
  const counts = [";", ",", "\t"].map((sep) => [sep, sample.split(sep).length - 1] as const);
  return counts.sort((a, b) => b[1] - a[1])[0]![1] > 0 ? counts[0]![0] : ",";
}

function columnLetter(i: number): string {
  let s = "";
  for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
}

type XLSXModule = typeof import("xlsx");

function sheetFrom(XLSX: XLSXModule, name: string, ws: import("xlsx").WorkSheet): Sheet {
  const raw = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1, raw: false, defval: "", blankrows: true });
  const range = ws["!ref"] ? XLSX.utils.decode_range(ws["!ref"]) : null;
  const rows: string[][] = [];
  const links: (string | null)[][] = [];
  raw.forEach((row, r) => {
    const values = row.map((v) => String(v ?? "").trim());
    if (!values.some(Boolean)) return;
    rows.push(values);
    links.push(
      values.map((_, c) => {
        if (!range) return null;
        const cell = ws[XLSX.utils.encode_cell({ r: range.s.r + r, c: range.s.c + c })] as
          { l?: { Target?: string } } | undefined;
        return cell?.l?.Target ?? null;
      }),
    );
  });
  const width = Math.max(0, ...rows.map((r) => r.length));
  const keep = Array.from({ length: width }, (_, c) => c).filter((c) =>
    rows.some((r) => (r[c] ?? "") !== ""),
  );
  const offset = range?.s.c ?? 0;
  return {
    name,
    rows: rows.map((r) => keep.map((c) => r[c] ?? "")),
    links: links.map((l) => keep.map((c) => l[c] ?? null)),
    letters: keep.map((c) => columnLetter(c + offset)),
  };
}

/** Lit toutes les feuilles. Erreur si le format, la taille ou le nombre de lignes ne vont pas. */
export async function readFile(
  bytes: Uint8Array,
  fileName: string,
): Promise<{ ok: true; sheets: Sheet[] } | { ok: false; error: ReadError }> {
  if (!EXTENSIONS.test(fileName)) return { ok: false, error: "format" };
  if (bytes.byteLength > MAX_FILE_BYTES) return { ok: false, error: "size" };
  const XLSX = await import("xlsx");
  let book: import("xlsx").WorkBook;
  try {
    if (/\.(csv|tsv|txt)$/i.test(fileName)) {
      const text = decodeCsv(bytes);
      book = XLSX.read(text, { type: "string", FS: detectSeparator(text), cellDates: true, raw: true });
    } else {
      book = XLSX.read(bytes, { type: "array", cellDates: true });
    }
  } catch {
    return { ok: false, error: "format" };
  }
  const sheets = book.SheetNames.map((name) => sheetFrom(XLSX, name, book.Sheets[name]!)).filter(
    (s) => s.rows.length > 0,
  );
  if (!sheets.length) return { ok: false, error: "empty" };
  if (sheets.some((s) => s.rows.length > MAX_ROWS + 1)) return { ok: false, error: "rows" };
  return { ok: true, sheets };
}
