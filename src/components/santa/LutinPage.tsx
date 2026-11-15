"use client";

import { ArrowRight, Check, Gift, ListPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { Field, TextArea } from "@/components/ui/Field";
import { SANTA_LIMITS as L, type LutinProfile, type LutinView } from "@/lib/santa/types";
import { confirmLutin, openMyList, openTargetList, saveLutinProfile } from "@/server/actions/santa";
import { SantaSection } from "./SantaShell";

const NETWORK = "Pas enregistré. Vérifiez la connexion.";

function formatDay(iso: string) {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  });
}

/** Page d'un lutin, ouverte par son lien personnel : son tirage, sa fiche, sa liste d'idées. */
export function LutinPage({ token, view }: { token: string; view: LutinView }) {
  const router = useRouter();
  const { santa, me, target } = view;
  const [confirmed, setConfirmed] = useState(Boolean(me.confirmedAt));
  const [pending, startTransition] = useTransition();

  const run = <T,>(
    action: () => Promise<{ ok: true; data: T } | { ok: false; error: { message: string } }>,
    then: (data: T) => void,
  ) =>
    startTransition(async () => {
      try {
        const result = await action();
        if (result.ok) then(result.data);
        else toast(result.error.message, { duration: 5000 });
      } catch {
        toast(NETWORK, { duration: 5000 });
      }
    });

  const details = [
    santa.budget ? { label: "Budget", value: santa.budget } : null,
    santa.exchangeDate ? { label: "Échange des cadeaux", value: formatDay(santa.exchangeDate) } : null,
  ].filter((d): d is { label: string; value: string } => d !== null);

  return (
    <div className="relative flex flex-col gap-10">
      <div className="flex flex-col gap-6">
        <p className="m-0 text-xs tracking-[0.18em] text-muted uppercase">{santa.title}</p>
        <p className="m-0 text-lg text-ink-soft">Bonjour {me.firstName}, vous offrez un cadeau à</p>
        <h1 className="m-0 -mt-3 font-display-72 text-[44px] leading-[1.02] font-normal sm:text-[64px]">
          {target.firstName} <i className="font-light text-ochre">{target.lastName}</i>
        </h1>
        <div className="flex flex-col gap-1 rounded-[22px] border border-ochre/25 bg-ochre/8 px-5 py-4">
          <span className="text-xs tracking-[0.18em] text-ochre-deep uppercase">Votre thème</span>
          <span className="font-display-72 text-[30px] leading-tight sm:text-[36px]">{view.theme}</span>
        </div>
        {details.length ? (
          <dl className="m-0 grid grid-cols-2 gap-3">
            {details.map((d) => (
              <div key={d.label} className="flex flex-col-reverse gap-0.5">
                <dt className="text-xs text-muted">{d.label}</dt>
                <dd className="m-0 text-base font-semibold first-letter:uppercase">{d.value}</dd>
              </div>
            ))}
          </dl>
        ) : null}
        {santa.message ? (
          <p className="m-0 font-note text-xl leading-[1.4] whitespace-pre-line text-ink-soft">
            {santa.message}
          </p>
        ) : null}
        {confirmed ? (
          <p role="status" className="m-0 flex items-center gap-2 text-base font-semibold text-olive-deep">
            <Check aria-hidden="true" size={18} strokeWidth={2.4} />
            C&apos;est noté. Gardez le secret.
          </p>
        ) : (
          <Button
            size={52}
            disabled={pending}
            icon={<Check aria-hidden="true" />}
            onClick={() =>
              run(
                () => confirmLutin(token),
                () => setConfirmed(true),
              )
            }
          >
            J&apos;ai bien noté
          </Button>
        )}
      </div>

      <SantaSection title={`Ce que ${target.firstName} a indiqué`}>
        <ProfileView profile={target.profile} name={target.firstName} />
        {target.hasList ? (
          <div>
            <Button
              variant="outline"
              size={46}
              disabled={pending}
              icon={<Gift aria-hidden="true" />}
              iconRight={<ArrowRight aria-hidden="true" />}
              onClick={() =>
                run(
                  () => openTargetList(token),
                  ({ slug }) => router.push(`/l/${slug}`),
                )
              }
            >
              Voir sa liste d&apos;idées
            </Button>
          </div>
        ) : (
          <p className="m-0 text-sm text-muted">
            {target.firstName} n&apos;a pas encore fait sa liste d&apos;idées.
          </p>
        )}
      </SantaSection>

      <SantaSection
        title="Ma fiche, pour mon Santa"
        hint="Seule la personne qui vous a tiré la verra. Tout est facultatif."
      >
        <ProfileForm token={token} initial={me.profile} />
        <div>
          <Button
            variant="outline"
            size={46}
            disabled={pending}
            icon={<ListPlus aria-hidden="true" />}
            onClick={() =>
              run(
                () => openMyList(token),
                ({ slug }) => router.push(`/l/${slug}/edition`),
              )
            }
          >
            {me.hasList ? "Modifier ma liste d'idées" : "Créer ma liste d'idées"}
          </Button>
        </div>
      </SantaSection>
    </div>
  );
}

