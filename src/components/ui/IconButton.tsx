import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";
import type { ButtonVariant } from "./Button";

const variantClass: Record<ButtonVariant, string> = {
  ink: "bg-ink text-linen shadow-ink hover:bg-ink-soft",
  linen: "bg-linen text-ink shadow-linen hover:bg-paper",
  glass: "border border-linen/40 bg-linen/12 text-linen backdrop-blur-[14px] hover:bg-linen/20",
  outline: "border border-line-strong bg-white/45 text-ink hover:bg-white/70",
  ghost: "bg-transparent text-ink hover:bg-ink/5",
  rust: "bg-rust text-linen shadow-rust",
  "rust-outline": "border border-rust/50 text-rust hover:bg-rust/8",
  toast: "bg-transparent text-honey-light hover:bg-linen/10",
};

type IconButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "aria-label"> & {
  /** Obligatoire : un bouton icône doit être nommé. */
  "aria-label": string;
  variant?: ButtonVariant;
  /** Diamètre en px, 38 à 56. La zone tactile reste d'au moins 44 px. */
  size?: 38 | 40 | 44 | 48 | 52 | 56;
  children: ReactNode;
};

export function IconButton({
  variant = "outline",
  size = 44,
  className,
  children,
  type = "button",
  style,
  ...rest
}: IconButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center rounded-full p-0",
        "transition-colors duration-180 ease-out disabled:opacity-50",
        "[&_svg]:size-[18px] [&_svg]:stroke-[1.7]",
        // zone tactile minimale de 44 px même pour les petits boutons
        size < 44 ? "after:absolute after:-inset-[3px] after:content-['']" : null,
        variantClass[variant],
        className,
      )}
      style={{ width: size, height: size, ...style }}
      {...rest}
    >
      {children}
    </button>
  );
}
