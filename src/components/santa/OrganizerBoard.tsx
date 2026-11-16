"use client";

import * as Dialog from "@radix-ui/react-dialog";
import {
  Check,
  CircleAlert,
  Mail,
  MailWarning,
  Plus,
  RefreshCw,
  Send,
  ShieldCheck,
  Trash2,
  Undo2,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition, type ReactNode } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { Field, TextArea } from "@/components/ui/Field";
import { LinkBox } from "@/components/ui/LinkBox";
import { cn } from "@/lib/cn";
import { MAX_PLAYERS, MIN_PLAYERS, ROUNDS } from "@/lib/magic/engine";
import { magicPlanProblems, type MagicPlan } from "@/lib/magic/plan";
import { launchProblems } from "@/lib/santa/schema";
import { SANTA_LIMITS as L, type OrganizerParticipant, type OrganizerView } from "@/lib/santa/types";
import { plural } from "@/lib/text";
import {
  cancelSanta,
  deleteSanta,
  launchSanta,
  resendInvite,
  saveSantaDraft,
  saveSantaSettings,
} from "@/server/actions/santa";
import { MagicOrganizer, MagicSettingsFields, type MagicSettingsValue } from "./MagicOrganizer";
import { SantaSection } from "./SantaShell";

type Row = { key: string; id?: string; firstName: string; lastName: string; email: string };

// Clés stables (rendu serveur puis navigateur identiques) : « n0 », « n1 »…
let rowCount = 0;
const newRow = (key = `n${rowCount++}`): Row => ({ key, firstName: "", lastName: "", email: "" });
const NETWORK = "Pas enregistré. Vérifiez la connexion.";

