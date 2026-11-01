"use client";

import { Lock } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { UnlockDialog } from "./UnlockGate";

/**
 * Liste privée sans accès : un mot sous le héros et la demande de mot de passe, ouverte
 * d'emblée. Une fois déverrouillée, l'action pose le cookie et Next rafraîchit la page.
 */
export function PrivateGate({ listId, title, ask = true }: { listId: string; title: string; ask?: boolean }) {
  const [open, setOpen] = useState(ask);
  return (
    <section
      aria-labelledby="private-title"
      className="relative mx-auto flex max-w-[520px] flex-col items-center gap-4 px-4 py-20 text-center text-ink sm:py-28"
    >
      <span aria-hidden="true" className="flex size-12 items-center justify-center rounded-full bg-ink/8">
        <Lock size={20} strokeWidth={1.6} />
      </span>
      <h2 id="private-title" className="m-0 font-note text-[26px] font-normal">
        Cette liste est privée.
      </h2>
      <p className="m-0 text-[15px] text-ink-soft">Son contenu demande le mot de passe.</p>
      {ask ? (
        <Button variant="ink" size={46} className="mt-2" onClick={() => setOpen(true)}>
          Déverrouiller
        </Button>
      ) : null}
      {open ? (
        <UnlockDialog
          purpose="view"
          listId={listId}
          title={title}
          initialProblem={null}
          onClose={() => setOpen(false)}
          onUnlocked={() => undefined}
        />
      ) : null}
    </section>
  );
}
