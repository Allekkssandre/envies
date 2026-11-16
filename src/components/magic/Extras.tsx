"use client";

import { Search, Sparkles } from "lucide-react";
import { useState, useTransition, type ReactNode } from "react";
import { toast } from "sonner";
import { ATOUTS, type AtoutKind } from "@/lib/magic/engine";
import { ATOUT_NAME, ATOUT_TEXT, atoutResultText, clueText } from "@/lib/magic/texts";
import type { MagicView, NoteMark } from "@/lib/magic/types";
import type { Result } from "@/server/actions/result";
import { noteMagic, playAtoutMagic } from "@/server/actions/magic";
import { Flourish, Garland, HollyPin } from "./Decor";

// Le facultatif : le pouvoir, le carnet d'enquête.
// Rien de tout cela ne touche au score.

const NETWORK = "Pas enregistré. Vérifiez la connexion.";

function useAct(refresh: () => Promise<void>) {
  const [pending, startTransition] = useTransition();
  const act = (run: () => Promise<Result<null>>, done?: () => void) =>
    startTransition(async () => {
      try {
        const result = await run();
        if (!result.ok) toast(result.error.message, { duration: 5000 });
        else done?.();
      } catch {
        toast(NETWORK, { duration: 5000 });
      }
      await refresh();
    });
  return [pending, act] as const;
}

function Panel({
  title,
  icon,
  tone = "sapin",
  children,
}: {
  title: string;
  icon: ReactNode;
  tone?: "sapin" | "velours";
  children: ReactNode;
}) {
  return (
    <section
      aria-label={title}
      data-garland=""
      data-tone={tone}
      className="mg-panel flex flex-col gap-4 px-5 py-6 sm:px-7"
    >
      <Garland accent={tone === "velours" ? "gold" : "red"} />
      <div className="flex flex-col gap-1">
        <h2 className="mg-title m-0 flex items-center gap-3 text-[26px] leading-tight font-normal sm:text-[30px]">
          <span className="text-[var(--mg-gold)]">{icon}</span>
          {title}
        </h2>
        <Flourish />
      </div>
      {children}
    </section>
  );
}

const soft = "m-0 text-[15px] leading-normal text-[var(--mg-soft)]";

// ---------------------------------------------------------------------------
// Atout
// ---------------------------------------------------------------------------

