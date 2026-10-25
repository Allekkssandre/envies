import { Heart } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/cn";
import { formatPrice } from "@/lib/format";
import { ItemPhoto } from "./ItemPhoto";

export type ItemCardTag = { name: string; color: string };

type ItemCardProps = {
  title: string;
  priceCents?: number | null;
  currency?: string;
  domain?: string | null;
  tag?: ItemCardTag | null;
  isFavorite?: boolean;
  photo?: { src480: string; src1200?: string; lightBackground?: boolean } | null;
  /** Lien vers la fiche. Sans lien, la carte est statique (planche /design). */
  href?: string;
  /** Niveau du titre (h2 sous un titre de page, h3 sous un titre de section). */
  headingLevel?: "h2" | "h3";
  className?: string;
  photoClassName?: string;
};

/** Carte d'article, version visiteur : photo + cœur + nom/prix + domaine/tag. */
export function ItemCard({
  title,
  priceCents,
  currency = "EUR",
  domain,
  tag,
  isFavorite = false,
  photo,
  href,
  headingLevel: Heading = "h3",
  className,
  photoClassName = "h-[260px]",
}: ItemCardProps) {
  const body = (
    <>
      <ItemPhoto
        name={title}
        src480={photo?.src480}
        src1200={photo?.src1200}
        lightBackground={photo?.lightBackground}
        className={cn(
          photoClassName,
          href && "transition-transform duration-180 ease-out group-hover:-translate-y-0.5",
        )}
      >
        {isFavorite ? (
          <span
            role="img"
            aria-label="Coup de cœur"
            className="absolute top-3 right-3 flex size-10 items-center justify-center rounded-full bg-linen/75 shadow-[0_6px_14px_-6px_rgb(43_36_22/0.4)] backdrop-blur-[10px] sm:top-3.5 sm:right-3.5"
          >
            <Heart aria-hidden="true" size={18} className="fill-rust text-rust" strokeWidth={1.6} />
          </span>
        ) : null}
      </ItemPhoto>
      <span className="flex flex-col gap-1.5 px-0.5">
        <span className="flex items-baseline justify-between gap-3">
          <Heading className="m-0 line-clamp-2 text-sm leading-[1.35] font-medium sm:text-base">
            {title}
          </Heading>
          {priceCents != null ? (
            <b className="font-serif text-lg leading-none font-medium tabular sm:text-[21px]">
              {formatPrice(priceCents, currency)}
            </b>
          ) : null}
        </span>
        {domain || tag ? (
          <span className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[13px] text-muted">
            {domain}
            {tag ? (
              <span className="inline-flex items-center gap-[5px]">
                <span
                  aria-hidden="true"
                  className="size-[7px] shrink-0 rounded-full"
                  style={{ background: tag.color }}
                />
                {tag.name}
              </span>
            ) : null}
          </span>
        ) : null}
      </span>
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        scroll={false}
        className={cn("group flex flex-col gap-3.5 rounded-photo text-ink no-underline sm:gap-4", className)}
      >
        {body}
      </Link>
    );
  }
  return <article className={cn("flex flex-col gap-3.5", className)}>{body}</article>;
}
