// Fichier glissé sur la page d'édition : gardé en mémoire le temps d'ouvrir l'import.

let pending: File | null = null;

export const SPREADSHEET = /\.(xlsx|xlsm|xls|csv|ods|tsv)$/i;

export function setPendingImport(file: File): void {
  pending = file;
}

/** Le fichier en attente, une seule fois. */
export function takePendingImport(): File | null {
  const file = pending;
  pending = null;
  return file;
}
