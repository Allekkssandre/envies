"use client";

import { ArrowLeft, Check, Send } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { ROUNDS, type AccusedRole, type Role } from "@/lib/magic/engine";
import {
  ACCUSED_LABEL,
  CAMP_LABEL,
  CARD_NAME,
  CHAT_LABEL,
  ROLE_LABEL,
  ROLE_TEXT,
  RULES,
  cardText,
  formatMoment,
  gazetteLines,
  systemText,
} from "@/lib/magic/texts";
import type { MagicMessage, MagicView } from "@/lib/magic/types";
import type { Result } from "@/server/actions/result";
import {
  accuseMagic,
  getMagicView,
  joinMagicGame,
  postMagicMessage,
  voteMagic,
} from "@/server/actions/magic";

const NETWORK = "Pas enregistré. Vérifiez la connexion.";
const POLL_MS = 10_000;

/** La Magie de Noël, vue d'un joueur : rôle, jauge, vote, tchat, identifications. */
export function MagicGame({ token, initial }: { token: string; initial: MagicView }) {
  const [view, setView] = useState(initial);
  const [pending, startTransition] = useTransition();

  const refresh = useCallback(async () => {
    try {
      const result = await getMagicView(token);
      if (result.ok) setView(result.data);
    } catch {
      // Hors ligne : on garde l'affichage, le prochain passage réessaie.
    }
  }, [token]);

  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [refresh]);

  /** Lance une action, affiche l'erreur s'il y en a une, puis recharge l'état. */
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

  return (
    <div className="relative flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <Link
          href={`/lutins/moi/${token}`}
          className="inline-flex min-h-11 items-center gap-2 self-start text-[15px] font-semibold text-ink no-underline"
        >
          <ArrowLeft aria-hidden="true" size={18} strokeWidth={1.7} />
          Mon tirage
        </Link>
        <p className="m-0 text-xs tracking-[0.18em] text-muted uppercase">{view.title}</p>
        <h1 className="m-0 font-display-72 text-[38px] leading-[1.05] font-normal sm:text-[52px]">
          La Magie de Noël
        </h1>
        <Status view={view} />
      </div>

      <Gauge value={view.gauge} start={view.startGauge} />

      {view.reveal ? <Reveal view={view} /> : null}

      {view.me ? (
        <RoleCard role={view.me.role} pseudo={view.me.pseudo} card={view.me.card} />
      ) : view.joinOption ? (
        <Join
          option={view.joinOption}
          pending={pending}
          onJoin={(choice) => act(() => joinMagicGame(token, choice))}
        />
      ) : null}

      {view.me ? (
        <Accusations
          view={view}
          pending={pending}
          onAccuse={(input, done) => act(() => accuseMagic(token, input), done)}
        />
      ) : null}

      {view.chat?.vote ? (
        <Vote view={view} pending={pending} onVote={(target) => act(() => voteMagic(token, target))} />
      ) : null}

      {view.chat ? (
        <ChatPanel
          view={view}
          pending={pending}
          onSend={(text, done) => act(() => postMagicMessage(token, text), done)}
        />
      ) : null}

      <details className="rounded-[18px] border border-ink/12 bg-white/35 px-5 py-3">
        <summary className="min-h-11 cursor-pointer py-2 text-base font-semibold">Règles du jeu</summary>
        <ul className="m-0 flex list-disc flex-col gap-2 pb-3 pl-5 text-[15px] leading-normal text-ink-soft">
          {RULES.map((rule) => (
            <li key={rule}>{rule}</li>
          ))}
        </ul>
      </details>
    </div>
  );
}

function Block({ title, aside, children }: { title: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <section aria-label={title} className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3 border-b border-ink/12 pb-2">
        <h2 className="m-0 font-display-72 text-[24px] leading-tight font-normal sm:text-[28px]">{title}</h2>
        {aside ? <span className="text-sm font-semibold text-ink-soft">{aside}</span> : null}
      </div>
      {children}
    </section>
  );
}

function Status({ view }: { view: MagicView }) {
  let text: string;
  if (view.status === "joining") {
    text = `Choix des camps jusqu'au ${formatMoment(view.startsAt)}. La partie commence ensuite.`;
  } else if (view.status === "playing" && view.round && view.deadline) {
    text = `Manche ${view.round} sur ${ROUNDS}. Vote jusqu'au ${formatMoment(view.deadline)}.`;
  } else {
    const winner = view.winner
      ? `${CAMP_LABEL[view.winner][0]!.toUpperCase()}${CAMP_LABEL[view.winner].slice(1)} ont gagné.`
      : "";
    text =
      view.status === "revealed"
        ? `Partie terminée. ${winner}`
        : `Partie terminée. ${winner} L'organisation révélera les rôles et le classement.`;
  }
  return (
    <p role="status" className="m-0 text-base text-ink-soft">
      {text}
    </p>
  );
}

