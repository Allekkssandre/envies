import { Plus } from "lucide-react";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { HomeBrowser } from "@/components/home/HomeBrowser";
import { SiteFooter } from "@/components/list/SiteFooter";
import { buttonClasses } from "@/components/ui/Button";
import { Caps } from "@/components/ui/Chip";
import { Foliage, Halo } from "@/components/ui/Foliage";
import { plural } from "@/lib/text";
import { getListSummaries } from "@/server/db/lists";

export default function HomePage() {
  return (
    <div className="relative isolate min-h-dvh overflow-clip pb-28 sm:pb-0">
      <header className="on-dark relative h-[330px] overflow-hidden tex-feuillage text-linen sm:h-[640px]">
        <span aria-hidden="true" className="absolute inset-0 grain-overlay opacity-60" />
        <Foliage className="top-[30px] left-[4%] hidden h-[640px] w-[380px] -scale-x-100 opacity-50 lg:block" />
        <div className="relative mx-auto flex h-full max-w-[1320px] flex-col px-4 sm:px-12">
          <div className="hidden h-24 items-center justify-end sm:flex">
            <Link href="/nouvelle" className={buttonClasses("linen", 46)}>
              <Plus aria-hidden="true" />
              Nouvelle liste
            </Link>
          </div>
          <div className="flex flex-1 flex-col items-center justify-center gap-1.5 text-center sm:mt-10 sm:flex-none sm:justify-start sm:gap-3.5">
            <Caps tone="honey" size={11} className="tracking-[0.22em] sm:text-[13px]">
              Listes d&apos;envies
            </Caps>
            <h1 className="m-0 font-display text-[112px] leading-[0.95] font-light tracking-[-0.03em] italic [text-shadow:0_16px_60px_rgb(10_12_4/0.5)] sm:text-[220px]">
              Envies
            </h1>
            <Suspense fallback={<span className="h-6 text-sm sm:text-base">&nbsp;</span>}>
              <ListCount />
            </Suspense>
          </div>
        </div>
      </header>

      <Halo tone="ochre" strength={0.2} className="top-[620px] -right-[240px]" />
      <Halo tone="olive" strength={0.15} className="top-[1300px] -left-[300px]" />

      <main className="relative mx-auto max-w-[1320px] px-4 pb-10 sm:px-12 sm:pb-[120px]">
        <Suspense fallback={<HomeSkeleton />}>
          <HomeLists />
        </Suspense>
      </main>

      <div className="hidden sm:block">
        <SiteFooter href="/nouvelle" label="Nouvelle liste" />
      </div>
    </div>
  );
}

async function ListCount() {
  const lists = await getListSummaries();
  return (
    <span className="text-sm text-[#EADFC6] sm:text-base">{plural(lists.length, "liste", "listes")}</span>
  );
}

async function HomeLists() {
  const lists = await getListSummaries();
  await connection();
  return <HomeBrowser lists={lists} now={new Date().toISOString()} />;
}

/** Squelettes des cartes et des rangées (crème plus foncé, sans animation). */
function HomeSkeleton() {
  return (
    <div aria-hidden="true">
      <div className="relative z-10 mx-auto -mt-[26px] max-w-[640px] sm:-mt-9 sm:px-6">
        <div className="h-[52px] rounded-full glass-light sm:h-[60px]" />
      </div>
      <div className="hidden grid-cols-[repeat(auto-fill,minmax(min(360px,100%),1fr))] gap-x-8 gap-y-14 pt-20 sm:grid">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex flex-col gap-4">
            <div className="h-[300px] rounded-[22px] bg-[#E8DFCF]" />
            <div className="h-4 w-24 rounded bg-[#E8DFCF]" />
            <div className="h-3 w-40 rounded bg-[#E8DFCF]" />
          </div>
        ))}
      </div>
      <div className="flex flex-col pt-[18px] sm:hidden">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex min-h-[92px] items-center gap-3.5 border-b border-ink/10">
            <div className="size-[68px] rounded-field bg-[#E8DFCF]" />
            <div className="flex flex-1 flex-col gap-2">
              <div className="h-6 w-40 rounded bg-[#E8DFCF]" />
              <div className="h-3 w-28 rounded bg-[#E8DFCF]" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
