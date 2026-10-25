import Link from "next/link";

/** Pied de page feuillage + voile sombre 45 % : « Envies » et un lien. */
export function SiteFooter({ href, label }: { href: string; label: string }) {
  return (
    <footer className="on-dark relative h-[180px] overflow-hidden tex-feuillage text-linen sm:h-[240px]">
      <div aria-hidden="true" className="absolute inset-0 bg-[rgb(18_21_8/0.45)]" />
      <div className="relative mx-auto flex h-full max-w-[1320px] items-center justify-between gap-4 px-4 sm:px-12">
        <Link
          href="/"
          className="font-display text-5xl font-light tracking-[-0.02em] text-linen italic no-underline sm:text-[72px]"
        >
          Envies
        </Link>
        <Link
          href={href}
          className="inline-flex min-h-11 items-center text-[15px] font-semibold text-linen underline underline-offset-4"
        >
          {label}
        </Link>
      </div>
    </footer>
  );
}
