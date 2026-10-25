import { Check } from "lucide-react";
import type { ButtonHTMLAttributes, CSSProperties, ElementType, ReactNode } from "react";
import { cn } from "@/lib/cn";

type CapsProps = {
  as?: ElementType;
  /** `muted` sur fond clair, `soft` sur ciel doré, `honey` sur fond sombre. */
  tone?: "muted" | "soft" | "honey";
  size?: 11 | 12 | 13;
  className?: string;
  children: ReactNode;
};

const CAPS_TONE = { muted: "text-muted", soft: "text-ink-soft", honey: "text-honey" } as const;
const capsSize = { 11: "text-[11px]", 12: "text-xs", 13: "text-[13px]" } as const;

/** Étiquette en capitales (Instrument Sans 600, interlettrage .18 em). */
export function Caps({ as: Tag = "span", tone = "muted", size = 12, className, children }: CapsProps) {
  return <Tag className={cn("caps", capsSize[size], CAPS_TONE[tone], className)}>{children}</Tag>;
}

type ChipProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "aria-pressed"> & {
  pressed?: boolean;
  /** Couleur du tag (valeur CSS). Activée : fond teinté à 12 % + contour + coche. */
  tone?: string;
  /** Pastille de couleur devant le libellé (état non activé d'un tag). */
  dot?: string;
  count?: number;
  icon?: ReactNode;
};

/** Puce de filtre : off, on (encre), on teintée (tag), avec coche, compteur ou pastille. */
export function Chip({
  pressed = false,
  tone,
  dot,
  count,
  icon,
  className,
  children,
  type = "button",
  style,
  ...rest
}: ChipProps) {
  const tinted = pressed && tone !== undefined;
  const tintStyle: CSSProperties | undefined = tinted
    ? {
        borderColor: tone,
        backgroundColor: `color-mix(in srgb, ${tone} 12%, transparent)`,
      }
    : undefined;

  return (
    <button
      type={type}
      aria-pressed={pressed}
      className={cn(
        "relative inline-flex h-10 items-center gap-[7px] rounded-full border text-sm font-semibold whitespace-nowrap",
        "transition-colors duration-180 ease-out",
        "after:absolute after:inset-x-0 after:-inset-y-[2px] after:content-['']",
        dot || tinted || icon ? "pr-[15px] pl-3" : "px-[15px]",
        pressed && !tinted
          ? "border-ink bg-ink text-linen"
          : "border-line-strong bg-white/55 text-ink hover:bg-white/80",
        tinted ? "text-ink" : null,
        className,
      )}
      style={{ ...tintStyle, ...style }}
      {...rest}
    >
      {tinted ? (
        <Check aria-hidden="true" size={15} strokeWidth={2.4} style={{ color: tone }} />
      ) : dot ? (
        <span aria-hidden="true" className="size-2 shrink-0 rounded-full" style={{ background: dot }} />
      ) : (
        icon
      )}
      {children}
      {count !== undefined ? (
        <span className={cn("font-normal", pressed && !tinted ? "text-[#D8CBAE]" : "text-muted")}>
          {count}
        </span>
      ) : null}
    </button>
  );
}
