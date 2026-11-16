import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { MagicGame } from "@/components/magic/MagicGame";
import "@/components/magic/magic.css";
import { advanceMagic, buildMagicView } from "@/server/magic/game";
import { loadLutinContext } from "@/server/santa/db";
import { script } from "@/app/fonts";

export const metadata: Metadata = {
  title: "La Magie de Noël",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export const viewport: Viewport = { themeColor: "#0b1322" };

/** Univers propre au jeu : nuit d'hiver, neige, lumière dorée. */
function MagicShell({ children }: { children: ReactNode }) {
  return (
    <div className={`mg ${script.variable} relative isolate flex min-h-dvh flex-col overflow-clip`}>
      <span aria-hidden="true" className="mg-sky" />
      <span aria-hidden="true" className="mg-snow" />
      <header className="relative mx-auto flex h-[68px] w-full max-w-[1120px] items-center justify-between px-4 sm:h-20 sm:px-8">
        <span className="font-display-72 text-[24px] text-[var(--mg-gold-hi)] italic">Secret Santa</span>
      </header>
      <main className="relative mx-auto w-full max-w-[1120px] flex-1 px-4 pt-2 pb-20 sm:px-8">
        {children}
      </main>
    </div>
  );
}

export default function MagicRoute({ params }: PageProps<"/lutins/moi/[token]/jeu">) {
  return (
    <MagicShell>
      <Suspense fallback={<div className="h-96" aria-hidden="true" />}>
        <Game params={params} />
      </Suspense>
    </MagicShell>
  );
}

async function Game({ params }: Pick<PageProps<"/lutins/moi/[token]/jeu">, "params">) {
  const { token } = await params;
  const ctx = await loadLutinContext(token).catch(() => null);
  if (ctx) await advanceMagic(ctx.santa.id);
  const view = ctx ? await buildMagicView(ctx.santa.id, ctx.santa.title, ctx.me.id) : null;
  if (!view) {
    return (
      <div className="flex flex-col gap-3 pt-10">
        <h1 className="mg-title m-0 text-[38px] leading-tight font-normal">Le jeu n&apos;est pas ouvert.</h1>
        <p className="m-0 text-[16px] leading-normal text-[var(--mg-soft)]">
          Ce lien ne vaut plus, ou l&apos;organisation n&apos;a pas lancé La Magie de Noël.
        </p>
        <Link href="/lutins" className="mt-2 text-[15px] font-semibold text-[var(--mg-gold-hi)]">
          Retour au Secret Santa
        </Link>
      </div>
    );
  }
  return <MagicGame token={token} initial={view} />;
}
