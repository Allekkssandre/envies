"use client";

import { useId, useState } from "react";
import { cn } from "@/lib/cn";

type ToggleProps = {
  label: string;
  /** Contrôlé : passer `checked` et `onCheckedChange`. Sinon `defaultChecked`. */
  checked?: boolean;
  defaultChecked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  tone?: "olive" | "rust";
  /** Masquer visuellement le libellé (il reste lu par les lecteurs d'écran). */
  hideLabel?: boolean;
  disabled?: boolean;
  className?: string;
};

/** Interrupteur 50 × 30, `role="switch"`. */
export function Toggle({
  label,
  checked,
  defaultChecked = false,
  onCheckedChange,
  tone = "olive",
  hideLabel = false,
  disabled,
  className,
}: ToggleProps) {
  const id = useId();
  const [inner, setInner] = useState(defaultChecked);
  const isOn = checked ?? inner;

  function toggle() {
    const next = !isOn;
    if (checked === undefined) setInner(next);
    onCheckedChange?.(next);
  }

  return (
    <span className={cn("inline-flex min-h-11 items-center gap-3", className)}>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={isOn}
        aria-label={hideLabel ? label : undefined}
        disabled={disabled}
        onClick={toggle}
        className={cn(
          "relative h-[30px] w-[50px] shrink-0 rounded-[15px] transition-colors duration-180 ease-out",
          "after:absolute after:-inset-[7px] after:content-['']",
          isOn ? (tone === "olive" ? "bg-olive" : "bg-rust") : "bg-ink/20",
        )}
      >
        <span
          aria-hidden="true"
          className={cn(
            "absolute top-[3px] left-[3px] size-6 rounded-full bg-paper shadow-[0_2px_4px_rgb(0_0_0/0.25)]",
            "transition-transform duration-180 ease-out",
            isOn ? "translate-x-5" : "translate-x-0",
          )}
        />
      </button>
      {hideLabel ? null : (
        <label htmlFor={id} className="cursor-pointer text-[15px] text-ink">
          {label}
        </label>
      )}
    </span>
  );
}
