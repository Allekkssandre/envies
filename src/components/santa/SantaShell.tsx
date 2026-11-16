import Link from "next/link";
import type { ReactNode } from "react";
import { Foliage } from "@/components/ui/Foliage";
import { cn } from "@/lib/cn";

/** Fond ambre texturé et panneau papier : toutes les pages du Secret Santa. */
export function SantaShell({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
  return (
    <div className="on-dark relative isolate flex min-h-dvh flex-col overflow-clip tex-ambre text-linen sm:items-center sm:px-6 sm:pb-16">
      <span aria-hidden="true" className="absolute inset-0 grain-overlay" />
      <Foliage className="top-24 left-[3%] hidden h-[760px] w-[300px] -scale-x-100 opacity-60 lg:block" />
      <header className="relative flex h-[76px] w-full max-w-[1080px] shrink-0 items-center justify-between px-4 sm:h-24 sm:px-0">
        <Link
          href="/lutins"
          className="inline-flex min-h-11 items-center font-display-72 text-[26px] text-linen italic no-underline sm:text-[30px]"
        >
          Secret Santa
        </Link>
      </header>
      <main
        className={cn(
          "relative flex flex-1 flex-col gap-8 rounded-t-sheet bg-paper px-4 pt-7 pb-14 text-ink sm:flex-none sm:rounded-[32px] sm:border sm:border-white/60 sm:bg-paper/95 sm:px-12 sm:pt-11 sm:pb-12 sm:shadow-modal",
          wide ? "sm:w-full sm:max-w-[1080px]" : "sm:w-[620px]",
        )}
      >
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 rounded-[inherit] opacity-50 grain-fine"
        />
        {children}
      </main>
    </div>
  );
}

/** Titre de section d'un panneau. */
export function SantaSection({
  title,
  hint,
  children,
  className,
}: {
  title: string;
  hint?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("relative flex flex-col gap-4", className)} aria-label={title}>
      <div className="flex flex-col gap-1 border-b border-ink/12 pb-3">
        <h2 className="m-0 font-display-72 text-[26px] leading-tight font-normal sm:text-[30px]">{title}</h2>
        {hint ? <p className="m-0 text-sm text-ink-soft">{hint}</p> : null}
      </div>
      {children}
    </section>
  );
}
