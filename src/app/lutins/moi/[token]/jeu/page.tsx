import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { MagicGame } from "@/components/santa/MagicGame";
import { SantaShell } from "@/components/santa/SantaShell";
import { advanceMagic, buildMagicView } from "@/server/magic/game";
import { loadLutinContext } from "@/server/santa/db";

export const metadata: Metadata = {
  title: "La Magie de Noël",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default function MagicRoute({ params }: PageProps<"/lutins/moi/[token]/jeu">) {
  return (
    <SantaShell wide>
      <Suspense fallback={<div className="relative h-80" aria-hidden="true" />}>
        <Game params={params} />
      </Suspense>
    </SantaShell>
  );
}

async function Game({ params }: Pick<PageProps<"/lutins/moi/[token]/jeu">, "params">) {
  const { token } = await params;
  const ctx = await loadLutinContext(token).catch(() => null);
  if (ctx) await advanceMagic(ctx.santa.id);
  const view = ctx ? await buildMagicView(ctx.santa.id, ctx.santa.title, ctx.me.id) : null;
  if (!view) {
    return (
      <div className="relative flex flex-col gap-3">
        <h1 className="m-0 font-display-72 text-[34px] leading-tight font-normal">
          Le jeu n&apos;est pas ouvert.
        </h1>
        <p className="m-0 text-[15px] leading-normal text-ink-soft">
          Ce lien ne vaut plus, ou l&apos;organisation n&apos;a pas lancé La Magie de Noël.
        </p>
        <Link href="/" className="mt-2 text-[15px] font-semibold text-ink">
          Retour à l&apos;accueil
        </Link>
      </div>
    );
  }
  return <MagicGame token={token} initial={view} />;
}
