import { POINT_LABEL, POINT_RULES, pointLineText, signed } from "@/lib/magic/texts";
import { POINTS } from "@/lib/magic/engine";
import type { MagicView } from "@/lib/magic/types";

/** Points personnels du joueur, avec le barème de son rôle. Rien n'y trahit le rôle d'un autre. */
export function ScorePanel({ view }: { view: MagicView }) {
  const { points, me } = view;
  const lines = [...points.lines].sort((a, b) => b.round - a.round);
  return (
    <section aria-label="Vos points" className="mg-panel flex flex-col gap-4 px-5 py-6 sm:px-7">
      <div className="flex items-end justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <h2 className="mg-title m-0 text-[28px] leading-tight font-normal sm:text-[32px]">Vos points</h2>
          <p className="m-0 text-[15px] leading-normal text-[var(--mg-soft)]">
            {view.reveal
              ? "Votre place est au classement général, ci-dessus."
              : "Ils comptent pour le classement général, publié à la révélation des rôles. Ils ne changent rien à la Magie."}
          </p>
        </div>
        <p className="mg-score m-0 shrink-0" aria-label={`${points.total} points`}>
          <span className="mg-score-value">{points.total}</span>
          <span className="mg-score-unit">{Math.abs(points.total) > 1 ? "points" : "point"}</span>
        </p>
      </div>

      {lines.length ? (
        <ul className="m-0 flex list-none flex-col p-0 text-[15px]">
          {lines.map((l, i) => (
            <li
              key={`${l.round}-${l.kind}-${i}`}
              className="flex items-baseline justify-between gap-3 border-t border-[var(--mg-line)] py-2.5"
            >
              <span className="min-w-0">{pointLineText(l)}</span>
              <span
                className={`shrink-0 font-semibold tabular-nums ${
                  l.points > 0 ? "text-[var(--mg-gold-hi)]" : "text-[#F2A493]"
                }`}
              >
                {signed(l.points)}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="m-0 text-[15px] text-[var(--mg-faint)]">
          {view.status === "waiting" || view.round === 1
            ? "Les premiers points tombent à la fin de la semaine 1."
            : "Aucun point pour l'instant."}
        </p>
      )}

      {points.pending ? (
        <p className="m-0 text-[14px] leading-normal text-[var(--mg-faint)]">
          Le flair porté sur un joueur dont le rôle est encore caché ne s&apos;affiche qu&apos;à la révélation
          : sinon, vos points vous diraient qui est Krampus. D&apos;autres points peuvent donc s&apos;ajouter
          à la fin.
        </p>
      ) : null}

      <details className="flex flex-col gap-2">
        <summary className="mg-btn-ghost -ml-3">Le barème</summary>
        <ul className="m-0 mt-2 flex list-none flex-col gap-1.5 p-0 text-[14px] leading-normal text-[var(--mg-soft)]">
          {POINT_RULES[me.role].map((r) => (
            <li key={r.kind}>
              <strong className="text-[var(--mg-ink)]">
                {POINT_LABEL[r.kind]} {signed(POINTS[r.kind])}
              </strong>{" "}
              : {r.text}.
            </li>
          ))}
        </ul>
      </details>
    </section>
  );
}