function Gauge({ value, start }: { value: number; start: number }) {
  const size = Math.max(start, value, 1);
  return (
    <div
      role="img"
      aria-label={`Magie de Noël : ${value}`}
      className="flex items-center gap-4 rounded-[22px] border border-ochre/25 bg-ochre/8 px-5 py-4"
    >
      <div className="flex flex-col">
        <span className="text-xs tracking-[0.18em] text-ochre-deep uppercase">Magie de Noël</span>
        <span className="font-display-72 text-[44px] leading-none tabular">{value}</span>
      </div>
      <div aria-hidden="true" className="flex flex-1 gap-1.5">
        {Array.from({ length: size }, (_, i) => (
          <span key={i} className={cn("h-3 flex-1 rounded-full", i < value ? "bg-ochre" : "bg-ink/10")} />
        ))}
      </div>
    </div>
  );
}

function RoleCard({
  role,
  pseudo,
  card,
}: {
  role: Role;
  pseudo: string;
  card: NonNullable<MagicView["me"]>["card"];
}) {
  return (
    <section
      aria-label="Mon rôle"
      className="flex flex-col gap-3 rounded-[22px] border border-ink/12 bg-white/45 p-5"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="m-0 font-display-72 text-[28px] leading-tight font-normal">{ROLE_LABEL[role]}</h2>
        <span className="text-sm text-ink-soft">
          Votre pseudonyme : <b className="text-ink">{pseudo}</b>
        </span>
      </div>
      <p className="m-0 text-[15px] leading-normal text-ink-soft">{ROLE_TEXT[role]}</p>
      <div className="flex flex-col gap-1 border-t border-ink/10 pt-3">
        <span className="text-xs tracking-[0.18em] text-muted uppercase">Votre pouvoir</span>
        <span className="text-base font-semibold">{CARD_NAME[card]}</span>
        <p className="m-0 text-[15px] leading-normal text-ink-soft">{cardText(card, role)}</p>
      </div>
      <p className="m-0 text-[13px] text-muted">Vous seul voyez cette carte.</p>
    </section>
  );
}

function Join({
  option,
  pending,
  onJoin,
}: {
  option: NonNullable<MagicView["joinOption"]>;
  pending: boolean;
  onJoin: (choice: Role | null) => void;
}) {
  return (
    <Block title="Votre camp">
      {option === "camp" ? (
        <>
          <p className="m-0 text-[15px] leading-normal text-ink-soft">
            Choisissez votre camp. Cinq places chacun, premier arrivé, premier servi. Si le camp choisi est
            complet, vous rejoignez l&apos;autre. Le choix est définitif et secret.
          </p>
          <div className="flex flex-wrap gap-2.5">
            <Button size={52} disabled={pending} onClick={() => onJoin("pn")}>
              Père Noël
            </Button>
            <Button size={52} variant="outline" disabled={pending} onClick={() => onJoin("gr")}>
              Grinch
            </Button>
          </div>
        </>
      ) : option === "infiltre" ? (
        <>
          <p className="m-0 text-[15px] leading-normal text-ink-soft">
            Les deux camps sont complets. Vous serez infiltré : vous jouez pour un camp, dans le tchat de
            l&apos;autre. Choisissez pour qui vous jouez.
          </p>
          <div className="flex flex-col gap-2.5 sm:flex-row">
            <Button size={52} disabled={pending} onClick={() => onJoin("inf_pn")}>
              Pour les Pères Noël
            </Button>
            <Button size={52} variant="outline" disabled={pending} onClick={() => onJoin("inf_gr")}>
              Pour les Grinchs
            </Button>
          </div>
        </>
      ) : (
        <>
          <p className="m-0 text-[15px] leading-normal text-ink-soft">
            Il ne reste qu&apos;une possibilité pour vous. Votre rôle est prêt.
          </p>
          <div>
            <Button size={52} disabled={pending} onClick={() => onJoin(null)}>
              Découvrir mon rôle
            </Button>
          </div>
        </>
      )}
    </Block>
  );
}