/** Heure locale saisie (« 2026-12-01T09:00 ») vers ISO ; vide si la saisie n'est pas une date. */
function localToIso(local: string): string {
  const date = local ? new Date(local) : null;
  return date && !Number.isNaN(date.getTime()) ? date.toISOString() : "";
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("fr-FR", {
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Page d'organisation : préparation (thèmes, participants), puis suivi après le lancement. */
export function OrganizerBoard({ view, organizerUrl }: { view: OrganizerView; organizerUrl: string }) {
  const { santa } = view;
  return (
    <div className="relative flex flex-col gap-10">
      <div className="flex flex-col gap-2">
        <p className="m-0 text-xs tracking-[0.18em] text-muted uppercase">
          Secret Santa · {santa.status === "launched" ? "tirage lancé" : "en préparation"}
        </p>
        <h1 className="m-0 font-display-72 text-[38px] leading-[1.05] font-normal sm:text-[56px]">
          {santa.title}
        </h1>
      </div>
      {santa.status === "launched" ? <Launched view={view} /> : <Draft view={view} />}
      <SantaSection title="Accès à l'organisation">
        <LinkBox
          label="Lien secret de l'organisation"
          hint="Il ouvre cette page sans mot de passe. Gardez-le pour vous."
          url={organizerUrl}
          variant="secret"
        />
      </SantaSection>
      <DangerZone view={view} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Préparation
// ---------------------------------------------------------------------------

function Draft({ view }: { view: OrganizerView }) {
  const router = useRouter();
  const { santa } = view;
  const [settings, setSettings] = useState({
    title: santa.title,
    message: santa.message ?? "",
    budget: santa.budget ?? "",
    exchangeDate: santa.exchangeDate ?? "",
  });
  const [themes, setThemes] = useState(view.themes.map((t) => t.label).join("\n"));
  const [rows, setRows] = useState<Row[]>(() =>
    view.participants.length
      ? view.participants.map((p) => ({
          key: p.id,
          id: p.id,
          firstName: p.firstName,
          lastName: p.lastName,
          email: p.email,
        }))
      : [newRow("n-a"), newRow("n-b"), newRow("n-c")],
  );
  const [magicOn, setMagicOn] = useState(Boolean(santa.magicPlan));
  const [magicValue, setMagicValue] = useState<MagicSettingsValue>({
    startsLocal: santa.magicPlan?.startsLocal ?? "",
    roundDays: String(santa.magicPlan?.roundDays ?? 7),
    level: santa.magicPlan?.level ?? "balanced",
  });
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);

  const themeList = themes
    .split("\n")
    .map((t) => t.trim())
    .filter(Boolean);
  const longTheme = themeList.find((t) => t.length > L.theme);
  const filled = rows.filter((r) => r.firstName.trim() || r.lastName.trim() || r.email.trim());
  const problems = launchProblems(
    themeList,
    filled.map((r) => r.email),
  );
  if (longTheme) {
    problems.push(
      `Le thème « ${longTheme.slice(0, 30)}… » dépasse ${L.theme} caractères. Un thème par ligne, sans virgule entre eux.`,
    );
  }
  if (filled.some((r) => !r.firstName.trim() || !/^\S+@\S+\.\S+$/.test(r.email.trim()))) {
    problems.push("Chaque participant a besoin d'un prénom et d'une adresse mail valable.");
  }
  const plan: MagicPlan | null = magicOn
    ? {
        startsAt: localToIso(magicValue.startsLocal),
        startsLocal: magicValue.startsLocal,
        roundDays: Math.min(14, Math.max(1, Math.round(Number(magicValue.roundDays)) || 7)),
        level: magicValue.level,
      }
    : null;
  problems.push(...magicPlanProblems(plan, filled.length));

  const touch = () => setDirty(true);
  const setRow = (key: string, patch: Partial<Row>) => {
    setRows((cur) => cur.map((r) => (r.key === key ? { ...r, ...patch } : r)));
    touch();
  };

  const save = async (): Promise<boolean> => {
    setError(null);
    try {
      const result = await saveSantaDraft(santa.id, {
        ...settings,
        themes: themeList,
        participants: filled.map((r) => ({
          id: r.id,
          firstName: r.firstName,
          lastName: r.lastName,
          email: r.email,
        })),
        magic: plan,
      });
      if (!result.ok) {
        setError(result.error.message);
        return false;
      }
      setDirty(false);
      router.refresh();
      return true;
    } catch {
      setError(NETWORK);
      return false;
    }
  };

  const launch = () =>
    startTransition(async () => {
      if (!(await save())) {
        setConfirming(false);
        return;
      }
      try {
        const result = await launchSanta(santa.id);
        setConfirming(false);
        if (!result.ok) {
          setError(result.error.message);
          return;
        }
        const { sent, failed, magic } = result.data;
        const mails = failed
          ? `${plural(sent, "mail envoyé", "mails envoyés")}, ${plural(failed, "échec", "échecs")}`
          : plural(sent, "mail envoyé", "mails envoyés");
        toast(
          magic === "opened"
            ? `Tirage lancé et Magie de Noël ouverte. ${mails}.`
            : magic === "failed"
              ? `Tirage lancé. ${mails}. Le jeu n'a pas pu s'ouvrir : ouvrez-le plus bas, chacun recevra un mail à part.`
              : `Tirage lancé. ${mails}.`,
          { duration: 8000 },
        );
        router.refresh();
      } catch {
        setConfirming(false);
        setError(NETWORK);
      }
    });

  return (
    <>
      <SantaSection title="Les informations" hint="Affichées à chaque participant, avec son tirage.">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Field
              label="Nom du Secret Santa"
              value={settings.title}
              maxLength={L.title}
              onChange={(e) => {
                setSettings((s) => ({ ...s, title: e.target.value }));
                touch();
              }}
            />
          </div>
          <Field
            label="Budget (facultatif)"
            placeholder="30 €"
            value={settings.budget}
            maxLength={L.budget}
            onChange={(e) => {
              setSettings((s) => ({ ...s, budget: e.target.value }));
              touch();
            }}
          />
          <Field
            label="Date de l'échange (facultatif)"
            type="date"
            value={settings.exchangeDate}
            onChange={(e) => {
              setSettings((s) => ({ ...s, exchangeDate: e.target.value }));
              touch();
            }}
          />
          <div className="sm:col-span-2">
            <TextArea
              label="Petit mot (facultatif)"
              rows={3}
              value={settings.message}
              maxLength={L.message}
              onChange={(e) => {
                setSettings((s) => ({ ...s, message: e.target.value }));
                touch();
              }}
            />
          </div>
        </div>
      </SantaSection>

      <SantaSection
        title="Les thèmes"
        hint="Un thème par ligne. Chaque participant en reçoit un différent ; il en faut au moins autant que de participants."
      >
        <TextArea
          label={plural(themeList.length, "thème", "thèmes")}
          rows={Math.min(12, Math.max(4, themeList.length + 1))}
          placeholder={"Fait main\nÀ lire\nPour la cuisine"}
          value={themes}
          onChange={(e) => {
            setThemes(e.target.value);
            touch();
          }}
        />
      </SantaSection>

      <SantaSection title="Les participants" hint="Chacun reçoit son lien par mail au lancement.">
        <ul className="m-0 flex list-none flex-col gap-3 p-0">
          {rows.map((row, i) => (
            <li
              key={row.key}
              className="grid grid-cols-[1fr_auto] gap-2 rounded-[18px] border border-ink/10 bg-white/35 p-3 sm:grid-cols-[1fr_1fr_1.4fr_auto] sm:border-0 sm:bg-transparent sm:p-0"
            >
              <label className="sr-only" htmlFor={`p-first-${row.key}`}>
                Prénom du participant {i + 1}
              </label>
              <input
                id={`p-first-${row.key}`}
                placeholder="Prénom"
                value={row.firstName}
                maxLength={L.firstName}
                autoComplete="off"
                onChange={(e) => setRow(row.key, { firstName: e.target.value })}
                className={inputClass}
              />
              <button
                type="button"
                aria-label={`Retirer le participant ${i + 1}`}
                onClick={() => {
                  setRows((cur) => cur.filter((r) => r.key !== row.key));
                  touch();
                }}
                className="row-span-3 flex size-11 items-center justify-center self-start rounded-full text-ink-soft hover:bg-ink/6 hover:text-rust sm:order-last sm:row-span-1"
              >
                <X aria-hidden="true" size={18} strokeWidth={1.8} />
              </button>
              <label className="sr-only" htmlFor={`p-last-${row.key}`}>
                Nom du participant {i + 1}
              </label>
              <input
                id={`p-last-${row.key}`}
                placeholder="Nom"
                value={row.lastName}
                maxLength={L.lastName}
                autoComplete="off"
                onChange={(e) => setRow(row.key, { lastName: e.target.value })}
                className={inputClass}
              />
              <label className="sr-only" htmlFor={`p-mail-${row.key}`}>
                Adresse mail du participant {i + 1}
              </label>
              <input
                id={`p-mail-${row.key}`}
                type="email"
                inputMode="email"
                placeholder="Adresse mail"
                value={row.email}
                maxLength={L.email}
                autoComplete="off"
                onChange={(e) => setRow(row.key, { email: e.target.value })}
                className={inputClass}
              />
            </li>
          ))}
        </ul>
        <div>
          <Button
            variant="outline"
            size={44}
            icon={<Plus aria-hidden="true" />}
            onClick={() => {
              setRows((cur) => [...cur, newRow()]);
              touch();
            }}
          >
            Ajouter un participant
          </Button>
        </div>
      </SantaSection>

      <SantaSection
        title="La Magie de Noël"
        hint={`Un jeu facultatif de ${ROUNDS} semaines, en parallèle des cadeaux. Activé avant le tirage, il s'ouvre au lancement, et chacun reçoit un seul mail pour les deux.`}
      >
        <label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-[18px] border border-ink/12 bg-white/35 p-4">
          <input
            type="checkbox"
            checked={magicOn}
            onChange={(e) => {
              setMagicOn(e.target.checked);
              touch();
            }}
            className="mt-0.5 size-5 shrink-0 accent-ochre-deep"
          />
          <span className="flex flex-col gap-0.5">
            <span className="text-base font-semibold">Jouer aussi à La Magie de Noël</span>
            <span className="text-sm text-ink-soft">
              Quelques Krampus tirés au sort se cachent parmi les participants. Chaque semaine, chacun peut
              désigner la personne qu&apos;il soupçonne d&apos;en être un, et une gazette raconte la suite par
              mail. De {MIN_PLAYERS} à {MAX_PLAYERS} participants.
            </span>
          </span>
        </label>
        {magicOn ? (
          <div className="grid gap-4 sm:grid-cols-3">
            <MagicSettingsFields
              value={magicValue}
              onChange={(patch) => {
                setMagicValue((v) => ({ ...v, ...patch }));
                touch();
              }}
            />
          </div>
        ) : null}
      </SantaSection>

      <div className="sticky bottom-3 z-20 flex flex-col gap-3 rounded-[22px] border border-ink/10 bg-paper/92 p-4 shadow-modal backdrop-blur-[14px] sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 flex-col gap-1 text-sm">
          {error ? (
            <p role="alert" className="m-0 flex items-center gap-1.5 font-semibold text-rust">
              <CircleAlert aria-hidden="true" size={16} />
              {error}
            </p>
          ) : problems.length ? (
            <p className="m-0 text-ink-soft">{problems[0]}</p>
          ) : !view.mailReady ? (
            <p className="m-0 text-ink-soft">L&apos;envoi des mails n&apos;est pas encore configuré.</p>
          ) : (
            <p className="m-0 text-ink-soft">
              {plural(filled.length, "participant", "participants")},{" "}
              {plural(themeList.length, "thème", "thèmes")}.{" "}
              {plan ? "Prêt à lancer, avec La Magie de Noël." : "Prêt à lancer."}
            </p>
          )}
        </div>
        <div className="flex shrink-0 gap-2">
          <Button
            variant="outline"
            size={46}
            disabled={pending || !dirty}
            onClick={() => startTransition(async () => void (await save()))}
          >
            {dirty ? "Enregistrer" : "Enregistré"}
          </Button>
          <Button
            size={46}
            icon={<Send aria-hidden="true" />}
            disabled={pending || problems.length > 0 || !view.mailReady}
            onClick={() => setConfirming(true)}
          >
            Lancer le tirage
          </Button>
        </div>
      </div>

      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title="Lancer le tirage ?"
        confirmLabel="Lancer et envoyer les mails"
        pending={pending}
        onConfirm={launch}
      >
        {plan
          ? `Chacun des ${filled.length} participants reçoit un seul mail : son tirage, et son rôle dans La Magie de Noël. `
          : `Chacun des ${filled.length} participants reçoit un mail avec son lien personnel. `}
        Le tirage ne se modifie plus ensuite : il faudra tout annuler et relancer.
      </ConfirmDialog>
    </>
  );
}

const inputClass =
  "h-12 min-w-0 rounded-field border border-ink/16 bg-field px-4 text-base text-ink outline-none focus:border-ink focus:shadow-[0_0_0_4px_rgb(167_106_25/0.2)]";

// ---------------------------------------------------------------------------
// Après le lancement
// ---------------------------------------------------------------------------

function Launched({ view }: { view: OrganizerView }) {
  const { santa, participants, check } = view;
  const confirmed = participants.filter((p) => p.confirmedAt).length;
  return (
    <>
      <div
        className={cn(
          "flex items-start gap-3 rounded-[20px] border p-4",
          check?.ok ? "border-olive/30 bg-olive/10" : "border-rust/30 bg-rust/8",
        )}
      >
        {check?.ok ? (
          <ShieldCheck aria-hidden="true" size={22} className="mt-0.5 shrink-0 text-olive-deep" />
        ) : (
          <CircleAlert aria-hidden="true" size={22} className="mt-0.5 shrink-0 text-rust" />
        )}
        <div className="flex flex-col gap-1">
          <p className="m-0 font-semibold">
            {check?.ok ? "Tirage vérifié" : "Tirage à refaire"}
            {santa.launchedAt ? (
              <span className="font-normal text-ink-soft"> · lancé le {formatDate(santa.launchedAt)}</span>
            ) : null}
          </p>
          <p className="m-0 text-sm text-ink-soft">
            {check?.ok
              ? `${check.count} participants : chacun offre à une seule personne, différente de lui-même, et reçoit un thème que personne d'autre n'a. Le contrôle ne révèle rien du tirage.`
              : `${check?.reason ?? "Contrôle impossible."} Annulez et relancez le tirage.`}
          </p>
        </div>
      </div>

      <MagicOrganizer santaId={santa.id} magic={view.magic} players={participants.length} />

      <SantaSection
        title="Les participants"
        hint={`${confirmed} sur ${participants.length} ont confirmé avoir vu leur tirage.`}
      >
        <ul className="m-0 flex list-none flex-col p-0">
          {participants.map((p) => (
            <ParticipantStatus key={p.id} santaId={santa.id} person={p} />
          ))}
        </ul>
      </SantaSection>

      <SantaSection title="Les thèmes" hint="Chacun en a reçu un différent.">
        <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
          {view.themes.map((t) => (
            <li key={t.id} className="rounded-full border border-ink/14 bg-white/45 px-3.5 py-1.5 text-sm">
              {t.label}
            </li>
          ))}
        </ul>
      </SantaSection>

      <LaunchedSettings view={view} />
    </>
  );
}

function Status({
  on,
  children,
  tone = "olive",
}: {
  on: boolean;
  children: ReactNode;
  tone?: "olive" | "rust";
}) {
  return (
    <span
      className={cn(
        "inline-flex h-7 items-center gap-1.5 rounded-full px-2.5 text-[13px] font-semibold",
        !on && "bg-ink/6 text-muted",
        on && tone === "olive" && "bg-olive/14 text-olive-deep",
        on && tone === "rust" && "bg-rust/12 text-rust",
      )}
    >
      {on ? <Check aria-hidden="true" size={14} strokeWidth={2.4} /> : null}
      {children}
    </span>
  );
}

function ParticipantStatus({ santaId, person }: { santaId: string; person: OrganizerParticipant }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [email, setEmail] = useState(person.email);
  const [pending, startTransition] = useTransition();

  const resend = (newEmail?: string) =>
    startTransition(async () => {
      try {
        const result = await resendInvite({ santaId, participantId: person.id, email: newEmail });
        if (!result.ok) {
          toast(result.error.message, { duration: 5000 });
          return;
        }
        toast(`Nouveau lien envoyé à ${person.firstName}.`, { duration: 4000 });
        setEditing(false);
        router.refresh();
      } catch {
        toast(NETWORK, { duration: 5000 });
      }
    });

  return (
    <li className="flex flex-col gap-2.5 border-b border-ink/10 py-4 last:border-0">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <span className="text-base font-semibold">
          {person.firstName} {person.lastName}
        </span>
        <span className="min-w-0 truncate text-sm text-ink-soft">{person.email}</span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {person.mailError && !person.mailedAt ? (
          <Status on tone="rust">
            <MailWarning aria-hidden="true" size={14} />
            Mail non parti
          </Status>
        ) : (
          <Status on={Boolean(person.mailedAt)}>
            {person.mailedAt ? null : <Mail aria-hidden="true" size={14} />}
            Mail envoyé
          </Status>
        )}
        <Status on={Boolean(person.openedAt)}>Lien ouvert</Status>
        <Status on={Boolean(person.confirmedAt)}>A confirmé</Status>
        <span className="ml-auto flex gap-1.5">
          <Button
            variant="ghost"
            size={40}
            disabled={pending}
            icon={<RefreshCw aria-hidden="true" />}
            onClick={() => resend()}
          >
            Renvoyer le lien
          </Button>
          <Button variant="ghost" size={40} disabled={pending} onClick={() => setEditing((v) => !v)}>
            Corriger l&apos;adresse
          </Button>
        </span>
      </div>
      {editing ? (
        <form
          className="flex flex-col gap-2 sm:flex-row"
          onSubmit={(e) => {
            e.preventDefault();
            resend(email);
          }}
        >
          <label className="sr-only" htmlFor={`fix-${person.id}`}>
            Nouvelle adresse de {person.firstName}
          </label>
          <input
            id={`fix-${person.id}`}
            type="email"
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={cn(inputClass, "flex-1")}
          />
          <Button type="submit" size={46} disabled={pending} icon={<Send aria-hidden="true" />}>
            Envoyer un nouveau lien
          </Button>
        </form>
      ) : null}
    </li>
  );
}

function LaunchedSettings({ view }: { view: OrganizerView }) {
  const router = useRouter();
  const { santa } = view;
  const [values, setValues] = useState({
    title: santa.title,
    message: santa.message ?? "",
    budget: santa.budget ?? "",
    exchangeDate: santa.exchangeDate ?? "",
  });
  const [pending, startTransition] = useTransition();
  const set = (patch: Partial<typeof values>) => setValues((v) => ({ ...v, ...patch }));
  return (
    <SantaSection
      title="Les informations"
      hint="Elles restent modifiables : chacun voit la dernière version sur sa page."
    >
      <form
        className="grid gap-4 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          startTransition(async () => {
            try {
              const result = await saveSantaSettings(santa.id, values);
              toast(result.ok ? "Enregistré" : result.error.message, { duration: 4000 });
              if (result.ok) router.refresh();
            } catch {
              toast(NETWORK, { duration: 5000 });
            }
          });
        }}
      >
        <div className="sm:col-span-2">
          <Field
            label="Nom du Secret Santa"
            value={values.title}
            maxLength={L.title}
            onChange={(e) => set({ title: e.target.value })}
          />
        </div>
        <Field
          label="Budget (facultatif)"
          value={values.budget}
          maxLength={L.budget}
          onChange={(e) => set({ budget: e.target.value })}
        />
        <Field
          label="Date de l'échange (facultatif)"
          type="date"
          value={values.exchangeDate}
          onChange={(e) => set({ exchangeDate: e.target.value })}
        />
        <div className="sm:col-span-2">
          <TextArea
            label="Petit mot (facultatif)"
            rows={3}
            value={values.message}
            maxLength={L.message}
            onChange={(e) => set({ message: e.target.value })}
          />
        </div>
        <div>
          <Button type="submit" variant="outline" size={46} disabled={pending}>
            Enregistrer
          </Button>
        </div>
      </form>
    </SantaSection>
  );
}

