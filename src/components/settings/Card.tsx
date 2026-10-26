"use client";

import type { ReactNode } from "react";
import { SplitTitle } from "@/components/ui/SplitTitle";
import { cn } from "@/lib/cn";
import type { Result } from "@/server/actions/result";

/** Enregistrement suivi par l'indicateur du héros ; message en cas d'échec. */
export type Track = <T>(run: () => Promise<Result<T>>) => Promise<Result<T> | null>;

/** Section des réglages : carte de verre clair (rouille pâle pour la suppression). */
export function Card({
  id,
  title,
  text,
  danger = false,
  children,
}: {
  id: string;
  title: string;
  text?: string;
  danger?: boolean;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      className={cn(
        "relative flex scroll-mt-6 flex-col gap-5 rounded-[30px] border p-5 shadow-[inset_0_1px_0_rgb(255_255_255/0.7),0_2px_6px_rgb(43_36_22/0.06),0_30px_60px_-30px_rgb(43_36_22/0.4)] backdrop-blur-[22px] lg:p-[34px]",
        danger ? "border-rust/20 bg-[rgb(232_214_200/0.7)]" : "border-white/55 bg-linen/75",
      )}
    >
      <div className="flex flex-col gap-1.5">
        <span id={`${id}-title`} className="contents">
          <SplitTitle
            title={title}
            restColor={danger ? "text-rust" : "text-ochre"}
            className="text-[34px] lg:text-[40px]"
          />
        </span>
        {text ? <p className="m-0 text-[13px] text-muted lg:text-sm">{text}</p> : null}
      </div>
      {children}
    </section>
  );
}
