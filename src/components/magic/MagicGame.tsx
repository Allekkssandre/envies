"use client";

import { ArrowLeft, Check, X } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState, useTransition, type ReactNode } from "react";
import { toast } from "sonner";
import { CERT_ROUND, ROUNDS } from "@/lib/magic/engine";
import {
  CAMP_LABEL,
  RULES,
  ROLE_HINT,
  ROLE_LABEL,
  endText,
  formatMoment,
  pointDetailText,
} from "@/lib/magic/texts";
import type { MagicView } from "@/lib/magic/types";
import { getMagicView, voteMagic } from "@/server/actions/magic";
import { AtoutPanel, LetterPanel, NotebookPanel } from "./Extras";
import { Flourish, Garland, HollyPin } from "./Decor";
import { GazetteCard } from "./GazetteCard";
import { MagicGlobe } from "./MagicGlobe";
import { RoleCard, useFlipped } from "./RoleCard";
import { ScorePanel } from "./ScorePanel";

const NETWORK = "Pas enregistré. Vérifiez la connexion.";
const POLL_MS = 20_000;

/** La Magie de Noël, vue d'un joueur : Magie, rôle, suspect de la semaine, gazettes. */
export function MagicGame({ token, initial }: { token: string; initial: MagicView }) {
  const [view, setView] = useState(initial);
  const [pending, startTransition] = useTransition();
  const [flipped, flip] = useFlipped(`mg-card:${token.slice(0, 12)}`);

  const refresh = useCallback(async () => {
    try {
      const result = await getMagicView(token);
      if (result.ok) setView(result.data);
    } catch {
      // Hors ligne : on garde l'affichage, le prochain passage réessaie.
    }
  }, [token]);

  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    const timer = setInterval(tick, POLL_MS);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [refresh]);

  const vote = (targetId: string | null) => {
    const before = view.vote.mine;
    setView((v) => ({ ...v, vote: { ...v.vote, mine: targetId } }));
    startTransition(async () => {
      try {
        const result = await voteMagic(token, targetId);
        if (!result.ok) {
          toast(result.error.message, { duration: 5000 });
          setView((v) => ({ ...v, vote: { ...v.vote, mine: before } }));
        }
      } catch {
        toast(NETWORK, { duration: 5000 });
        setView((v) => ({ ...v, vote: { ...v.vote, mine: before } }));
      }
      await refresh();
    });
  };

  const [latest, ...older] = view.gazettes;

  return (
    <div className="relative flex flex-col gap-8 sm:gap-10">
      <header className="flex flex-col gap-3">
        <Link href={`/lutins/moi/${token}`} className="mg-btn-ghost -ml-3 self-start no-underline">
          <ArrowLeft aria-hidden="true" size={18} strokeWidth={1.7} />
          Mon tirage
        </Link>
        <p className="mg-kicker m-0">{view.title}</p>
        <h1 className="mg-title m-0 text-[44px] leading-[1.02] font-normal sm:text-[64px]">
          La Magie <em className="font-light">de</em> Noël
        </h1>
        <p className="m-0 text-[16px] leading-normal text-[var(--mg-soft)]">
          <StatusLine view={view} />
        </p>
      </header>

      <div className="grid gap-10 lg:grid-cols-[360px_minmax(0,1fr)] lg:items-start lg:gap-14">
        <div className="flex flex-col gap-10 lg:sticky lg:top-8">
          <section aria-label="Compteur de Magie" className="flex justify-center">
            <MagicGlobe value={view.magic} max={view.startMagic} />
          </section>
          <section aria-label="Mon rôle" className="flex flex-col gap-5">
            <RoleCard role={view.me.role} flipped={flipped} onFlip={flip} />
            {flipped ? <RoleDetails view={view} /> : null}
          </section>
        </div>

        <div className="flex flex-col gap-10">
          {view.reveal ? <Reveal view={view} /> : null}
          <SuspectPanel view={view} pending={pending} onVote={vote} />
          <AtoutPanel view={view} token={token} refresh={refresh} />
          <ScorePanel view={view} />
          {latest ? (
            <section aria-label="Gazette" className="flex flex-col gap-4">
              <GazetteCard gazette={latest} title={view.title} />
              {older.length ? (
                <details className="flex flex-col gap-4">
                  <summary className="mg-btn-ghost -ml-3">Les numéros précédents ({older.length})</summary>
                  <div className="mt-3 flex flex-col gap-4">
                    {older.map((g) => (
                      <GazetteCard key={g.round} gazette={g} title={view.title} />
                    ))}
                  </div>
                </details>
              ) : null}
            </section>
          ) : null}
          <LetterPanel
            key={`${view.round}-${view.letter.mine ?? ""}`}
            view={view}
            token={token}
            refresh={refresh}
          />
          <NotebookPanel view={view} token={token} onChange={(notes) => setView((v) => ({ ...v, notes }))} />
          <details data-pin="" data-tone="nuit" className="mg-panel px-5 py-4 sm:px-7">
            <summary className="flex min-h-11 items-center justify-between gap-3 text-[17px] font-semibold">
              <HollyPin />
              Comment ça se joue
              <span aria-hidden="true" className="text-[var(--mg-gold)]">
                +
              </span>
            </summary>
            <ol className="m-0 mt-3 flex flex-col gap-2.5 pl-5 text-[15px] leading-relaxed text-[var(--mg-soft)]">
              {RULES.map((rule) => (
                <li key={rule}>{rule}</li>
              ))}
            </ol>
          </details>
        </div>
      </div>
    </div>
  );
}