function Accusations({
  view,
  pending,
  onAccuse,
}: {
  view: MagicView;
  pending: boolean;
  onAccuse: (input: { targetId: string; role: AccusedRole }, done: () => void) => void;
}) {
  const { open, left, mine, people } = view.accusations;
  const [targetId, setTargetId] = useState("");
  const [role, setRole] = useState<AccusedRole | "">("");
  const select =
    "h-12 min-w-0 flex-1 rounded-field border border-ink/16 bg-field px-3 text-base text-ink outline-none focus:border-ink";
  return (
    <Block
      title="Identifications"
      aside={left > 0 ? `${left} ${left > 1 ? "restantes" : "restante"}` : "Toutes utilisées"}
    >
      {mine.length ? (
        <ul className="m-0 flex list-none flex-col gap-1.5 p-0 text-[15px]">
          {mine.map((a) => (
            <li key={a.name} className="flex items-center gap-2">
              <Check aria-hidden="true" size={16} strokeWidth={2.2} className="text-olive-deep" />
              {a.name} : {ACCUSED_LABEL[a.role]}
            </li>
          ))}
        </ul>
      ) : null}
      {open && left > 0 ? (
        <form
          className="flex flex-col gap-2.5"
          onSubmit={(e) => {
            e.preventDefault();
            if (!targetId || !role) return;
            onAccuse({ targetId, role }, () => {
              setTargetId("");
              setRole("");
            });
          }}
        >
          <p className="m-0 text-[15px] leading-normal text-ink-soft">
            Dites qui est quoi. Juste : vous gagnez des points. Faux : vous en perdez. Une identification
            déposée ne se modifie plus.
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <select
              aria-label="Personne"
              value={targetId}
              onChange={(e) => setTargetId(e.target.value)}
              className={select}
            >
              <option value="">Qui ?</option>
              {people
                .filter((p) => !mine.some((m) => m.name === p.name))
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
            </select>
            <select
              aria-label="Rôle"
              value={role}
              onChange={(e) => setRole(e.target.value as AccusedRole | "")}
              className={select}
            >
              <option value="">Quel rôle ?</option>
              <option value="pn">Père Noël (+1, sinon −1)</option>
              <option value="gr">Grinch (+2, sinon −2)</option>
              <option value="inf">Infiltré (+4, sinon −1)</option>
            </select>
            <Button type="submit" size={46} disabled={pending || !targetId || !role}>
              Déposer
            </Button>
          </div>
        </form>
      ) : (
        <p className="m-0 text-[15px] text-ink-soft">
          {left === 0
            ? "Vous avez déposé vos deux identifications. Résultat à la révélation."
            : view.status === "revealed"
              ? "Les identifications sont closes."
              : "Les identifications ouvrent au début de la partie."}
        </p>
      )}
    </Block>
  );
}

function Vote({
  view,
  pending,
  onVote,
}: {
  view: MagicView;
  pending: boolean;
  onVote: (target: string) => void;
}) {
  const vote = view.chat!.vote!;
  return (
    <Block
      title={`Vote de la manche ${view.round}`}
      aside={vote.mine ? "Vote modifiable" : "À vous de voter"}
    >
      <p className="m-0 text-[15px] leading-normal text-ink-soft">
        Votez pour le pseudonyme dont le pouvoir sera joué
        {view.chat!.visiting ? " dans ce tchat, où vous êtes en visite" : ""}. Le plus voté l&apos;emporte à
        la fin du vote.
      </p>
      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {vote.eligible.map((pseudo) => {
          const chosen = vote.mine === pseudo;
          const count = vote.counts[pseudo] ?? 0;
          return (
            <li key={pseudo}>
              <button
                type="button"
                aria-pressed={chosen}
                disabled={pending}
                onClick={() => onVote(pseudo)}
                className={cn(
                  "flex min-h-12 w-full items-center justify-between gap-3 rounded-[16px] border px-4 text-left text-base",
                  chosen
                    ? "border-ink bg-ink text-linen"
                    : "border-ink/16 bg-white/45 text-ink hover:bg-white/70",
                )}
              >
                <span className="font-semibold">{pseudo}</span>
                <span className={cn("text-sm", chosen ? "text-linen" : "text-ink-soft")}>
                  {count} {count > 1 ? "votes" : "vote"}
                  {chosen ? " · votre vote" : ""}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </Block>
  );
}

function ChatPanel({
  view,
  pending,
  onSend,
}: {
  view: MagicView;
  pending: boolean;
  onSend: (text: string, done: () => void) => void;
}) {
  const chat = view.chat!;
  const [text, setText] = useState("");
  const listRef = useRef<HTMLDivElement>(null);
  const lastId = chat.messages.at(-1)?.id ?? 0;
  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [lastId]);

  return (
    <Block title={CHAT_LABEL[chat.id]} aside={chat.visiting ? "En visite" : undefined}>
      {chat.visiting ? (
        <p className="m-0 rounded-[14px] bg-ochre/10 px-4 py-3 text-[15px] leading-normal">
          Vous êtes en visite ici jusqu&apos;à la fin du prochain vote. Vous ne voyez que les messages écrits
          depuis votre arrivée. Votre tchat habituel vous est fermé pendant ce temps.
        </p>
      ) : null}
      <ul className="m-0 flex list-none flex-wrap gap-1.5 p-0" aria-label="Présents">
        {chat.members.map((m) => (
          <li
            key={m.pseudo}
            className={cn(
              "rounded-full border px-3 py-1 text-[13px]",
              m.me ? "border-ink bg-ink text-linen" : "border-ink/14 bg-white/45",
              m.away && "opacity-50",
            )}
          >
            {m.pseudo}
            {m.me ? " (vous)" : ""}
            {m.visitor ? " · visiteur" : m.away ? " · en visite" : m.played ? " · pouvoir joué" : ""}
          </li>
        ))}
      </ul>
      <div
        ref={listRef}
        role="log"
        aria-label="Messages"
        className="flex h-[52dvh] max-h-[560px] min-h-[280px] flex-col gap-2.5 overflow-y-auto rounded-[18px] border border-ink/10 bg-white/35 p-3"
      >
        {chat.messages.length === 0 ? (
          <p className="m-auto text-sm text-muted">Aucun message pour l&apos;instant.</p>
        ) : (
          chat.messages.map((m) => <Message key={m.id} message={m} />)
        )}
      </div>
      {chat.canPost ? (
        <form
          className="flex items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const value = text.trim();
            if (value) onSend(value, () => setText(""));
          }}
        >
          <label htmlFor="magic-message" className="sr-only">
            Votre message
          </label>
          <textarea
            id="magic-message"
            rows={2}
            maxLength={1000}
            value={text}
            placeholder="Votre message"
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                e.currentTarget.form?.requestSubmit();
              }
            }}
            className="min-h-12 flex-1 resize-none rounded-field border border-ink/16 bg-field px-4 py-3 text-base text-ink outline-none focus:border-ink focus:shadow-[0_0_0_4px_rgb(167_106_25/0.2)]"
          />
          <Button
            type="submit"
            size={46}
            disabled={pending || !text.trim()}
            aria-label="Envoyer"
            className="w-12 px-0"
          >
            <Send aria-hidden="true" />
          </Button>
        </form>
      ) : null}
    </Block>
  );
}

