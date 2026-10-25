"use client";

import { Toaster as Sonner } from "sonner";

/** Messages éphémères : thème encre, action « Annuler » en miel clair. */
export function Toaster() {
  return (
    <Sonner
      position="bottom-center"
      duration={8000}
      toastOptions={{
        unstyled: true,
        classNames: {
          toast:
            "flex min-h-13 w-[min(92vw,420px)] items-center gap-2.5 rounded-field bg-ink py-1.5 pr-2 pl-4.5 text-sm text-linen shadow-ink",
          title: "flex-1",
          actionButton:
            "inline-flex h-10 items-center gap-2 rounded-full px-3 font-semibold text-honey-light",
        },
      }}
    />
  );
}
