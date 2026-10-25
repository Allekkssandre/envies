"use client";

import { useSearchParams } from "next/navigation";
import { useCallback, useState } from "react";
import { parseFilters, serializeFilters, type Filters } from "@/lib/listFilters";

/** Filtres lus dans l'URL courante (lecture seule : la fiche s'en sert pour l'ordre affiché). */
export function useUrlFilters(): Filters {
  const params = useSearchParams();
  return parseFilters(new URLSearchParams(params.toString()));
}

/**
 * Filtres de la liste : état local, initialisé depuis l'URL, puis recopié dans l'URL
 * par `history.replaceState` (pas d'aller-retour serveur, pas de défilement).
 * L'état local répond tout de suite ; l'URL suit pour le partage et le retour arrière.
 */
export function useListFilters(): [Filters, (next: Filters) => void] {
  const params = useSearchParams();
  const [filters, setState] = useState(() => parseFilters(new URLSearchParams(params.toString())));

  const setFilters = useCallback((next: Filters) => {
    setState(next);
    const query = serializeFilters(next).toString();
    const url = `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`;
    // État `null` : Next reconnaît un appel externe et met à jour useSearchParams.
    window.history.replaceState(null, "", url);
  }, []);

  return [filters, setFilters];
}
