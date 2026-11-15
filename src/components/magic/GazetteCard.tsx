import { clueText, endText, gazetteLines } from "@/lib/magic/texts";
import type { Gazette } from "@/lib/magic/types";

/** La Gazette du Pôle Nord : bilan d'une semaine, indice de la suivante, qui a désigné qui. */
export function GazetteCard({ gazette, title }: { gazette: Gazette; title: string }) {
  const { title: when, lines } = gazetteLines(gazette);
  const end = endText(gazette);
  return (
    <article
      className="mg-gazette flex flex-col gap-4 px-5 py-5 sm:px-7 sm:py-6"
      aria-label={`Gazette, ${when}`}
    >
      <header className="flex flex-col items-center gap-1.5 text-center">
        <p className="m-0 text-[11px] tracking-[0.22em] text-[var(--mg-paper-soft)] uppercase">
          {title} · {when}
        </p>
        <h3 className="mg-gazette-head m-0 text-[26px] leading-none font-semibold sm:text-[30px]">
          La Gazette du Pôle Nord
        </h3>
      </header>
      <hr className="mg-rule" />
      {end ? (
        <p className="mg-gazette-head m-0 text-center text-[21px] leading-snug font-semibold">{end}</p>
      ) : null}
      <div className="flex flex-col gap-2">
        {lines.map((line) => (
          <p key={line} className="m-0 text-[16px] leading-normal">
            {line}
          </p>
        ))}
      </div>
      {gazette.clue ? (
        <div className="mg-clue flex flex-col gap-1 px-4 py-3">
          <span className="text-[11px] tracking-[0.2em] text-[var(--mg-paper-soft)] uppercase">
            Indice pour la semaine {gazette.round + 1}
          </span>
          <p className="mg-gazette-head m-0 text-[18px] leading-snug">{clueText(gazette.clue)}</p>
        </div>
      ) : null}
      {gazette.votes.length ? (
        <details className="text-[15px]">
          <summary className="inline-flex min-h-11 items-center font-semibold underline decoration-dotted underline-offset-4">
            Qui a désigné qui ({gazette.votes.length})
          </summary>
          <ul className="m-0 mt-1 flex list-none flex-col gap-1 p-0">
            {gazette.votes.map((v) => (
              <li key={`${v.voter}-${v.target}`}>
                {v.voter} <span aria-label="a désigné">→</span> {v.target}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </article>
  );
}