function Message({ message }: { message: MagicMessage }) {
  if (message.kind === "chat") {
    return (
      <div
        className={cn(
          "flex max-w-[85%] flex-col gap-0.5",
          message.mine ? "items-end self-end" : "self-start",
        )}
      >
        <span className="px-1 text-[13px] font-semibold text-ink-soft">{message.pseudo}</span>
        <p
          className={cn(
            "m-0 rounded-[16px] px-3.5 py-2 text-[15px] leading-normal break-words whitespace-pre-line",
            message.mine ? "bg-ink text-linen" : "bg-paper text-ink",
          )}
        >
          {message.text}
        </p>
      </div>
    );
  }
  if (message.kind === "gazette") {
    return (
      <div className="flex flex-col gap-1 self-stretch rounded-[16px] border border-ochre/30 bg-ochre/10 px-4 py-3">
        <span className="text-xs tracking-[0.18em] text-ochre-deep uppercase">
          Gazette · manche {message.gazette.round}
        </span>
        {gazetteLines(message.gazette).map((line) => (
          <p key={line} className="m-0 text-[15px] leading-normal">
            {line}
          </p>
        ))}
      </div>
    );
  }
  return (
    <p className="m-0 self-center px-3 text-center text-[13px] text-ink-soft">{systemText(message.note)}</p>
  );
}

function Reveal({ view }: { view: MagicView }) {
  return (
    <Block title="Rôles et classement">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left text-[15px]">
          <thead>
            <tr className="text-xs tracking-[0.12em] text-muted uppercase">
              <th className="py-2 pr-3 font-normal">Joueur</th>
              <th className="py-2 pr-3 font-normal">Rôle</th>
              <th className="py-2 pr-3 font-normal">Pseudonyme</th>
              <th className="py-2 pr-3 font-normal">Pouvoir</th>
              <th className="py-2 text-right font-normal">Points</th>
            </tr>
          </thead>
          <tbody>
            {view.reveal!.map((row) => (
              <tr key={row.name} className="border-t border-ink/10">
                <td className="py-2.5 pr-3 font-semibold">{row.name}</td>
                <td className="py-2.5 pr-3">{ROLE_LABEL[row.role]}</td>
                <td className="py-2.5 pr-3">{row.pseudo}</td>
                <td className="py-2.5 pr-3">{CARD_NAME[row.card]}</td>
                <td className="py-2.5 text-right font-serif text-lg tabular">{row.points}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Block>
  );
}
