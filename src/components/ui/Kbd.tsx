import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

type KbdProps = { tone?: "light" | "dark"; className?: string; children: ReactNode };

/** Touche clavier. `light` sur fond clair, `dark` sur fond sombre. */
export function Kbd({ tone = "light", className, children }: KbdProps) {
  return (
    <kbd
      className={cn(
        "inline-flex h-[26px] min-w-[26px] items-center justify-center rounded-[7px] px-[7px] font-sans text-[13px] font-bold",
        tone === "light"
          ? "border border-ink/20 bg-white/70 text-ink shadow-[0_1px_0_rgb(43_36_22/0.2)]"
          : "border border-linen/30 bg-linen/15 text-linen",
        className,
      )}
    >
      {children}
    </kbd>
  );
}

type KeyChipProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  /** Touche affichée (« 1 », « Z »…). Les raccourcis sont gérés par la page. */
  keyLabel: string;
  pressed?: boolean;
  dot?: string;
  /** Couleur du tag (valeur CSS) : activée, contour et fond teintés au lieu de l'encre. */
  tone?: string;
};

/** Puce du tri rapide avec sa touche. */
export function KeyChip({
  keyLabel,
  pressed = false,
  dot,
  tone,
  className,
  children,
  type = "button",
  style,
  ...rest
}: KeyChipProps) {
  const tinted = pressed && tone !== undefined;
  return (
    <button
      type={type}
      aria-pressed={pressed}
      aria-keyshortcuts={keyLabel}
      className={cn(
        "inline-flex h-[46px] items-center gap-[9px] rounded-full border pr-4 pl-2.5 text-[15px] font-semibold whitespace-nowrap",
        "transition-colors duration-180 ease-out",
        pressed && !tinted
          ? "border-ink bg-ink text-linen"
          : "border-ink/16 bg-white/60 text-ink hover:bg-white/80",
        className,
      )}
      style={
        tinted
          ? { borderColor: tone, backgroundColor: `color-mix(in srgb, ${tone} 14%, transparent)`, ...style }
          : style
      }
      {...rest}
    >
      <kbd
        className={cn(
          "inline-flex h-6 min-w-6 items-center justify-center rounded-[7px] px-1.5 font-sans text-xs font-bold",
          pressed && !tinted ? "bg-linen/20 text-linen" : "bg-ink/8 text-ink",
        )}
      >
        {keyLabel}
      </kbd>
      {dot && !tinted ? (
        <span aria-hidden="true" className="size-2 shrink-0 rounded-full" style={{ background: dot }} />
      ) : null}
      {children}
    </button>
  );
}
