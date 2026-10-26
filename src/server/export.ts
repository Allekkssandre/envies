import "server-only";
import * as XLSX from "xlsx";
import { imageUrl } from "@/lib/imageUrl";
import { byPosition } from "@/lib/positions";
import { sortCategories } from "@/lib/listFilters";
import type { ListContent, ListInfo } from "@/types/models";

// Export d'une liste en .xlsx (docs/08-import-export.md, « Export ») : mêmes titres de colonnes
// que ceux reconnus par l'import, pour pouvoir modifier le fichier puis le réimporter.

export const EXPORT_HEADERS = [
  "Nom",
  "Lien",
  "Prix",
  "Devise",
  "Catégorie",
  "Tags",
  "Coup de cœur",
  "Note",
  "Photo",
  "Ajouté le",
] as const;

const WIDTHS = [40, 50, 10, 8, 22, 28, 13, 40, 60, 12];

/** Nom du fichier : `envies-<slug>-<AAAA-MM-JJ>.xlsx`. */
export function exportFileName(slug: string, now = new Date()): string {
  return `envies-${slug}-${now.toISOString().slice(0, 10)}.xlsx`;
}

/** Catégories dans l'ordre, puis « Non classé » ; articles par position. */
export function buildWorkbook(list: ListInfo, content: ListContent): Buffer {
  const categories = sortCategories(content.categories);
  const tagNames = new Map(content.tags.map((t) => [t.id, t.name]));
  const order = [...categories.map((c) => c.id as string | null), null];
  const byCategory = new Map(categories.map((c) => [c.id, c.name]));
  const items = [...content.items]
    .sort(byPosition)
    .sort((a, b) => order.indexOf(a.categoryId) - order.indexOf(b.categoryId));

  const rows: (string | number | Date | null)[][] = [
    [...EXPORT_HEADERS],
    ...items.map((i) => [
      i.title ?? "",
      i.url ?? "",
      i.priceCents != null ? i.priceCents / 100 : null,
      i.priceCents != null ? (i.currency ?? list.currency) : "",
      i.categoryId ? (byCategory.get(i.categoryId) ?? "") : "",
      i.tagIds
        .map((id) => tagNames.get(id))
        .filter(Boolean)
        .join(", "),
      i.isFavorite ? "oui" : "",
      i.note ?? "",
      i.imagePath ? imageUrl(i.imagePath, 1200) : "",
      new Date(i.createdAt),
    ]),
  ];
  const ws = XLSX.utils.aoa_to_sheet(rows, { cellDates: true });
  // Prix au format « 1 299,00 » (le séparateur suit la langue d'Excel), dates en jour/mois/année.
  for (let r = 1; r < rows.length; r++) {
    const price = ws[XLSX.utils.encode_cell({ r, c: 2 })] as XLSX.CellObject | undefined;
    if (price && price.t === "n") price.z = "#,##0.00";
    const date = ws[XLSX.utils.encode_cell({ r, c: 9 })] as XLSX.CellObject | undefined;
    if (date) date.z = "dd/mm/yyyy";
  }
  ws["!cols"] = WIDTHS.map((wch) => ({ wch }));
  ws["!autofilter"] = {
    ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: rows.length - 1, c: WIDTHS.length - 1 } }),
  };
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Liste");
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx", compression: true }) as Buffer;
}
