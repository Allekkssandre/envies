"use client";

import { Lock, LockOpen } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";
import { cn } from "@/lib/cn";
import { lockDevice } from "@/server/actions/access";
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

/**
 * « Verrouiller cet appareil » (provisoire, en attendant les réglages du jalon 7) :
 * supprime le cookie puis réaffiche la demande de mot de passe.
 */
export function LockButton({ listId, dark, compact }: { listId: string; dark: boolean; compact?: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const lock = () =>
    startTransition(async () => {
      const result = await lockDevice({ listId });
      if (!result.ok) {
        toast(result.error.message, { duration: 4000 });
        return;
      }
      router.refresh();
    });

  if (compact) {
    return (
      <IconButton
        variant={dark ? "glass" : "outline"}
        aria-label="Verrouiller cet appareil"
        onClick={lock}
        disabled={pending}
      >
        <Lock aria-hidden="true" />
      </IconButton>
    );
  }
  return (
    <Button
      variant={dark ? "glass" : "outline"}
      icon={<Lock aria-hidden="true" />}
      onClick={lock}
      disabled={pending}
    >
      Verrouiller cet appareil
    </Button>
  );
}

/** Déjà déverrouillé mais arrivé par le lien secret : on efface quand même `#cle=…`. */
export function HashCleaner() {
  useEffect(() => {
    if (/(?:^|[#&])cle=/.test(window.location.hash)) clearKeyFromHash();
  }, []);
  return null;
}
