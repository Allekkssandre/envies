"use client";

import { Eye, EyeOff } from "lucide-react";
import { useId, useState, type InputHTMLAttributes, type ReactNode, type Ref } from "react";
import { FieldShell, fieldBoxClasses } from "./Field";

type PasswordFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "id"> & {
  label: string;
  hint?: ReactNode;
  error?: string;
  /** `new-password` à la création, `current-password` au déverrouillage. */
  autoComplete: "new-password" | "current-password";
  /** Visible par défaut à la création (docs/02-parcours.md, C1). */
  defaultVisible?: boolean;
  id?: string;
  ref?: Ref<HTMLInputElement>;
};

export function PasswordField({
  label,
  hint,
  error,
  defaultVisible = false,
  id,
  className,
  ...rest
}: PasswordFieldProps) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  const [visible, setVisible] = useState(defaultVisible);
  return (
    <FieldShell id={fieldId} label={label} hint={hint} error={error}>
      <span className={fieldBoxClasses(Boolean(error), false, className)}>
        <input
          id={fieldId}
          type={visible ? "text" : "password"}
          aria-invalid={error ? true : undefined}
          aria-describedby={error || hint ? `${fieldId}-msg` : undefined}
          spellCheck={false}
          autoCapitalize="off"
          className="min-w-0 flex-1 border-0 bg-transparent text-base text-ink outline-none focus-visible:outline-none"
          {...rest}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Masquer le mot de passe" : "Afficher le mot de passe"}
          aria-pressed={visible}
          className="-mr-3 inline-flex size-11 shrink-0 items-center justify-center rounded-full text-muted transition-colors duration-180 hover:text-ink"
        >
          {visible ? (
            <EyeOff aria-hidden="true" size={19} strokeWidth={1.7} />
          ) : (
            <Eye aria-hidden="true" size={19} strokeWidth={1.7} />
          )}
        </button>
      </span>
    </FieldShell>
  );
}
