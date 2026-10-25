"use client";

import { ArrowLeft, ArrowRight, Check, CircleAlert, Plus, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState, useTransition, type FormEvent } from "react";
import { AmbiancePicker } from "@/components/ui/AmbiancePicker";
import { Button, buttonClasses } from "@/components/ui/Button";
import { Caps } from "@/components/ui/Chip";
import { Field, TextArea } from "@/components/ui/Field";
import { Foliage, Halo } from "@/components/ui/Foliage";
import { LinkBox } from "@/components/ui/LinkBox";
import { PasswordField } from "@/components/ui/PasswordField";
import { SplitTitle } from "@/components/ui/SplitTitle";
import { ambianceTheme } from "@/lib/ambiance";
import { cn } from "@/lib/cn";
import {
  DESCRIPTION_MAX,
  OWNER_MAX,
  TITLE_MAX,
  createListSchema,
  type CreateListField,
} from "@/lib/schemas/list";
import { createList, type CreatedList } from "@/server/actions/lists";
import type { Ambiance } from "@/types/models";

type Values = { title: string; ownerName: string; password: string; description: string; ambiance: Ambiance };
type Errors = Partial<Record<CreateListField, string>>;

const INITIAL: Values = { title: "", ownerName: "", password: "", description: "", ambiance: "feuillage" };

/** Valide un seul champ avec le schéma partagé (sortie de champ). */
function validateField(field: CreateListField, value: string): string | undefined {
  const result = createListSchema.shape[field].safeParse(value);
  return result.success ? undefined : result.error.issues[0]?.message;
}

/** « Nouvelle liste » puis « C'est prêt. » (même route). */
export function CreateList() {
  const [created, setCreated] = useState<CreatedList | null>(null);
  return created ? <Created created={created} /> : <CreateForm onCreated={setCreated} />;
}

