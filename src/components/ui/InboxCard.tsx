import { CircleAlert, ImageIcon, LoaderCircle } from "lucide-react";
import { cn } from "@/lib/cn";
import { formatPrice } from "@/lib/format";
import { ItemPhoto } from "./ItemPhoto";

export type InboxState = "pending" | "ok" | "partial" | "failed" | "no-link";

type InboxCardProps = {
  state: InboxState;
  /** Nom de l'article, ou lien brut tant que rien n'est trouvé. */
  title: string;
  domain?: string | null;
  priceCents?: number | null;
  currency?: string;
  photo?: { src480: string; lightBackground?: boolean } | null;
  className?: string;
};

const photoBox = "h-[130px] rounded-field";

/** Carte de la zone « À trier », selon l'état de l'extraction. */
export function InboxCard({
  state,
  title,
  domain,
  priceCents,
  currency = "EUR",
  photo,
  className,
}: InboxCardProps) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-2.5", className)}>
      {state === "pending" ? (
        <span
          className={cn("relative flex items-center justify-center overflow-hidden tex-studio", photoBox)}
        >
          <span
            aria-hidden="true"
            className="absolute inset-0 animate-shimmer bg-[linear-gradient(100deg,rgb(255_255_255/0)_30%,rgb(255_255_255/0.55)_50%,rgb(255_255_255/0)_70%)]"
          />
          <span className="relative inline-flex h-[30px] items-center gap-1.5 rounded-full bg-paper/85 px-3 text-xs font-semibold">
            <LoaderCircle
              aria-hidden="true"
              size={14}
              strokeWidth={2.2}
              className="animate-spin motion-reduce:animate-none"
            />
            Récupération…
          </span>
        </span>
      ) : state === "failed" || (state === "partial" && !photo) ? (
        <span
          className={cn(
            "flex flex-col items-center justify-center gap-1.5 border-[1.5px] border-dashed border-rust/40 bg-rust/5 text-rust",
            photoBox,
          )}
        >
          <ImageIcon aria-hidden="true" size={22} strokeWidth={1.6} />
          <span className="text-xs font-semibold">Pas de photo trouvée</span>
        </span>
      ) : (
        <ItemPhoto
          name={title}
          src480={photo?.src480}
          lightBackground={photo?.lightBackground}
          className={photoBox}
          initialSize={71}
        />
      )}

      <span className="flex flex-col gap-1 px-0.5">
        {state === "pending" ? (
          <span aria-hidden="true" className="h-2.5 w-4/5 rounded-[5px] bg-ink/12" />
        ) : (
          <span className="flex items-baseline justify-between gap-2">
            <span className="truncate text-sm leading-[1.3] font-medium">{title}</span>
            {priceCents != null ? (
              <b className="font-serif text-base font-medium tabular">{formatPrice(priceCents, currency)}</b>
            ) : null}
          </span>
        )}
        {state === "failed" ? (
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-rust">
            <CircleAlert aria-hidden="true" size={13} strokeWidth={2} />
            Rien trouvé · compléter
          </span>
        ) : (
          <span className="text-xs text-muted">{state === "no-link" ? "sans lien" : domain}</span>
        )}
      </span>
    </div>
  );
}
