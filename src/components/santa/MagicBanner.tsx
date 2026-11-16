import { ArrowRight, Sparkles } from "lucide-react";
import Link from "next/link";
import { ROUNDS } from "@/lib/magic/engine";
import { formatMoment } from "@/lib/magic/texts";
import type { MagicTeaser } from "@/lib/magic/types";

function copy(game: MagicTeaser): { title: string; line: string; cta: string; urgent: boolean } {
  if (game.status === "waiting") {
    return {
      title: "Votre rôle vous attend",
      line: `La partie commence le ${formatMoment(game.startsAt)}. Découvrez dès maintenant si vous êtes Père Noël ou Krampus.`,
      cta: "Découvrir mon rôle",
      urgent: true,
    };
  }
  if (game.status === "playing" && game.round && game.deadline) {
    const week = `Semaine ${game.round} sur ${ROUNDS}`;
    if (!game.canVote) {
      return { title: "La partie continue", line: `${week}.`, cta: "Entrer dans le jeu", urgent: false };
    }
    return game.voted
      ? {
          title: "Votre suspect est désigné",
          line: `${week}. Vous pouvez changer d'avis jusqu'au ${formatMoment(game.deadline)}.`,
          cta: "Entrer dans le jeu",
          urgent: false,
        }
      : {
          title: "À vous de désigner un suspect",
          line: `${week}. Vous avez jusqu'au ${formatMoment(game.deadline)}, et rien n'est obligatoire.`,
          cta: "Désigner un suspect",
          urgent: true,
        };
  }
  if (game.status === "revealed") {
    return {
      title: "Les masques sont tombés",
      line: "Découvrez qui était Krampus, et le classement général.",
      cta: "Voir le classement",
      urgent: true,
    };
  }
  return {
    title: "La partie est terminée",
    line: "Les rôles et le classement seront bientôt dévoilés par l'organisation.",
    cta: "Entrer dans le jeu",
    urgent: false,
  };
}

/** Bandeau de La Magie de Noël en tête de la page du tirage : où en est le jeu, et y entrer. */
export function MagicBanner({ token, game }: { token: string; game: MagicTeaser }) {
  const { title, line, cta, urgent } = copy(game);
  const ratio = game.startMagic > 0 ? Math.max(0, Math.min(1, game.magic / game.startMagic)) : 0;
  return (
    <section
      aria-label="La Magie de Noël"
      className="relative isolate flex flex-col gap-4 overflow-hidden rounded-[26px] border border-[#E8C170]/30 px-5 py-5 text-[#EEF1F7] shadow-[0_24px_60px_-30px_rgba(11,19,34,0.9)] sm:flex-row sm:items-center sm:gap-6 sm:px-7 sm:py-6"
      style={{
        backgroundImage:
          "radial-gradient(1px 1px at 12% 22%, rgba(255,255,255,.7), transparent 60%), radial-gradient(1.5px 1.5px at 38% 12%, rgba(247,231,193,.8), transparent 60%), radial-gradient(1px 1px at 64% 30%, rgba(255,255,255,.5), transparent 60%), radial-gradient(1.5px 1.5px at 88% 16%, rgba(255,255,255,.7), transparent 60%), radial-gradient(1px 1px at 76% 78%, rgba(255,255,255,.45), transparent 60%), radial-gradient(120% 90% at 100% 0%, rgba(232,193,112,.18), transparent 60%), linear-gradient(160deg, #14213a 0%, #0b1322 70%)",
      }}
    >
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <p className="m-0 flex items-center gap-2 text-[12px] tracking-[0.2em] text-[#E8C170] uppercase">
          <Sparkles aria-hidden="true" size={14} />
          La Magie de Noël
          {urgent ? (
            <span
              aria-hidden="true"
              className="size-2 rounded-full bg-[#F7E7C1] shadow-[0_0_10px_2px_rgba(247,231,193,.7)] motion-safe:animate-pulse"
            />
          ) : null}
        </p>
        <p className="m-0 font-display-72 text-[26px] leading-tight font-normal text-[#F7E7C1] sm:text-[30px]">
          {title}
        </p>
        <p className="m-0 text-[15px] leading-normal text-[#C3CCDC]">{line}</p>
        {game.status !== "waiting" ? (
          <div className="mt-1 flex items-center gap-3">
            <span
              role="meter"
              aria-label="Magie de Noël"
              aria-valuemin={0}
              aria-valuemax={game.startMagic}
              aria-valuenow={game.magic}
              className="relative h-2 w-full max-w-[220px] overflow-hidden rounded-full bg-white/10"
            >
              <span
                className="absolute inset-y-0 left-0 rounded-full bg-[linear-gradient(90deg,#B8862F,#F7E7C1)] shadow-[0_0_12px_rgba(232,193,112,.6)]"
                style={{ width: `${ratio * 100}%` }}
              />
            </span>
            <span className="shrink-0 text-[13px] text-[#C3CCDC] tabular-nums">
              Magie {game.magic} sur {game.startMagic}
            </span>
          </div>
        ) : null}
      </div>
      <Link
        href={`/lutins/moi/${token}/jeu`}
        className="inline-flex min-h-12 shrink-0 items-center justify-center gap-2 self-start rounded-full bg-[linear-gradient(180deg,#F7E7C1,#E8C170)] px-6 text-[15px] font-semibold text-[#141D30] no-underline shadow-[0_8px_24px_-10px_rgba(232,193,112,.7)] focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-[#F7E7C1] sm:self-center"
      >
        {cta}
        <ArrowRight aria-hidden="true" size={18} />
      </Link>
    </section>
  );
}