function CreateForm({ onCreated }: { onCreated: (c: CreatedList) => void }) {
  const [values, setValues] = useState<Values>(INITIAL);
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [showNote, setShowNote] = useState(false);
  const [pending, startTransition] = useTransition();
  const honeypot = useRef<HTMLInputElement>(null);

  const set = <K extends keyof Values>(key: K, value: Values[K]) => {
    setValues((v) => ({ ...v, [key]: value }));
    // Une erreur affichée disparaît dès que la saisie redevient valide.
    if (key !== "ambiance" && errors[key as CreateListField]) {
      setErrors((e) => ({ ...e, [key]: validateField(key as CreateListField, String(value)) }));
    }
  };
  const blur = (field: CreateListField) => () =>
    setErrors((e) => ({ ...e, [field]: validateField(field, values[field]) }));

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setFormError(null);
    const fields: CreateListField[] = ["title", "ownerName", "password", "description"];
    const next: Errors = {};
    for (const f of fields) next[f] = validateField(f, values[f]);
    setErrors(next);
    const firstInvalid = fields.find((f) => next[f]);
    if (firstInvalid) {
      document.getElementById(`create-${firstInvalid}`)?.focus();
      return;
    }
    startTransition(async () => {
      const result = await createList({ ...values, website: honeypot.current?.value ?? "" });
      if (result.ok) onCreated(result.data);
      else if (result.error.field) {
        setErrors((e) => ({ ...e, [result.error.field as CreateListField]: result.error.message }));
        document.getElementById(`create-${result.error.field}`)?.focus();
      } else setFormError(result.error.message);
    });
  };

  return (
    <div className="relative isolate min-h-dvh overflow-clip bg-cream lg:grid lg:grid-cols-2">
      {/* Aperçu : en haut sur mobile, colonne de droite sur desktop */}
      <div className="relative lg:order-2 lg:p-6">
        <div className="lg:sticky lg:top-6">
          <Preview values={values} />
        </div>
      </div>

      {/* Formulaire */}
      <div className="relative z-10 -mt-[18px] rounded-t-sheet bg-paper lg:order-1 lg:mt-0 lg:rounded-none lg:bg-transparent">
        <Halo tone="olive" strength={0.14} className="-top-40 -left-80 hidden lg:block" />
        <div className="mx-auto flex max-w-[720px] flex-col px-4 pt-6 pb-32 sm:px-12 lg:pt-0 lg:pb-16 lg:pl-[72px]">
          <div className="hidden h-24 items-center justify-between lg:flex">
            <Link
              href="/"
              className="inline-flex min-h-11 items-center gap-2 text-[15px] font-semibold text-ink no-underline"
            >
              <ArrowLeft aria-hidden="true" size={18} strokeWidth={1.7} />
              Toutes les listes
            </Link>
            <Link href="/" className="font-display-72 text-[30px] text-ink italic no-underline">
              Envies
            </Link>
          </div>

          <div className="mb-8 hidden lg:block">
            <SplitTitle as="h1" title="Nouvelle liste" restColor="text-ochre" className="text-[76px]" />
            <p className="m-0 mt-3 text-base text-ink-soft">
              Pas de compte. Un nom, un mot de passe simple, et c&apos;est parti.
            </p>
          </div>
          <h1 className="sr-only lg:hidden">Nouvelle liste</h1>

          <form noValidate onSubmit={submit} className="grid gap-x-4 gap-y-5 lg:grid-cols-2 lg:gap-y-6">
            <div className="lg:col-span-2">
              <Field
                id="create-title"
                label="Nom de la liste"
                placeholder="Noël 2026"
                value={values.title}
                maxLength={TITLE_MAX}
                autoComplete="off"
                onChange={(e) => set("title", e.target.value)}
                onBlur={blur("title")}
                error={errors.title}
                large
                className="max-lg:h-13 max-lg:[&_input]:font-sans max-lg:[&_input]:text-base"
              />
            </div>
            <Field
              id="create-ownerName"
              label="Votre prénom"
              value={values.ownerName}
              maxLength={OWNER_MAX}
              autoComplete="given-name"
              onChange={(e) => set("ownerName", e.target.value)}
              onBlur={blur("ownerName")}
              error={errors.ownerName}
              hint={
                <span className="hidden lg:inline">
                  Affiché sous le titre : « La liste de {values.ownerName.trim() || "…"} ».
                </span>
              }
            />
            <div className="max-lg:order-4">
              <PasswordField
                id="create-password"
                label="Mot de passe pour modifier"
                autoComplete="new-password"
                defaultVisible
                value={values.password}
                onChange={(e) => set("password", e.target.value)}
                onBlur={blur("password")}
                error={errors.password}
                hint="Simple, à donner à qui peut modifier."
              />
            </div>

            <div
              className={cn(
                "max-lg:order-5 lg:col-span-2",
                !showNote && !values.description && "max-lg:hidden",
              )}
            >
              <TextArea
                id="create-description"
                label="Un petit mot (facultatif)"
                rows={2}
                value={values.description}
                maxLength={DESCRIPTION_MAX}
                onChange={(e) => set("description", e.target.value)}
                onBlur={blur("description")}
                error={errors.description}
                className="font-note text-lg"
              />
            </div>
            {!showNote && !values.description ? (
              <button
                type="button"
                onClick={() => {
                  setShowNote(true);
                  requestAnimationFrame(() => document.getElementById("create-description")?.focus());
                }}
                className="inline-flex min-h-11 items-center gap-2 justify-self-start text-[15px] font-semibold text-ink max-lg:order-5 lg:hidden"
              >
                <Plus aria-hidden="true" size={18} strokeWidth={1.8} />
                Ajouter un petit mot
              </button>
            ) : null}

            <div className="max-lg:order-3 lg:col-span-2">
              <AmbiancePicker value={values.ambiance} onChange={(a) => set("ambiance", a)} />
            </div>

            {/* Champ piège : invisible pour les personnes, rempli par les robots. */}
            <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
              <label htmlFor="create-website">Site web</label>
              <input
                ref={honeypot}
                id="create-website"
                name="website"
                type="text"
                tabIndex={-1}
                autoComplete="off"
              />
            </div>

            <div className="flex flex-col gap-3 max-lg:order-6 lg:col-span-2 lg:mt-2 lg:flex-row lg:items-center lg:gap-5">
              {formError ? (
                <p
                  role="alert"
                  className="m-0 flex items-center gap-1.5 text-sm font-semibold text-rust lg:order-2"
                >
                  <CircleAlert aria-hidden="true" size={16} strokeWidth={2} />
                  {formError}
                </p>
              ) : (
                <p className="m-0 hidden max-w-[320px] text-[13px] leading-normal text-muted lg:order-2 lg:block">
                  Toutes les listes sont visibles depuis l&apos;accueil. Le mot de passe protège seulement la
                  modification.
                </p>
              )}
              <div className="max-lg:fixed max-lg:inset-x-0 max-lg:bottom-0 max-lg:z-30 max-lg:bg-[linear-gradient(rgb(246_241_232/0),var(--color-paper)_35%)] max-lg:px-4 max-lg:pt-4 max-lg:pb-[max(20px,env(safe-area-inset-bottom))] lg:order-1">
                <Button
                  type="submit"
                  variant="ink"
                  size={58}
                  disabled={pending}
                  className="w-full px-[34px] lg:w-auto"
                >
                  Créer la liste
                </Button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

function Preview({ values }: { values: Values }) {
  const theme = ambianceTheme(values.ambiance);
  const title = values.title.trim();
  const owner = values.ownerName.trim();
  return (
    <section
      aria-label="Aperçu"
      className={cn(
        "relative flex h-[250px] flex-col justify-end overflow-hidden px-5 pb-10 lg:h-[calc(100dvh-48px)] lg:min-h-[640px] lg:rounded-[30px] lg:px-11 lg:pb-12 lg:shadow-[0_40px_80px_-40px_rgb(43_36_22/0.6)]",
        theme.texture,
        theme.text,
        theme.dark && "on-dark",
      )}
    >
      <span aria-hidden="true" className="absolute inset-0 grain-overlay" />
      {theme.dark ? (
        <Foliage className="top-10 right-[6%] h-[230px] w-[130px] opacity-50 lg:top-16 lg:h-[560px] lg:w-[300px]" />
      ) : null}
      <Link
        href="/"
        aria-label="Annuler"
        className={cn(
          "absolute top-2 left-3 flex size-11 items-center justify-center rounded-full border backdrop-blur-[12px] lg:hidden",
          theme.dark ? "border-linen/40 bg-linen/12 text-linen" : "border-line-strong bg-white/45 text-ink",
        )}
      >
        <X aria-hidden="true" size={20} strokeWidth={1.6} />
      </Link>
      <span
        className={cn(
          "absolute top-3.5 left-1/2 flex h-[30px] -translate-x-1/2 items-center rounded-full px-3 text-xs font-semibold lg:top-6 lg:left-7 lg:h-[34px] lg:translate-x-0 lg:px-3.5 lg:text-[13px]",
          theme.dark ? "glass-dark" : "glass-light",
        )}
      >
        Aperçu
      </span>
      <div className="relative flex flex-col gap-2 lg:gap-4" aria-hidden="true">
        <Caps tone={theme.dark ? "honey" : "soft"} size={11} className="tracking-[0.2em] lg:text-[13px]">
          La liste de {owner || "…"}
        </Caps>
        {title ? (
          <SplitTitle
            as="p"
            title={title}
            tracking="list"
            restColor={theme.italic}
            className={cn(
              "text-[58px] lg:text-[128px]",
              theme.dark && "[text-shadow:0_14px_50px_rgb(10_12_4/0.45)]",
            )}
          />
        ) : (
          <p
            className={cn(
              "m-0 font-display text-[58px] leading-[0.9] tracking-[-0.03em] lg:text-[128px]",
              theme.dark ? "text-linen/45" : "text-ink/35",
            )}
          >
            Ma <i className="font-light">liste</i>
          </p>
        )}
        {values.description.trim() ? (
          <p className="m-0 hidden max-w-[440px] font-note text-[22px] leading-[1.35] lg:block">
            {values.description.trim()}
          </p>
        ) : null}
      </div>
    </section>
  );
}

function Created({ created }: { created: CreatedList }) {
  const heading = useRef<HTMLHeadingElement>(null);
  // Rendu seulement après l'envoi, côté navigateur : l'adresse du site (production ou preview) est connue.
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  useEffect(() => heading.current?.focus(), []);
  const publicUrl = `${origin}/l/${created.slug}`;
  const secretUrl = `${origin}/l/${created.slug}/edition#cle=${created.editKey}`;

  return (
    <div className="on-dark relative isolate flex min-h-dvh flex-col overflow-clip tex-feuillage sm:items-center sm:justify-center sm:px-6 sm:py-16">
      <span aria-hidden="true" className="absolute inset-0 grain-overlay" />
      <Foliage className="top-20 left-[4%] hidden h-[760px] w-[300px] -scale-x-100 lg:block" />
      <div className="h-[120px] shrink-0 sm:hidden" aria-hidden="true" />
      <div className="relative flex flex-1 flex-col gap-[26px] rounded-t-sheet bg-paper px-5 pt-7 pb-44 text-ink sm:w-[620px] sm:flex-none sm:rounded-[32px] sm:border sm:border-white/60 sm:bg-paper/94 sm:px-12 sm:pt-11 sm:pb-10 sm:shadow-modal">
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 rounded-[inherit] opacity-50 grain-fine"
        />
        <span className="relative flex size-[52px] items-center justify-center rounded-full bg-olive text-linen">
          <Check aria-hidden="true" size={24} strokeWidth={2} />
        </span>
        <div className="relative">
          <h1 ref={heading} tabIndex={-1} className="m-0 outline-none">
            <SplitTitle
              as="span"
              title="C'est prêt."
              restColor="text-ochre"
              className="text-[42px] sm:text-[56px]"
            />
          </h1>
          <p className="m-0 mt-2 text-base text-ink-soft">
            « {created.title} » est en ligne. Gardez ces deux liens quelque part.
          </p>
        </div>
        <div className="relative flex flex-col gap-[26px]">
          <LinkBox
            variant="public"
            label="Lien à partager"
            hint="Pour vos proches. Lecture seule."
            url={publicUrl}
          />
          <LinkBox
            variant="secret"
            label="Lien secret de modification"
            hint="Ouvre la modification sans mot de passe, sur n'importe quel appareil. À ne pas partager. Il reste visible dans les réglages."
            url={secretUrl}
          />
        </div>
        <div className="relative flex flex-col gap-1 max-sm:fixed max-sm:inset-x-0 max-sm:bottom-0 max-sm:z-20 max-sm:bg-[linear-gradient(rgb(246_241_232/0),var(--color-paper)_25%)] max-sm:px-4 max-sm:pt-6 max-sm:pb-[max(16px,env(safe-area-inset-bottom))] sm:flex-row sm:gap-2.5">
          <Link
            href={`/l/${created.slug}/edition`}
            className={buttonClasses("ink", 56, "w-full sm:w-auto sm:px-7")}
          >
            Ajouter les premières envies
            <ArrowRight aria-hidden="true" />
          </Link>
          <Link
            href={`/l/${created.slug}`}
            className={buttonClasses(
              "ghost",
              56,
              "w-full sm:w-auto sm:border sm:border-line-strong sm:bg-white/45",
            )}
          >
            Voir la liste
          </Link>
        </div>
      </div>
    </div>
  );
}