function StatusLine({ view }: { view: MagicView }) {
  if (view.status === "waiting") {
    return (
      <>
        La partie commence le {formatMoment(view.startsAt)}. En attendant, découvrez votre rôle et lisez le
        premier indice.
      </>
    );
  }
  if (view.status === "playing" && view.round && view.deadline) {
    return (
      <>
        Semaine {view.round} sur {ROUNDS}. Vous avez jusqu&apos;au {formatMoment(view.deadline)} pour désigner
        votre suspect.
      </>
    );
  }
  const end = view.gazettes[0] ? endText(view.gazettes[0]) : null;
  return (
    <>
      Partie terminée. {end ?? (view.winner ? `Victoire pour ${CAMP_LABEL[view.winner]}.` : "")}{" "}
      {view.status === "revealed"
        ? "Tous les rôles sont dévoilés."
        : "Les rôles seront bientôt dévoilés par l'organisation."}
    </>
  );
}

function Note({ children }: { children: ReactNode }) {
  return (
    <p className="m-0 rounded-2xl border border-[var(--mg-line)] bg-white/[0.04] px-4 py-3 text-[15px] leading-normal">
      {children}
    </p>
  );
}

function RoleDetails({ view }: { view: MagicView }) {
  const { me } = view;
  const certSoon = (view.status === "waiting" || (view.round ?? 0) <= CERT_ROUND) && !me.cert;
  return (
    <div className="flex flex-col gap-3">
      {me.out ? (
        <Note>
          {me.role === "gr"
            ? "Votre rôle a été révélé à tous : vous ne retirez plus de Magie et ne pouvez plus désigner personne. Restez pour voir comment tout cela finit."
            : "Votre rôle a été révélé à tous : chacun sait maintenant que vous êtes un Père Noël. Vous pouvez continuer à désigner les Krampus présumés."}
        </Note>
      ) : null}
      {!me.out || me.role === "pn" ? (
        <p className="m-0 text-[15px] leading-normal text-[var(--mg-soft)]">{ROLE_HINT[me.role]}</p>
      ) : null}
      {me.role === "gr" ? (
        <Note>
          {me.accomplices.length ? (
            <>
              Les autres Krampus :{" "}
              {me.accomplices.map((a, i) => (
                <span key={a.name}>
                  {i ? ", " : ""}
                  <strong>{a.name}</strong>
                  {a.out ? " (rôle révélé)" : ""}
                </span>
              ))}
              .
            </>
          ) : (
            "Vous êtes le seul Krampus de la partie. À vous de jouer finement."
          )}
        </Note>
      ) : null}
      {me.cert ? (
        <Note>
          <span className="mg-kicker block">Votre secret</span>
          Les lutins vous le garantissent : <strong>{me.cert}</strong> n&apos;est pas un Krampus. Gardez-le
          pour vous ou dites-le aux autres, à vous de voir.
        </Note>
      ) : me.role === "pn" && certSoon ? (
        <p className="m-0 text-[14px] text-[var(--mg-faint)]">
          À la fin de la semaine {CERT_ROUND}, les lutins vous donneront ici le nom d&apos;un joueur qui
          n&apos;est pas un Krampus.
        </p>
      ) : me.role === "gr" && certSoon ? (
        <p className="m-0 text-[14px] text-[var(--mg-faint)]">
          À la fin de la semaine {CERT_ROUND}, chaque Père Noël recevra en secret le nom d&apos;un joueur qui
          n&apos;est pas un Krampus. Vous, rien. Mais vous pouvez prétendre en avoir reçu un.
        </p>
      ) : null}
    </div>
  );
}

