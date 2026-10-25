import type { ElementType } from "react";
import { cn } from "@/lib/cn";
import { splitTitle } from "@/lib/splitTitle";

type SplitTitleProps = {
  title: string;
  as?: ElementType;
  /** Classes de taille (ex. `text-[56px]`). */
  className?: string;
  /** Couleur de la partie en italique (ex. `text-ochre`). */
  restColor?: string;
  /** Un titre d'un seul mot passe en italique (logo « Envies »). */
  italicIfSingle?: boolean;
  /** Interlettrage : −0,03 em pour les titres de liste, −0,02 em pour les sections. */
  tracking?: "list" | "section";
};

/** Règle typographique : premier mot en romain, la suite en italique. */
export function SplitTitle({
  title,
  as: Tag = "h2",
  className,
  restColor,
  italicIfSingle = false,
  tracking = "section",
}: SplitTitleProps) {
  const { first, rest } = splitTitle(title);
  const single = rest === "";
  return (
    <Tag
      className={cn(
        "m-0 font-display font-normal",
        tracking === "list" ? "leading-[0.9] tracking-[-0.03em]" : "leading-none tracking-[-0.02em]",
        className,
      )}
    >
      {single && italicIfSingle ? (
        <i className={cn("font-light", restColor)}>{first}</i>
      ) : (
        <>
          {first}
          {single ? null : (
            <>
              {" "}
              <i className={cn("font-light", restColor)}>{rest}</i>
            </>
          )}
        </>
      )}
    </Tag>
  );
}
