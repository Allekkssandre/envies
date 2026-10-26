import { ArrowLeft, Check, FileSpreadsheet, Pencil } from "lucide-react";
import Link from "next/link";
import { preload } from "react-dom";
import { buttonClasses } from "@/components/ui/Button";
import { Caps } from "@/components/ui/Chip";
import { Foliage } from "@/components/ui/Foliage";
import { SplitTitle } from "@/components/ui/SplitTitle";
import { ambianceTheme } from "@/lib/ambiance";
import { cn } from "@/lib/cn";
import { formatTotal } from "@/lib/format";
import type { ListStats } from "@/lib/listFilters";
import { formatNumber, plural } from "@/lib/text";
import type { ListInfo } from "@/types/models";
import { EditBadge, LockButton } from "@/components/access/EditControls";
import { ShareButton } from "./ShareButton";

type ListHeroProps = { list: ListInfo; stats: ListStats; editing?: boolean; inboxCount?: number };

/** Héros d'ambiance de la page liste : barre du haut, prénom, titre, petit mot et chiffres. */
export function ListHero({ list, stats, editing = false, inboxCount = 0 }: ListHeroProps) {
  const theme = ambianceTheme(list.ambiance);
  const tone = theme.dark ? "dark" : "light";
  const total = stats.totalCents > 0 ? formatTotal(stats.totalCents, list.currency, stats.approximate) : null;

  // Texture du héros préchargée, une par taille d'écran.
  preload(theme.images.desktop, { as: "image", media: "(min-width: 640px)", fetchPriority: "high" });
  preload(theme.images.mobile, { as: "image", media: "(max-width: 639px)", fetchPriority: "high" });

  return (
    <header
      className={cn(
        "relative overflow-hidden",
        editing ? "h-[300px] sm:h-[440px]" : "h-[470px] sm:h-[640px] lg:h-[780px]",
        theme.texture,
        theme.text,
        theme.dark && "on-dark",
      )}
    >
      <span aria-hidden="true" className="absolute inset-0 grain-overlay" />
      {theme.dark ? (
        <>
          <Foliage className="top-10 right-[5%] hidden h-[760px] w-[420px] lg:block" />
          <Foliage className="top-14 -right-5 h-[360px] w-[170px] [stroke-width:2.2] opacity-50 lg:hidden" />
        </>
      ) : null}

      <div className="relative mx-auto flex h-full max-w-[1320px] flex-col px-3 sm:px-12">
        {/* Barre du haut */}
        {editing ? (
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 py-2 sm:h-24 sm:py-0">
            <div className="flex items-center">
              <Link
                href="/"
                className={cn("hidden font-display-72 text-[34px] italic no-underline lg:inline", theme.text)}
              >
                Envies
              </Link>
              <span className="lg:hidden">
                <LockButton listId={list.id} dark={theme.dark} compact />
              </span>
            </div>
            <EditBadge dark={theme.dark} />
            <div className="flex justify-end gap-2.5">
              <span className="hidden lg:contents">
                <Link
                  href={`/l/${list.slug}/edition/importer`}
                  className={buttonClasses(theme.dark ? "glass" : "outline", 46)}
                >
                  <FileSpreadsheet aria-hidden="true" />
                  Importer
                </Link>
                <LockButton listId={list.id} dark={theme.dark} />
              </span>
              <Link
                href={`/l/${list.slug}`}
                className={buttonClasses("linen", 46, "max-sm:h-11 max-sm:px-4")}
              >
                <Check aria-hidden="true" />
                Terminer
              </Link>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between py-2 sm:h-24 sm:py-0">
            <Link
              href="/"
              aria-label="Toutes les listes"
              className={cn(
                "flex size-11 items-center justify-center rounded-full border backdrop-blur-[12px] sm:hidden",
                theme.dark
                  ? "border-linen/40 bg-linen/12 text-linen"
                  : "border-line-strong bg-white/45 text-ink",
              )}
            >
              <ArrowLeft aria-hidden="true" size={20} strokeWidth={1.6} />
            </Link>
            <Link
              href="/"
              className={cn("font-display-72 text-[26px] italic no-underline sm:text-[34px]", theme.text)}
            >
              Envies
            </Link>
            <div className="flex gap-2 sm:gap-2.5">
              <span className="hidden sm:contents">
                <ShareButton title={list.title} path={`/l/${list.slug}`} variant="full" tone={tone} />
                <Link href={`/l/${list.slug}/edition`} className={buttonClasses("linen", 46)}>
                  <Pencil aria-hidden="true" />
                  Modifier
                </Link>
              </span>
              <span className="contents sm:hidden">
                <ShareButton title={list.title} path={`/l/${list.slug}`} variant="round" tone={tone} />
                <Link
                  href={`/l/${list.slug}/edition`}
                  aria-label="Modifier la liste"
                  className="flex size-11 items-center justify-center rounded-full bg-linen text-ink shadow-[0_8px_20px_-8px_rgb(0_0_0/0.5)]"
                >
                  <Pencil aria-hidden="true" size={18} strokeWidth={1.6} />
                </Link>
              </span>
            </div>
          </div>
        )}

        {/* Bas du héros */}
        <div
          className={cn(
            "mt-auto flex flex-wrap items-end justify-between gap-12 px-2 sm:px-0",
            editing ? "pb-12 sm:pb-[72px]" : "pb-16 sm:pb-[104px]",
          )}
        >
          <div className="flex flex-col gap-2.5 sm:gap-[18px]">
            <Caps tone={theme.dark ? "honey" : "soft"} size={11} className="tracking-[0.2em] sm:text-[13px]">
              La liste de {list.ownerName}
            </Caps>
            <SplitTitle
              as="h1"
              title={list.title}
              tracking="list"
              restColor={theme.italic}
              leading="leading-[0.86] sm:leading-[0.9]"
              className={cn(
                editing
                  ? "text-[58px] sm:text-[128px]"
                  : "text-[84px] sm:text-[128px] lg:text-[172px] max-sm:[&>i]:block",
                theme.dark && "[text-shadow:0_14px_50px_rgb(10_12_4/0.45)]",
              )}
            />
            <p className={cn("m-0 mt-1.5 text-sm sm:text-base", !editing && "lg:hidden", theme.soft)}>
              {editing ? (
                <>
                  {plural(stats.count, "article", "articles")} · {formatNumber(inboxCount)} à trier
                </>
              ) : (
                <>
                  {plural(stats.count, "article", "articles")} ·{" "}
                  {plural(stats.favorites, "coup de cœur", "coups de cœur")}
                  {total ? ` · ${total}` : null}
                </>
              )}
            </p>
          </div>

          <aside
            aria-label="En bref"
            className={cn(
              "hidden w-[340px] flex-col gap-4 rounded-panel px-[26px] py-6",
              !editing && "lg:flex",
              theme.dark ? "glass-dark" : "glass-light",
            )}
          >
            {list.description ? (
              <p className="m-0 font-note text-[21px] leading-[1.35] [font-variation-settings:'SOFT'_100,'opsz'_24]">
                {list.description}
              </p>
            ) : null}
            <dl
              className={cn(
                "m-0 grid grid-cols-3 gap-2",
                list.description && "border-t pt-3.5",
                theme.dark ? "border-linen/25" : "border-line-strong",
              )}
            >
              <Stat value={formatNumber(stats.count)} label="articles" dark={theme.dark} />
              <Stat value={formatNumber(stats.favorites)} label="coups de cœur" dark={theme.dark} />
              <Stat value={total ?? "—"} label="au total" dark={theme.dark} />
            </dl>
          </aside>
        </div>
      </div>
    </header>
  );
}

function Stat({ value, label, dark }: { value: string; label: string; dark: boolean }) {
  return (
    <div className="flex flex-col-reverse gap-0.5">
      <dt className={cn("text-xs", dark ? "text-honey" : "text-ink-soft")}>{label}</dt>
      <dd className="m-0 font-serif text-[26px] tabular">{value}</dd>
    </div>
  );
}