export function AtoutPanel({
  view,
  token,
  refresh,
}: {
  view: MagicView;
  token: string;
  refresh: () => Promise<void>;
}) {
  const [pending, act] = useAct(refresh);
  const [chosen, setChosen] = useState<AtoutKind | null>(null);
  const [targets, setTargets] = useState<string[]>([]);
  const [option, setOption] = useState<number | null>(null);
  const [confirming, setConfirming] = useState(false);
  const { atout } = view;

  if (atout.state === "used") {
    return (
      <Panel title="Votre pouvoir" tone="velours" icon={<Sparkles aria-hidden="true" size={22} />}>
        <p className="mg-kicker m-0">{ATOUT_NAME[atout.kind]} · déjà joué</p>
        <p className="m-0 rounded-2xl border border-[var(--mg-line)] bg-white/[0.04] px-4 py-3 text-[16px] leading-normal">
          {atoutResultText(atout)}
        </p>
      </Panel>
    );
  }
  if (atout.state === "locked") {
    return (
      <Panel title="Votre pouvoir" tone="velours" icon={<Sparkles aria-hidden="true" size={22} />}>
        <p className={soft}>
          {view.status === "waiting"
            ? "Vous pourrez jouer votre pouvoir une fois la partie commencée. Il ne sert qu'une fois."
            : view.status === "playing"
              ? "Votre rôle a été révélé : votre pouvoir ne peut plus servir."
              : "La partie est terminée : les pouvoirs sont rangés."}
        </p>
      </Panel>
    );
  }

  const kinds = ATOUTS[view.me.role];
  const kind = kinds.length === 1 ? kinds[0]! : chosen;
  const others = view.players.filter((p) => !p.me && !p.out);
  const fakeBlocked = atout.fakeTaken || atout.options.length === 0;
  const ready =
    kind === "loupe"
      ? targets.length === 2
      : kind === "fausse_piste"
        ? option !== null && !fakeBlocked
        : kind === "alibi";

  const play = () => {
    if (!kind) return;
    const input =
      kind === "loupe"
        ? { kind, targets: [targets[0]!, targets[1]!] as [string, string] }
        : kind === "fausse_piste"
          ? { kind, option: option! }
          : { kind };
    act(
      () => playAtoutMagic(token, input),
      () => setConfirming(false),
    );
  };

  return (
    <Panel title="Votre pouvoir" tone="velours" icon={<Sparkles aria-hidden="true" size={22} />}>
      <p className={soft}>
        Facultatif, et une seule fois dans toute la partie. Personne ne saura que vous l&apos;avez joué.
      </p>

      {kinds.length > 1 ? (
        <div className="grid gap-2.5 sm:grid-cols-2" role="radiogroup" aria-label="Choix du pouvoir">
          {kinds.map((k) => (
            <button
              key={k}
              type="button"
              role="radio"
              aria-checked={chosen === k}
              className="mg-suspect w-full flex-col !items-start gap-1 !p-4"
              onClick={() => {
                setChosen(k);
                setConfirming(false);
              }}
            >
              <span className="font-semibold text-[var(--mg-gold-hi)]">{ATOUT_NAME[k]}</span>
              <span className="text-[14px] leading-snug text-[var(--mg-soft)]">{ATOUT_TEXT[k]}</span>
            </button>
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-1">
          <p className="mg-kicker m-0">{ATOUT_NAME.loupe}</p>
          <p className="m-0 text-[15px] leading-normal">{ATOUT_TEXT.loupe}</p>
        </div>
      )}

      {kind === "loupe" ? (
        <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
          <legend className="mb-2 text-[15px]">Les deux joueurs à examiner ({targets.length} sur 2) :</legend>
          <ul className="m-0 grid list-none grid-cols-1 gap-2 p-0 min-[420px]:grid-cols-2 xl:grid-cols-3">
            {others.map((p) => {
              const on = targets.includes(p.id);
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    className="mg-suspect w-full"
                    aria-pressed={on}
                    disabled={!on && targets.length >= 2}
                    onClick={() => {
                      setConfirming(false);
                      setTargets((t) => (on ? t.filter((x) => x !== p.id) : [...t, p.id]));
                    }}
                  >
                    <span className="mg-avatar" aria-hidden="true">
                      {p.name.charAt(0)}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{p.name}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </fieldset>
      ) : null}

      {kind === "fausse_piste" ? (
        fakeBlocked ? (
          <p className={soft}>
            {atout.fakeTaken
              ? "Un autre Krampus a déjà préparé une fausse piste pour la gazette de cette semaine. Réessayez la semaine prochaine."
              : "Plus de gazette à truquer : c'est la dernière semaine."}
          </p>
        ) : (
          <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
            <legend className="mb-2 text-[15px]">Le faux indice à publier en fin de semaine :</legend>
            {atout.options.map((clue, i) => (
              <label
                key={i}
                className="mg-suspect w-full cursor-pointer !items-start !py-3"
                data-checked={option === i}
              >
                <input
                  type="radio"
                  name="fausse-piste"
                  className="mt-1 accent-[var(--mg-gold)]"
                  checked={option === i}
                  onChange={() => {
                    setOption(i);
                    setConfirming(false);
                  }}
                />
                <span className="text-[15px] leading-snug">{clueText(clue)}</span>
              </label>
            ))}
          </fieldset>
        )
      ) : null}

      {kind ? (
        confirming ? (
          <div className="flex flex-wrap items-center gap-2.5">
            <button type="button" className="mg-btn" disabled={pending || !ready} onClick={play}>
              Oui, jouer {ATOUT_NAME[kind].toLowerCase()}
            </button>
            <button type="button" className="mg-btn-ghost" onClick={() => setConfirming(false)}>
              Pas encore
            </button>
            <span className="w-full text-[13px] text-[var(--mg-faint)]">
              Il n&apos;y a pas de retour en arrière.
            </span>
          </div>
        ) : (
          <button
            type="button"
            className="mg-btn self-start"
            disabled={!ready}
            onClick={() => setConfirming(true)}
          >
            Jouer {ATOUT_NAME[kind].toLowerCase()}
          </button>
        )
      ) : null}
    </Panel>
  );
}

// ---------------------------------------------------------------------------
// Carnet d'enquête
// ---------------------------------------------------------------------------

const MARKS: { value: NoteMark | null; label: string }[] = [
  { value: null, label: "?" },
  { value: "suspect", label: "Suspect" },
  { value: "innocent", label: "Innocent" },
];

export function NotebookPanel({
  view,
  token,
  onChange,
}: {
  view: MagicView;
  token: string;
  onChange: (notes: MagicView["notes"]) => void;
}) {
  const others = view.players.filter((p) => !p.me);
  const set = async (targetId: string, mark: NoteMark | null) => {
    const before = view.notes;
    const next = { ...view.notes };
    if (mark) next[targetId] = mark;
    else delete next[targetId];
    onChange(next);
    try {
      const result = await noteMagic(token, { targetId, mark });
      if (!result.ok) throw new Error(result.error.message);
    } catch {
      onChange(before);
      toast(NETWORK, { duration: 5000 });
    }
  };
  return (
    <details data-pin="" className="mg-panel px-5 py-4 sm:px-7">
      <summary className="flex min-h-11 items-center justify-between gap-3 text-[17px] font-semibold">
        <HollyPin />
        <span className="flex items-center gap-3">
          <Search aria-hidden="true" size={20} className="text-[var(--mg-gold)]" />
          Mon carnet d&apos;enquête
        </span>
        <span aria-hidden="true" className="text-[var(--mg-gold)]">
          +
        </span>
      </summary>
      <p className={`${soft} mt-2`}>
        Vos notes sur chaque joueur, pour ne rien oublier d&apos;une semaine à l&apos;autre. Vous seul les
        voyez, et elles n&apos;ont aucun effet sur le jeu.
      </p>
      <ul className="m-0 mt-4 flex list-none flex-col gap-2 p-0">
        {others.map((p) => {
          const mark = view.notes[p.id] ?? null;
          return (
            <li
              key={p.id}
              className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--mg-line)] pt-2"
            >
              <span className="text-[15px]">
                {p.name}
                {p.out ? (
                  <span className="ml-2 text-[13px] text-[var(--mg-faint)]">
                    rôle révélé : {p.out === "gr" ? "Krampus" : "Père Noël"}
                  </span>
                ) : null}
              </span>
              <span className="mg-segmented" role="group" aria-label={`Note sur ${p.name}`}>
                {MARKS.map((m) => (
                  <button
                    key={m.label}
                    type="button"
                    aria-pressed={mark === m.value}
                    data-mark={m.value ?? "none"}
                    onClick={() => void set(p.id, m.value)}
                  >
                    {m.label}
                  </button>
                ))}
              </span>
            </li>
          );
        })}
      </ul>
    </details>
  );
}