function SuspectPanel({
  view,
  pending,
  onVote,
}: {
  view: MagicView;
  pending: boolean;
  onVote: (id: string | null) => void;
}) {
  const candidates = view.players.filter((p) => !p.me && !p.out);
  const fallen = view.players.filter((p) => p.out);
  const mine = view.players.find((p) => p.id === view.vote.mine);
  const playing = view.status === "playing";
  return (
    <section
      aria-label="Votre suspect"
      data-garland=""
      data-tone="sapin"
      className="mg-panel flex flex-col gap-5 px-5 py-6 sm:px-7"
    >
      <Garland />
      <div className="flex flex-col gap-1.5">
        <h2 className="mg-title m-0 text-[28px] leading-tight font-normal sm:text-[32px]">
          {playing ? `Votre suspect de la semaine ${view.round}` : "Votre suspect"}
        </h2>
        <Flourish />
        {view.status === "waiting" ? (
          <p className="m-0 text-[15px] leading-normal text-[var(--mg-soft)]">
            Vous pourrez désigner la personne que vous soupçonnez d&apos;être un Krampus à partir du{" "}
            {formatMoment(view.startsAt)}.
          </p>
        ) : playing && !view.vote.open ? (
          <p className="m-0 text-[15px] leading-normal text-[var(--mg-soft)]">
            Votre rôle a été révélé à tous : vous ne pouvez plus désigner personne.
          </p>
        ) : playing ? (
          <p className="m-0 text-[15px] leading-normal text-[var(--mg-soft)]">
            Choisissez la personne que vous soupçonnez d&apos;être un Krampus. Rien d&apos;obligatoire, et
            vous pouvez changer d&apos;avis jusqu&apos;à la fin de la semaine. Si au moins {view.threshold}{" "}
            joueurs désignent la même personne, et plus que toute autre, son vrai rôle sera révélé à tous.
          </p>
        ) : (
          <p className="m-0 text-[15px] leading-normal text-[var(--mg-soft)]">
            Les désignations sont closes.
          </p>
        )}
      </div>

      {playing && view.vote.open ? (
        <>
          <p className="m-0 text-[15px]" aria-live="polite">
            {mine ? (
              <>
                Vous soupçonnez <strong className="text-[var(--mg-gold-hi)]">{mine.name}</strong>.
              </>
            ) : (
              "Vous ne soupçonnez personne pour l'instant."
            )}
          </p>
          <ul className="m-0 grid list-none grid-cols-1 gap-2.5 p-0 min-[420px]:grid-cols-2 xl:grid-cols-3">
            {candidates.map((p) => {
              const selected = view.vote.mine === p.id;
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    className="mg-suspect w-full"
                    aria-pressed={selected}
                    disabled={pending && !selected}
                    onClick={() => onVote(selected ? null : p.id)}
                  >
                    <span className="mg-avatar" aria-hidden="true">
                      {p.name.charAt(0)}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{p.name}</span>
                    {view.notes[p.id] ? (
                      <span className="mg-note-tag" data-mark={view.notes[p.id]}>
                        {view.notes[p.id] === "suspect" ? "suspect" : "innocent"}
                      </span>
                    ) : null}
                    {selected ? (
                      <Check aria-hidden="true" size={18} className="text-[var(--mg-gold)]" />
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
          {mine ? (
            <button type="button" className="mg-btn-ghost -ml-3 self-start" onClick={() => onVote(null)}>
              <X aria-hidden="true" size={16} />
              Retirer ma désignation
            </button>
          ) : null}
        </>
      ) : null}

      {playing ? (
        <p className="m-0 text-[14px] text-[var(--mg-faint)]">
          {view.vote.voters === 0
            ? "Personne n'a encore désigné de suspect cette semaine."
            : view.vote.voters === 1
              ? "1 personne a désigné cette semaine."
              : `${view.vote.voters} personnes ont désigné cette semaine.`}
        </p>
      ) : null}

      {fallen.length ? (
        <div className="flex flex-col gap-2 border-t border-[var(--mg-line)] pt-4">
          <h3 className="mg-kicker m-0 font-normal">Rôles déjà révélés</h3>
          <ul className="m-0 flex list-none flex-col gap-1.5 p-0 text-[15px]">
            {fallen.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center gap-2">
                <span>{p.name}</span>
                <RoleBadge role={p.out!} />
                <span className="text-[13px] text-[var(--mg-faint)]">en semaine {p.outRound}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

function RoleBadge({ role }: { role: "pn" | "gr" }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[12px] font-semibold ${
        role === "gr"
          ? "border border-[#7FC59E]/50 bg-[#2F6B4F]/40 text-[#CDEBD9]"
          : "border border-[#F2A493]/50 bg-[#9E2F22]/40 text-[#FBE1DA]"
      }`}
    >
      {ROLE_LABEL[role]}
    </span>
  );
}

function Reveal({ view }: { view: MagicView }) {
  const rows = view.reveal ?? [];
  // Parties révélées avant les points personnels : on retombe sur le flair.
  const score = (r: (typeof rows)[number]) => r.points ?? r.flair;
  const withPoints = rows.some((r) => typeof r.points === "number");
  // Ex aequo : même rang (lignes déjà triées par score décroissant).
  const ranks = rows.map((r) => 1 + rows.findIndex((x) => score(x) === score(r)));
  return (
    <section
      aria-label="Classement général"
      data-garland=""
      data-tone="velours"
      className="mg-panel flex flex-col gap-4 px-5 py-6 sm:px-7"
    >
      <Garland accent="gold" />
      <div className="flex flex-col gap-1">
        <h2 className="mg-title m-0 text-[28px] leading-tight font-normal sm:text-[32px]">
          Les masques tombent
        </h2>
        <Flourish />
      </div>
      <p className="m-0 text-[15px] text-[var(--mg-soft)]">
        {withPoints
          ? "Voici le vrai rôle de chacun, et le classement général des points personnels : flair et démasquages pour les Pères Noël, camouflage et manigances pour les Krampus."
          : "Voici le vrai rôle de chacun. Le flair compte les fois où chacun a désigné un Krampus qui n'avait pas encore été démasqué."}
      </p>
      <ol className="m-0 flex list-none flex-col p-0 text-[15px]">
        {rows.map((r, i) => {
          const rank = ranks[i]!;
          const detail = r.detail ? pointDetailText(r.detail) : "";
          return (
            <li key={r.name} className="flex items-center gap-3 border-t border-[var(--mg-line)] py-3">
              <span className="mg-rank shrink-0" data-top={rank <= 3 && score(r) > 0 ? rank : undefined}>
                {rank}
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">{r.name}</span>
                  <RoleBadge role={r.role} />
                </span>
                {detail || r.outRound ? (
                  <span className="text-[13px] text-[var(--mg-faint)]">
                    {[detail, r.outRound ? `rôle révélé en semaine ${r.outRound}` : ""]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                ) : null}
              </span>
              <span className="shrink-0 text-right tabular-nums">
                <span className="text-[20px] text-[var(--mg-gold-hi)]">{score(r)}</span>
                <span className="block text-[11px] tracking-[0.14em] text-[var(--mg-faint)] uppercase">
                  {withPoints ? "points" : "flair"}
                </span>
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
