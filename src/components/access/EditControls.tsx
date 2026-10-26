"use client";

import { LockOpen } from "lucide-react";
import { useEffect } from "react";
import { cn } from "@/lib/cn";
import { clearKeyFromHash } from "./UnlockGate";

/** Pastille « Mode édition » (cadenas ouvert, fond ocre translucide). */
export function EditBadge({ dark }: { dark: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-[13px] font-bold backdrop-blur-[12px]",
        dark ? "border-honey-light/40 bg-ochre/30 text-linen" : "border-ochre/40 bg-ochre/15 text-ochre-deep",
      )}
    >
      <LockOpen aria-hidden="true" size={15} strokeWidth={1.8} />
      Mode édition
    </span>
  );
}

/** Déjà déverrouillé mais arrivé par le lien secret : on efface quand même `#cle=…`. */
export function HashCleaner() {
  useEffect(() => {
    if (/(?:^|[#&])cle=/.test(window.location.hash)) clearKeyFromHash();
  }, []);
  return null;
}
