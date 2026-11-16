import type { Metadata } from "next";
import Link from "next/link";
import { after } from "next/server";
import { Suspense } from "react";
import { LutinPage } from "@/components/santa/LutinPage";
import { SantaShell } from "@/components/santa/SantaShell";
import { getServiceDb } from "@/server/db/client";
import { advanceMagic, magicTeaser } from "@/server/magic/game";
import { loadLutinContext, toLutinView } from "@/server/santa/db";

// Le lien personnel est la seule clé : jamais indexé, jamais transmis en référent.
export const metadata: Metadata = {
  title: { absolute: "Mon Secret Santa" },
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default function LutinRoute({ params }: PageProps<"/lutins/moi/[token]">) {
  return (
    <SantaShell>
      <Suspense fallback={<div className="relative h-80" aria-hidden="true" />}>
        <Lutin params={params} />
      </Suspense>
    </SantaShell>
  );
}

async function Lutin({ params }: Pick<PageProps<"/lutins/moi/[token]">, "params">) {
  const { token } = await params;
  const ctx = await loadLutinContext(token).catch(() => null);
  if (!ctx) {
    return (
      <div className="relative flex flex-col gap-3">
        <h1 className="m-0 font-display-72 text-[34px] leading-tight font-normal">
          Ce lien n&apos;est plus valable.
        </h1>
        <p className="m-0 text-[15px] leading-normal text-ink-soft">
          Le tirage a peut-être été refait, ou un nouveau lien vous a été envoyé. Regardez le dernier mail
          reçu, ou demandez à l&apos;organisation de vous le renvoyer.
        </p>
        <Link href="/lutins" className="mt-2 text-[15px] font-semibold text-ink">
          Retour au Secret Santa
        </Link>
      </div>
    );
  }
  if (!ctx.me.opened_at) {
    after(async () => {
      await getServiceDb()
        .from("santa_participants")
        .update({ opened_at: new Date().toISOString() })
        .eq("id", ctx.me.id)
        .is("opened_at", null);
    });
  }
  // Le jeu avance aussi d'ici : l'état affiché sur la page du tirage est à jour.
  await advanceMagic(ctx.santa.id);
  const game = await magicTeaser(ctx.santa.id, ctx.me.id).catch(() => null);
  return <LutinPage token={token} view={toLutinView(ctx)} game={game} />;
}
