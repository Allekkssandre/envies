import { Heart } from "lucide-react";
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
  className,
  photoClassName = "h-[260px]",
}: ItemCardProps) {
  return (
    <article className={cn("flex flex-col gap-3.5", className)}>
      <ItemPhoto
        name={title}
        src480={photo?.src480}
        src1200={photo?.src1200}
        lightBackground={photo?.lightBackground}
        className={photoClassName}
      >
        {isFavorite ? (
          <span
            role="img"
            aria-label="Coup de cœur"
            className="absolute top-3 right-3 flex size-10 items-center justify-center rounded-full bg-linen/75 shadow-[0_6px_14px_-6px_rgb(43_36_22/0.4)] backdrop-blur-[10px]"
          >
            <Heart aria-hidden="true" size={18} className="fill-rust text-rust" strokeWidth={1.6} />
          </span>
        ) : null}
      </ItemPhoto>
      <span className="flex items-start justify-between gap-3">
        <h3 className="m-0 text-base leading-[1.35] font-medium">{title}</h3>
        {priceCents != null ? (
          <b className="font-serif text-[21px] leading-none font-medium tabular max-sm:text-lg">
            {formatPrice(priceCents, currency)}
          </b>
        ) : null}
      </span>
      {domain || tag ? (
        <span className="flex gap-3 text-[13px] text-muted">
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
    </article>
  );
}
