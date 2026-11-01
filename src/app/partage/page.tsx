import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { ShareTarget } from "@/components/share/ShareTarget";
import { Foliage } from "@/components/ui/Foliage";
import { SplitTitle } from "@/components/ui/SplitTitle";
import { sharedLine } from "@/lib/shareTarget";
import { unlockedLists } from "@/server/auth/session";

export const metadata: Metadata = {
  title: "Ajouter à une liste",
  robots: { index: false, follow: false },
};

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

/** Cible de partage (manifeste) : `/partage?url=…&title=…&text=…`. */
export default function SharePage({ searchParams }: PageProps<"/partage">) {
  return (
    <div className="on-dark relative isolate flex min-h-dvh flex-col overflow-clip tex-feuillage sm:items-center sm:justify-center sm:px-6 sm:py-16">
      <span aria-hidden="true" className="absolute inset-0 grain-overlay" />
      <Foliage className="top-20 left-[4%] hidden h-[760px] w-[300px] -scale-x-100 lg:block" />
      <div className="h-[120px] shrink-0 sm:hidden" aria-hidden="true" />
      <main className="relative flex flex-1 flex-col gap-6 rounded-t-sheet bg-paper px-5 pt-7 pb-10 text-ink sm:w-[560px] sm:flex-none sm:rounded-[32px] sm:border sm:border-white/60 sm:bg-paper/94 sm:px-12 sm:pt-11 sm:pb-10 sm:shadow-modal">
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 rounded-[inherit] opacity-50 grain-fine"
        />
        <SplitTitle
          as="h1"
          title="Ajouter à une liste"
          restColor="text-ochre"
          className="relative text-[38px] sm:text-[48px]"
        />
        <Suspense fallback={<div className="relative h-40" />}>
          <ShareContent searchParams={searchParams} />
        </Suspense>
      </main>
    </div>
  );
}

async function ShareContent({ searchParams }: Pick<PageProps<"/partage">, "searchParams">) {
  const params = await searchParams;
  const line = sharedLine({ url: first(params.url), text: first(params.text), title: first(params.title) });
  // Rien d'utilisable dans le partage : retour à l'accueil.
  if (!line) redirect("/");
  const lists = await unlockedLists();
  return <ShareTarget line={line} lists={lists} />;
}
