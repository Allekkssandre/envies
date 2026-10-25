"use client";

import { Check, Copy, KeyRound, Link as LinkIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/cn";
import { Button } from "./Button";

type LinkBoxProps = {
  label: string;
  hint: string;
  url: string;
  /** `secret` : fond ocre pâle, icône clé, bouton clair. */
  variant: "public" | "secret";
};

/** Lien à copier (lien public ou lien secret de modification). */
export function LinkBox({ label, hint, url, variant }: LinkBoxProps) {
  const [copied, setCopied] = useState(false);
  const secret = variant === "secret";
  const display = url.replace(/^https?:\/\//, "");

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(t);
  }, [copied]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast("Lien copié", { duration: 4000 });
    } catch {
      toast("Quelque chose n'a pas marché. Réessayez.", { duration: 4000 });
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <span className={cn("text-xs caps", secret ? "text-ochre-deep" : "text-muted")}>{label}</span>
      <div
        className={cn(
          "flex min-h-14 items-center gap-2.5 rounded-[18px] border py-1.5 pr-1.5 pl-4",
          secret ? "border-ochre/35 bg-ochre/12" : "border-ink/12 bg-white/62",
        )}
      >
        {secret ? (
          <KeyRound aria-hidden="true" size={18} strokeWidth={1.6} className="shrink-0 text-ochre-deep" />
        ) : (
          <LinkIcon aria-hidden="true" size={18} strokeWidth={1.6} className="shrink-0" />
        )}
        <span className="min-w-0 flex-1 truncate text-[15px] font-semibold" title={display}>
          {display}
        </span>
        <Button
          variant={secret ? "outline" : "ink"}
          size={44}
          className={cn("px-4", secret && "bg-white/60")}
          icon={copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
          onClick={() => void copy()}
          aria-label={`Copier : ${label}`}
        >
          Copier
        </Button>
      </div>
      <p className="m-0 text-[13px] leading-[1.45] text-muted">{hint}</p>
    </div>
  );
}
