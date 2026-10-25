import { Caps } from "@/components/ui/Chip";
import { Foliage } from "@/components/ui/Foliage";
import { SplitTitle } from "@/components/ui/SplitTitle";

/** Accueil provisoire : la liste des listes arrive au jalon 1. */
export default function HomePage() {
  return (
    <main className="on-dark relative flex min-h-dvh overflow-hidden tex-feuillage text-linen">
      <span aria-hidden="true" className="absolute inset-0 grain-overlay" />
      <Foliage className="top-5 right-[8%] h-[597px] w-[330px] max-sm:-right-24 max-sm:opacity-40" />
      <div className="relative mx-auto flex w-full max-w-[1320px] flex-col justify-end gap-4 px-4 pb-16 sm:px-12 sm:pb-24">
        <Caps tone="honey" size={13}>
          Listes d&apos;envies
        </Caps>
        <SplitTitle
          as="h1"
          title="Envies"
          italicIfSingle
          tracking="list"
          className="text-[112px] [text-shadow:0_14px_50px_rgb(10_12_4/0.45)] sm:text-[220px]"
        />
      </div>
    </main>
  );
}
