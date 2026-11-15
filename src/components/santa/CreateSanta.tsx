"use client";

import { ArrowRight, CircleAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { PasswordField } from "@/components/ui/PasswordField";
import { SANTA_LIMITS } from "@/lib/santa/types";
import { createSanta } from "@/server/actions/santa";

/** Création d'un Secret Santa : un nom et un mot de passe, puis la page d'organisation. */
export function CreateSanta() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{ title?: string; password?: string; form?: string }>({});
  const [pending, startTransition] = useTransition();
  const honeypot = useRef<HTMLInputElement>(null);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const next = {
      title: title.trim() ? undefined : "Donnez un nom au Secret Santa.",
      password: password.length >= 4 ? undefined : "4 caractères au moins.",
    };
    setErrors(next);
    if (next.title || next.password) return;
    startTransition(async () => {
      const result = await createSanta({ title, password, website: honeypot.current?.value ?? "" });
      if (result.ok) {
        router.push(`/lutins/${result.data.slug}`);
        return;
      }
      const field = result.error.field;
      setErrors(
        field === "title" || field === "password"
          ? { [field]: result.error.message }
          : { form: result.error.message },
      );
    });
  };

  return (
    <form noValidate onSubmit={submit} className="relative flex flex-col gap-5">
      <Field
        id="santa-title"
        label="Nom du Secret Santa"
        placeholder="Noël en famille"
        value={title}
        maxLength={SANTA_LIMITS.title}
        autoComplete="off"
        onChange={(e) => setTitle(e.target.value)}
        error={errors.title}
      />
      <PasswordField
        id="santa-password"
        label="Mot de passe de l'organisation"
        autoComplete="new-password"
        defaultVisible
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        error={errors.password}
        hint="Il ouvre la page d'organisation. Elle ne montre jamais qui a tiré qui."
      />
      <input
        ref={honeypot}
        name="website"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="absolute -left-[9999px] h-px w-px opacity-0"
      />
      {errors.form ? (
        <p role="alert" className="m-0 flex items-center gap-1.5 text-sm font-semibold text-rust">
          <CircleAlert aria-hidden="true" size={16} />
          {errors.form}
        </p>
      ) : null}
      <Button type="submit" size={52} disabled={pending} iconRight={<ArrowRight aria-hidden="true" />}>
        Créer le Secret Santa
      </Button>
    </form>
  );
}
