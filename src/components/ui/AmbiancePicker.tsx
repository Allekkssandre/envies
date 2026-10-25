"use client";

import { Check } from "lucide-react";
import { useId } from "react";
import { ambianceTheme } from "@/lib/ambiance";
import { cn } from "@/lib/cn";
import type { Ambiance } from "@/types/models";

const OPTIONS: { value: Ambiance; label: string }[] = [
  { value: "feuillage", label: "Feuillage" },
  { value: "ciel", label: "Ciel doré" },
  { value: "ambre", label: "Ambre" },
];

type AmbiancePickerProps = {
  value: Ambiance;
  onChange: (value: Ambiance) => void;
  /** Hauteur des vignettes : 104 px (desktop), 64 px (mobile). */
  className?: string;
};

/** 3 vignettes radio avec coche. */
export function AmbiancePicker({ value, onChange, className }: AmbiancePickerProps) {
  const name = useId();
  return (
    <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
      <legend className="mb-2 text-xs caps text-muted">Ambiance</legend>
      <div className="grid grid-cols-3 gap-2.5 sm:gap-3.5">
        {OPTIONS.map((option) => {
          const checked = option.value === value;
          return (
            <label key={option.value} className="group flex cursor-pointer flex-col items-center gap-2">
              <input
                type="radio"
                name={name}
                value={option.value}
                checked={checked}
                onChange={() => onChange(option.value)}
                className="peer sr-only"
              />
              <span
                aria-hidden="true"
                className={cn(
                  "relative block h-16 w-full rounded-field shadow-[0_12px_22px_-12px_rgb(43_36_22/0.55)] transition-shadow duration-180 sm:h-[104px]",
                  "peer-focus-visible:outline-2 peer-focus-visible:outline-offset-3 peer-focus-visible:outline-ink",
                  ambianceTheme(option.value).texture,
                  checked && "shadow-[0_0_0_2px_var(--color-cream),0_0_0_4px_var(--color-ink)]",
                  className,
                )}
              >
                {checked ? (
                  <span className="absolute top-2 right-2 flex size-6 items-center justify-center rounded-full bg-linen text-ink">
                    <Check size={15} strokeWidth={2.4} />
                  </span>
                ) : null}
              </span>
              <span className={cn("text-sm", checked ? "font-bold text-ink" : "font-medium text-ink-soft")}>
                {option.label}
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
