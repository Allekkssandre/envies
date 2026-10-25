import type { ElementType } from "react";
import { cn } from "@/lib/cn";
import { splitTitle } from "@/lib/splitTitle";

type SplitTitleProps = {
  title: string;
  as?: ElementType;
  /** Classes de taille et de couleur (ex. `text-[56px]`). Pas d'interligne ni d'interlettrage ici. */
  className?: string;
  /** Couleur de la partie en italique (ex. `text-ochre`). */
  restColor?: string;
  /** Un titre d'un seul mot passe en italique (logo « Envies »). */
  italicIfSingle?: boolean;
  /** Interlettrage : −0,03 em (liste), −0,02 em (section), aucun. */
  tracking?: "list" | "section" | "none";
  /** Interligne (classe Tailwind). Par défaut 0,9 pour une liste, 1 sinon. */
  leading?: string;
  /** Taille optique Fraunces : 144 pour les grands titres, 72 pour les moyens. */
  opsz?: 144 | 72;
};

const TRACKING = { list: "tracking-[-0.03em]", section: "tracking-[-0.02em]", none: "" } as const;

/** Règle typographique : premier mot en romain, la suite en italique. */
export function SplitTitle({
  title,
  as: Tag = "h2",
  className,
  restColor,
  italicIfSingle = false,
  tracking = "section",
  leading,
  opsz = 144,
}: SplitTitleProps) {
  const { first, rest } = splitTitle(title);
  const single = rest === "";
  return (
    <Tag
      className={cn(
        "m-0 font-normal",
        opsz === 144 ? "font-display" : "font-display-72",
        TRACKING[tracking],
        className,
        // Après className : tailwind-merge retire un interligne placé avant une taille de texte.
        leading ?? (tracking === "list" ? "leading-[0.9]" : "leading-none"),
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
