// Livres : un ISBN lu dans l'adresse (Amazon /dp/<ISBN-10>, …/9782290385646…) donne le titre
// et la couverture par Open Library, une base publique et ouverte, même quand la boutique
// refuse les robots. Pure, sauf `bookFromOpenLibrary` qui passe par la porte sécurisée.

import type { FetchJson } from "./types";

function validIsbn10(isbn: string): boolean {
  if (!/^\d{9}[\dX]$/.test(isbn)) return false;
  let sum = 0;
  for (let i = 0; i < 10; i++) sum += (isbn[i] === "X" ? 10 : Number(isbn[i])) * (10 - i);
  return sum % 11 === 0;
}

function validIsbn13(isbn: string): boolean {
  if (!/^97[89]\d{10}$/.test(isbn)) return false;
  let sum = 0;
  for (let i = 0; i < 13; i++) sum += Number(isbn[i]) * (i % 2 ? 3 : 1);
  return sum % 10 === 0;
}

const AMAZON = /(?:^|\.)amazon\.[a-z.]+$/;
const AMAZON_DP = /\/(?:dp|gp\/product|gp\/aw\/d)\/(\d{9}[\dX])(?:[/?]|$)/i;

/** ISBN d'un livre lu dans l'adresse, vérifié par sa clé de contrôle ; sinon null. */
export function isbnFromUrl(raw: string): string | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (AMAZON.test(url.hostname)) {
    const isbn10 = AMAZON_DP.exec(url.pathname)?.[1]?.toUpperCase();
    if (isbn10 && validIsbn10(isbn10)) return isbn10;
  }
  const text = decodeURIComponent(url.pathname + url.search).replace(/-(?=\d)/g, "");
  for (const match of text.matchAll(/(?<!\d)(97[89]\d{10})(?!\d)/g)) {
    if (validIsbn13(match[1]!)) return match[1]!;
  }
  return null;
}

export function openLibraryCover(isbn: string): string {
  return `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg?default=false`;
}

/** Titre (et sous-titre) d'Open Library ; couverture par ISBN. */
export async function bookFromOpenLibrary(
  isbn: string,
  fetchJson: FetchJson,
): Promise<{ title: string | null; images: string[] }> {
  const data = (await fetchJson(`https://openlibrary.org/isbn/${isbn}.json`).catch(() => null)) as {
    title?: unknown;
    subtitle?: unknown;
  } | null;
  const title = typeof data?.title === "string" ? data.title.trim() : "";
  const subtitle = typeof data?.subtitle === "string" ? data.subtitle.trim() : "";
  return {
    title: title ? (subtitle ? `${title} : ${subtitle}` : title).slice(0, 200) : null,
    images: [openLibraryCover(isbn)],
  };
}