// ---------------------------------------------------------------------------

function DangerZone({ view }: { view: OrganizerView }) {
  const router = useRouter();
  const { santa } = view;
  const [cancelOpen, setCancelOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [confirmTitle, setConfirmTitle] = useState("");
  const [pending, startTransition] = useTransition();

  return (
    <SantaSection title="Tout recommencer">
      <div className="flex flex-wrap gap-2.5">
        {santa.status === "launched" ? (
          <Button
            variant="rust-outline"
            size={46}
            icon={<Undo2 aria-hidden="true" />}
            onClick={() => setCancelOpen(true)}
          >
            Tout annuler
          </Button>
        ) : null}
        <Button
          variant="rust-outline"
          size={46}
          icon={<Trash2 aria-hidden="true" />}
          onClick={() => setDeleteOpen(true)}
        >
          Supprimer le Secret Santa
        </Button>
      </div>

      <ConfirmDialog
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        title="Tout annuler ?"
        confirmLabel="Tout annuler"
        danger
        pending={pending}
        onConfirm={() =>
          startTransition(async () => {
            const result = await cancelSanta(santa.id).catch(() => null);
            setCancelOpen(false);
            if (!result?.ok) {
              toast(result?.error.message ?? NETWORK, { duration: 5000 });
              return;
            }
            toast("Tirage annulé. Les liens envoyés ne valent plus.", { duration: 5000 });
            router.refresh();
          })
        }
      >
        Les liens déjà envoyés ne fonctionneront plus. Vous pourrez modifier les thèmes et les participants,
        puis relancer un nouveau tirage : chacun recevra un nouveau mail.
      </ConfirmDialog>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Supprimer le Secret Santa ?"
        confirmLabel="Supprimer définitivement"
        danger
        pending={pending}
        disabled={confirmTitle.trim() !== santa.title.trim()}
        onConfirm={() =>
          startTransition(async () => {
            const result = await deleteSanta({ santaId: santa.id, confirmTitle }).catch(() => null);
            if (!result?.ok) {
              toast(result?.error.message ?? NETWORK, { duration: 5000 });
              return;
            }
            router.push("/lutins");
          })
        }
      >
        <span className="flex flex-col gap-3">
          <span>
            Tout disparaît : participants, tirage, fiches et listes d&apos;idées. Tapez « {santa.title} » pour
            confirmer.
          </span>
          <input
            aria-label="Nom du Secret Santa"
            value={confirmTitle}
            onChange={(e) => setConfirmTitle(e.target.value)}
            className={inputClass}
          />
        </span>
      </ConfirmDialog>
    </SantaSection>
  );
}

function ConfirmDialog({
  open,
  onOpenChange,
  title,
  confirmLabel,
  onConfirm,
  pending,
  danger = false,
  disabled = false,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  confirmLabel: string;
  onConfirm: () => void;
  pending: boolean;
  danger?: boolean;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-[rgb(24_20_10/0.5)] backdrop-blur-[6px]" />
        <Dialog.Content className="fixed inset-x-3 bottom-3 z-50 flex flex-col gap-4 rounded-[28px] bg-paper p-6 text-ink shadow-modal outline-none sm:inset-x-auto sm:top-1/2 sm:bottom-auto sm:left-1/2 sm:w-[480px] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:p-9">
          <Dialog.Title className="m-0 font-display-72 text-[28px] leading-tight font-normal">
            {title}
          </Dialog.Title>
          <Dialog.Description asChild>
            <div className="text-[15px] leading-normal text-ink-soft">{children}</div>
          </Dialog.Description>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Dialog.Close asChild>
              <Button variant="ghost" size={46}>
                Annuler
              </Button>
            </Dialog.Close>
            <Button
              variant={danger ? "rust" : "ink"}
              size={46}
              disabled={pending || disabled}
              onClick={onConfirm}
            >
              {confirmLabel}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
