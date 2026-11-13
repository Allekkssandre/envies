"use client";

import { Lock } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { unlockWithReadKey } from "@/server/actions/access";
import { clearKeyFromHash, readKeyFromHash, UnlockDialog, type Problem } from "./UnlockGate";

/**
 * Liste privée sans accès : un mot sous le héros et la demande de mot de passe. Arrivé par le
 * lien de lecture (`#acces=…`), la liste s'ouvre seule. Une fois déverrouillée, l'action pose
 * le cookie et Next rafraîchit la page.
 */
export function PrivateGate({ listId, title, ask = true }: { listId: string; title: string; ask?: boolean }) {
  const [phase, setPhase] = useState<"checking" | "closed" | "open">("checking");
  const [problem, setProblem] = useState<Problem | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const key = readKeyFromHash("acces");
    if (!key) {
      queueMicrotask(() => setPhase(ask ? "open" : "closed"));
      return;
    }
    clearKeyFromHash();
    void unlockWithReadKey({ listId, key }).then((result) => {
      // Succès : l'action pose le cookie, et Next rafraîchit alors la page tout seul.
      if (result.ok) return;
      setProblem({
        kind: result.error.code === "RATE_LIMITED" ? "rate" : "key",
        message: result.error.message,
      });
      setPhase(ask ? "open" : "closed");
    });
  }, [listId, ask]);

  return (
    <section
      aria-labelledby="private-title"
      aria-busy={phase === "checking"}
      className="relative mx-auto flex max-w-[520px] flex-col items-center gap-4 px-4 py-20 text-center text-ink sm:py-28"
    >
      <span aria-hidden="true" className="flex size-12 items-center justify-center rounded-full bg-ink/8">
        <Lock size={20} strokeWidth={1.6} />
      </span>
      <h2 id="private-title" className="m-0 font-note text-[26px] font-normal">
        {phase === "checking" ? "Ouverture…" : "Cette liste est privée."}
      </h2>
      {phase === "checking" ? null : (
        <p className="m-0 text-[15px] text-ink-soft">
          Son contenu s&apos;ouvre avec le lien de lecture ou le mot de passe.
        </p>
      )}
      {ask && phase === "closed" ? (
        <Button variant="ink" size={46} className="mt-2" onClick={() => setPhase("open")}>
          Déverrouiller
        </Button>
      ) : null}
      {phase === "open" ? (
        <UnlockDialog
          purpose="view"
          listId={listId}
          title={title}
          initialProblem={problem}
          onClose={() => setPhase("closed")}
          onUnlocked={() => undefined}
        />
      ) : null}
    </section>
  );
}
