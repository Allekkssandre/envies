"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { Check, CircleAlert, Clock, Lock, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, useTransition, type FormEvent } from "react";
import { Drawer } from "vaul";
import { Button } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";
import { PasswordField } from "@/components/ui/PasswordField";
import { DESKTOP_QUERY, useMediaQuery } from "@/hooks/useMediaQuery";
import { cn } from "@/lib/cn";
import { unlockWithKey, unlockWithPassword } from "@/server/actions/access";

type UnlockGateProps = { listId: string; slug: string; title: string };

type Problem = { kind: "wrong" | "rate" | "key" | "other"; message: string };

/** Lit `#cle=…` dans l'adresse (jamais envoyé au serveur avec la page). */
function readKeyFromHash(): string | null {
  const match = /(?:^|[#&])cle=([^&]+)/.exec(window.location.hash);
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

/** Efface le fragment de la barre d'adresse (et de l'historique). */
export function clearKeyFromHash() {
  if (window.location.hash) {
    window.history.replaceState(null, "", window.location.pathname + window.location.search);
  }
}

/**
 * Sans accès : tente le lien secret s'il y en a un, sinon (ou en cas d'échec) affiche
 * la demande de mot de passe par-dessus la liste.
 */
export function UnlockGate({ listId, slug, title }: UnlockGateProps) {
  const router = useRouter();
  const [phase, setPhase] = useState<"checking" | "ask">("checking");
  const [initialProblem, setInitialProblem] = useState<Problem | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const key = readKeyFromHash();
    if (!key) {
      queueMicrotask(() => setPhase("ask"));
      return;
    }
    clearKeyFromHash();
    void unlockWithKey({ listId, key }).then((result) => {
      // Succès : l'action pose le cookie, et Next rafraîchit alors la page tout seul.
      if (result.ok) return;
      setInitialProblem({
        kind: result.error.code === "RATE_LIMITED" ? "rate" : "key",
        message: result.error.message,
      });
      setPhase("ask");
    });
  }, [listId, router]);

  if (phase === "checking") return null;
  return (
    <UnlockDialog
      listId={listId}
      title={title}
      initialProblem={initialProblem}
      onClose={() => router.push(`/l/${slug}`)}
      onUnlocked={() => undefined}
    />
  );
}

type DialogProps = {
  listId: string;
  title: string;
  initialProblem: Problem | null;
  onClose: () => void;
  onUnlocked: () => void;
};

function UnlockDialog(props: DialogProps) {
  const isDesktop = useMediaQuery(DESKTOP_QUERY);
  const titleId = useId();
  if (isDesktop === null) return null;

  const onOpenChange = (open: boolean) => {
    if (!open) props.onClose();
  };

  if (isDesktop) {
    return (
      <Dialog.Root open onOpenChange={onOpenChange}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-[rgb(24_20_10/0.5)] backdrop-blur-[6px]" />
          <Dialog.Content
            aria-describedby={undefined}
            aria-labelledby={titleId}
            className="fixed top-1/2 left-1/2 z-50 w-[min(520px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-[30px] bg-paper/96 px-11 pt-10 pb-9 text-ink shadow-modal outline-none"
          >
            <span aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-50 grain-fine" />
            <Dialog.Close asChild>
              <IconButton variant="ghost" aria-label="Fermer" className="absolute top-5 right-5">
                <X aria-hidden="true" />
              </IconButton>
            </Dialog.Close>
            <UnlockForm {...props} titleId={titleId} TitleTag={Dialog.Title} />
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    );
  }

  return (
    <Drawer.Root open onOpenChange={onOpenChange}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-50 bg-[rgb(24_20_10/0.55)]" />
        <Drawer.Content
          aria-describedby={undefined}
          aria-labelledby={titleId}
          className="fixed inset-x-0 bottom-0 z-50 flex max-h-[96dvh] flex-col rounded-t-sheet bg-paper px-[18px] pt-3 pb-[max(20px,env(safe-area-inset-bottom))] text-ink outline-none"
        >
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 rounded-t-sheet opacity-50 grain-fine"
          />
          <Drawer.Handle className="relative mb-4 h-[5px]! w-11! bg-ink/22!" />
          <UnlockForm {...props} titleId={titleId} TitleTag={Drawer.Title} mobile />
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}

type FormProps = DialogProps & {
  titleId: string;
  TitleTag: typeof Dialog.Title;
  mobile?: boolean;
};

function UnlockForm({ listId, title, initialProblem, onUnlocked, titleId, TitleTag, mobile }: FormProps) {
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [problem, setProblem] = useState<Problem | null>(initialProblem);
  const [pending, startTransition] = useTransition();
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Focus sur le champ à l'ouverture (et au-dessus du clavier sur mobile, via vaul).
    const t = setTimeout(() => input.current?.focus(), 60);
    return () => clearTimeout(t);
  }, []);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (problem?.kind === "rate") return;
    startTransition(async () => {
      const result = await unlockWithPassword({ listId, password, remember });
      if (result.ok) {
        setProblem(null);
        onUnlocked();
        return;
      }
      const kind = result.error.code === "RATE_LIMITED" ? "rate" : result.error.field ? "wrong" : "other";
      setProblem({ kind, message: result.error.message });
      // Focus conservé, texte sélectionné : on retape directement.
      requestAnimationFrame(() => {
        input.current?.focus();
        input.current?.select();
      });
    });
  };

  const fieldError = problem && problem.kind !== "rate" ? problem.message : undefined;

  return (
    <form onSubmit={submit} className="relative flex flex-col gap-[22px]" noValidate>
      <span aria-hidden="true" className="flex size-12 items-center justify-center rounded-full bg-ink/8">
        <Lock size={20} strokeWidth={1.6} />
      </span>
      <div>
        <TitleTag
          id={titleId}
          className={cn(
            "m-0 font-display-72 leading-[1.05] font-normal",
            mobile ? "text-[34px]" : "text-[44px]",
          )}
        >
          Modifier <i className="font-light text-ochre">{title}</i>
        </TitleTag>
        <p className="m-0 mt-2 text-[15px] text-ink-soft">
          Le mot de passe a été choisi à la création de la liste.
        </p>
      </div>

      <PasswordField
        ref={input}
        label="Mot de passe pour modifier"
        autoComplete="current-password"
        enterKeyHint="go"
        value={password}
        onChange={(e) => {
          setPassword(e.target.value);
          if (problem?.kind === "wrong") setProblem(null);
        }}
        error={fieldError}
      />

      <label className="flex min-h-11 cursor-pointer items-center gap-3 text-[15px]">
        <input
          type="checkbox"
          checked={remember}
          onChange={(e) => setRemember(e.target.checked)}
          className="peer sr-only"
        />
        <span
          aria-hidden="true"
          className={cn(
            "flex size-6 shrink-0 items-center justify-center rounded-[7px] border transition-colors duration-180",
            "peer-focus-visible:outline-2 peer-focus-visible:outline-offset-3 peer-focus-visible:outline-ink",
            remember ? "border-ink bg-ink text-linen" : "border-line-strong bg-white/62",
          )}
        >
          {remember ? <Check size={15} strokeWidth={2.4} /> : null}
        </span>
        Rester déverrouillé sur cet appareil (30 jours)
      </label>

      {problem?.kind === "rate" ? (
        <p role="alert" className="m-0 -mt-2 flex items-center gap-1.5 text-sm font-semibold text-rust">
          <Clock aria-hidden="true" size={16} strokeWidth={2} />
          {problem.message}
        </p>
      ) : null}
      {problem?.kind === "other" && !fieldError ? (
        <p role="alert" className="m-0 -mt-2 flex items-center gap-1.5 text-sm font-semibold text-rust">
          <CircleAlert aria-hidden="true" size={16} strokeWidth={2} />
          {problem.message}
        </p>
      ) : null}

      <Button
        type="submit"
        variant="ink"
        size={56}
        className="w-full"
        disabled={pending || problem?.kind === "rate"}
      >
        Déverrouiller
      </Button>

      <p className="m-0 text-center text-[13px] leading-normal text-muted">
        Oublié ? Ouvrez le lien secret de modification reçu à la création, ou demandez-le à la personne qui a
        créé la liste.
      </p>
    </form>
  );
}
