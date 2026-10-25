import Link from "next/link";
import { buttonClasses } from "@/components/ui/Button";
import { Foliage } from "@/components/ui/Foliage";

/** Écran « Introuvable » (EtatsV4). */
export function NotFoundView() {
  return (
    <main className="on-dark relative flex min-h-dvh items-center justify-center overflow-hidden tex-feuillage px-4 text-linen">
      <span aria-hidden="true" className="absolute inset-0 grain-overlay" />
      <Foliage className="top-10 right-[5%] hidden h-[760px] w-[420px] lg:block" />
      <div className="relative flex flex-col items-center gap-4 text-center">
        <h1 className="m-0 font-display text-[72px] leading-none font-normal tracking-[-0.03em] [text-shadow:0_14px_50px_rgb(10_12_4/0.45)] sm:text-[120px]">
          Introu<i className="font-light">vable</i>
        </h1>
        <p className="m-0 text-base text-[#EADFC6]">Cette liste n&apos;existe pas, ou plus.</p>
        <Link href="/" className={buttonClasses("linen", 46, "mt-2")}>
          Toutes les listes
        </Link>
      </div>
    </main>
  );
}