function ProfileView({ profile, name }: { profile: LutinProfile; name: string }) {
  const rows = [
    { label: "Âge", value: profile.age },
    { label: "Pointure", value: profile.shoeSize },
    { label: "Taille de vêtements", value: profile.clothingSize },
  ].filter((r) => r.value);
  if (!rows.length && !profile.tastes) {
    return <p className="m-0 text-sm text-muted">{name} n&apos;a encore rien indiqué.</p>;
  }
  return (
    <div className="flex flex-col gap-4">
      {rows.length ? (
        <dl className="m-0 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {rows.map((r) => (
            <div key={r.label} className="flex flex-col-reverse gap-0.5">
              <dt className="text-xs text-muted">{r.label}</dt>
              <dd className="m-0 text-base font-semibold">{r.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {profile.tastes ? (
        <div className="flex flex-col gap-1">
          <span className="text-xs text-muted">Goûts et envies</span>
          <p className="m-0 text-[15px] leading-normal whitespace-pre-line">{profile.tastes}</p>
        </div>
      ) : null}
    </div>
  );
}

function ProfileForm({ token, initial }: { token: string; initial: LutinProfile }) {
  const [values, setValues] = useState(initial);
  const [saved, setSaved] = useState(true);
  const [pending, startTransition] = useTransition();
  const set = (patch: Partial<LutinProfile>) => {
    setValues((v) => ({ ...v, ...patch }));
    setSaved(false);
  };
  return (
    <form
      className="grid gap-4 sm:grid-cols-3"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          try {
            const result = await saveLutinProfile(token, values);
            if (result.ok) setSaved(true);
            else toast(result.error.message, { duration: 5000 });
          } catch {
            toast(NETWORK, { duration: 5000 });
          }
        });
      }}
    >
      <Field
        label="Âge"
        value={values.age}
        maxLength={L.age}
        onChange={(e) => set({ age: e.target.value })}
      />
      <Field
        label="Pointure"
        value={values.shoeSize}
        maxLength={L.shoeSize}
        onChange={(e) => set({ shoeSize: e.target.value })}
      />
      <Field
        label="Taille de vêtements"
        placeholder="M, 40…"
        value={values.clothingSize}
        maxLength={L.clothingSize}
        onChange={(e) => set({ clothingSize: e.target.value })}
      />
      <div className="sm:col-span-3">
        <TextArea
          label="Goûts et envies"
          rows={4}
          placeholder="Art, musique, astronomie, ce que vous aimez ou n'aimez pas…"
          value={values.tastes}
          maxLength={L.tastes}
          onChange={(e) => set({ tastes: e.target.value })}
        />
      </div>
      <div>
        <Button type="submit" size={46} disabled={pending || saved}>
          {saved ? "Enregistré" : "Enregistrer ma fiche"}
        </Button>
      </div>
    </form>
  );
}
