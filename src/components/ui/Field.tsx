import { CircleAlert } from "lucide-react";
import { useId, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

type FieldShellProps = {
  id: string;
  label: string;
  hint?: ReactNode;
  error?: string;
  children: ReactNode;
};

/** Étiquette en capitales au-dessus, aide ou erreur en dessous. */
function FieldShell({ id, label, hint, error, children }: FieldShellProps) {
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <label htmlFor={id} className="text-xs caps text-muted">
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${id}-msg`} className="m-0 flex items-center gap-1.5 text-[13px] font-semibold text-rust">
          <CircleAlert aria-hidden="true" size={15} strokeWidth={2} />
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-msg`} className="m-0 text-[13px] leading-[1.45] text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/** Classes du cadre d'un champ, partagées avec `PasswordField`. */
export function fieldBoxClasses(error: boolean, large = false, className?: string): string {
  return cn(
    "flex items-center gap-2.5 rounded-field border bg-field px-[18px]",
    "shadow-[inset_0_1px_2px_rgb(43_36_22/0.06)] transition-[border-color,box-shadow] duration-180 ease-out",
    large ? "h-[72px]" : "h-13",
    error
      ? "border-rust shadow-[0_0_0_3px_rgb(142_59_34/0.15)]"
      : "border-ink/16 focus-within:border-ink focus-within:shadow-[0_0_0_4px_rgb(167_106_25/0.2)]",
    className,
  );
}

const inputClasses = (large: boolean) =>
  cn(
    "min-w-0 flex-1 border-0 bg-transparent text-ink outline-none focus-visible:outline-none",
    large ? "font-display-72 text-[34px]" : "text-base",
  );

type FieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, "id"> & {
  label: string;
  hint?: ReactNode;
  error?: string;
  /** Grand champ en Fraunces 34 pour les titres. */
  large?: boolean;
  id?: string;
  trailing?: ReactNode;
};

export function Field({ label, hint, error, large = false, id, trailing, className, ...rest }: FieldProps) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  return (
    <FieldShell id={fieldId} label={label} hint={hint} error={error}>
      <span className={fieldBoxClasses(Boolean(error), large, className)}>
        <input
          id={fieldId}
          aria-invalid={error ? true : undefined}
          aria-describedby={error || hint ? `${fieldId}-msg` : undefined}
          className={inputClasses(large)}
          {...rest}
        />
        {trailing}
      </span>
    </FieldShell>
  );
}

type TextAreaProps = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "id"> & {
  label: string;
  hint?: ReactNode;
  error?: string;
  id?: string;
};

export function TextArea({ label, hint, error, id, className, rows = 3, ...rest }: TextAreaProps) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  return (
    <FieldShell id={fieldId} label={label} hint={hint} error={error}>
      <textarea
        id={fieldId}
        rows={rows}
        aria-invalid={error ? true : undefined}
        aria-describedby={error || hint ? `${fieldId}-msg` : undefined}
        className={cn(
          fieldBoxClasses(Boolean(error)),
          "h-auto resize-y py-3.5 text-base leading-[1.5] text-ink outline-none focus:border-ink focus:shadow-[0_0_0_4px_rgb(167_106_25/0.2)] focus-visible:outline-none",
          className,
        )}
        {...rest}
      />
    </FieldShell>
  );
}

export { FieldShell };
