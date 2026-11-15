"use client";

import { CircleAlert, Lock } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition, type FormEvent } from "react";
import { clearKeyFromHash, readKeyFromHash } from "@/components/access/UnlockGate";
import { Button } from "@/components/ui/Button";
import { PasswordField } from "@/components/ui/PasswordField";
import { unlockSanta } from "@/server/actions/santa";

/** Page d'organisation verrouillée : lien secret (`#cle=…`), sinon mot de passe. */
export function SantaUnlock({ santaId, title }: { santaId: string; title: string }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const key = readKeyFromHash();
    if (!key) return;
    clearKeyFromHash();
    startTransition(async () => {
      const result = await unlockSanta({ santaId, key });
      if (result.ok) router.refresh();
      else setError(result.error.message);
    });
  }, [router, santaId]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const result = await unlockSanta({ santaId, password });
      if (result.ok) router.refresh();
      else setError(result.error.message);
    });
  };

  return (
    <form onSubmit={submit} className="relative flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <span className="flex size-12 items-center justify-center rounded-full bg-ochre/12 text-ochre-deep">
          <Lock aria-hidden="true" size={20} strokeWidth={1.7} />
        </span>
        <h1 className="m-0 font-display-72 text-[34px] leading-tight font-normal sm:text-[42px]">{title}</h1>
        <p className="m-0 text-[15px] text-ink-soft">Saisissez le mot de passe de l&apos;organisation.</p>
      </div>
      <PasswordField
        id="santa-unlock"
        label="Mot de passe"
        autoComplete="current-password"
        autoFocus
        value={password}
        onChange={(e) => {
          setPassword(e.target.value);
          setError(null);
        }}
      />
      {error ? (
        <p role="alert" className="m-0 flex items-center gap-1.5 text-sm font-semibold text-rust">
          <CircleAlert aria-hidden="true" size={16} />
          {error}
        </p>
      ) : null}
      <Button type="submit" size={52} disabled={pending || !password}>
        Déverrouiller
      </Button>
    </form>
  );
}
