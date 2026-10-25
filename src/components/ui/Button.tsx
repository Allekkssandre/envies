import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

export type ButtonVariant =
  | "ink"
  | "linen"
  | "glass"
  | "outline"
  | "ghost"
  | "rust"
  | "rust-outline"
  /** Action d'un message éphémère (« Annuler »), miel clair sur encre. */
  | "toast";

export type ButtonSize = 40 | 44 | 46 | 52 | 56 | 58;

const variantClass: Record<ButtonVariant, string> = {
  ink: "bg-ink text-linen shadow-ink hover:bg-ink-soft",
  linen: "bg-linen text-ink shadow-linen hover:bg-paper",
  glass: "border border-linen/40 bg-linen/12 text-linen backdrop-blur-[14px] hover:bg-linen/20",
  outline: "border border-line-strong bg-white/45 text-ink hover:bg-white/70",
  ghost: "bg-transparent text-ink hover:bg-ink/5",
  rust: "bg-rust text-linen shadow-rust hover:bg-[#7a311c]",
  "rust-outline": "border border-rust/50 bg-transparent text-rust hover:bg-rust/8",
  toast: "bg-transparent text-honey-light hover:bg-linen/10",
};

const heightClass: Record<ButtonSize, string> = {
  40: "h-10 text-sm",
  44: "h-11 text-[15px]",
  46: "h-[46px] text-[15px]",
  52: "h-13 text-base",
  56: "h-14 text-base",
  58: "h-[58px] text-base",
};

/** Classes d'un bouton, réutilisables sur un lien (`<Link className={buttonClasses(...)}>`). */
export function buttonClasses(
  variant: ButtonVariant = "ink",
  size: ButtonSize = 46,
  className?: string,
): string {
  return cn(
    "inline-flex shrink-0 items-center justify-center gap-2 rounded-full font-semibold whitespace-nowrap no-underline",
    "transition-colors duration-180 ease-out disabled:opacity-50",
    "[&_svg]:size-[18px] [&_svg]:shrink-0 [&_svg]:stroke-[1.7]",
    variant === "toast" ? "px-3" : "px-5",
    size === 40 ? "min-w-11" : null,
    variantClass[variant],
    heightClass[size],
    className,
  );
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: ReactNode;
  iconRight?: ReactNode;
};

export function Button({
  variant = "ink",
  size = 46,
  icon,
  iconRight,
  className,
  children,
  type = "button",
  ...rest
}: ButtonProps) {
  return (
    <button type={type} className={buttonClasses(variant, size, className)} {...rest}>
      {icon}
      {children}
      {iconRight}
    </button>
  );
}
