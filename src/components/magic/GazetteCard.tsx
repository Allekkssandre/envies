import { clueText, gazetteStory } from "@/lib/magic/texts";
import type { Gazette } from "@/lib/magic/types";

// La Gazette du Pôle Nord : un vieux journal de Noël. Bandeau à l'ancienne, gros titre,
// lettrine, encart de l'enquête, carnet des désignations.

function Holly({ flip = false }: { flip?: boolean }) {
  return (
    <svg
      viewBox="0 0 44 28"
      className="h-6 w-9 shrink-0"
      style={flip ? { transform: "scaleX(-1)" } : undefined}
      aria-hidden="true"
    >
      <path
        d="M22 16 C 16 10 10 14 4 8 C 3 14 -2 16 1 20 C 6 18 6 24 12 24 C 14 18 18 20 22 16 Z"
        fill="#2F6B3F"
      />
      <path
        d="M22 16 C 26 8 32 10 36 3 C 38 9 44 10 42 15 C 37 15 38 21 32 22 C 30 16 26 19 22 16 Z"
        fill="#27593A"
      />
      <circle cx="21" cy="14" r="3.3" fill="#C42A22" />
      <circle cx="25.5" cy="17" r="3.3" fill="#D9342B" />
      <circle cx="19.5" cy="19" r="3.3" fill="#B02219" />
    </svg>
  );
}

function Magic({ before, after, round }: { before: number; after: number; round: number }) {
  const delta = after - before;
  return (
    <div className="mg-gz-box flex items-center justify-between gap-3 px-4 py-2.5">
      <span className="mg-gz-label">Magie de Noël</span>
      <span className="mg-gz-serif text-[20px] leading-none font-semibold">
        {round === 0 ? (
          after
        ) : (
          <>
            {before} <span aria-label="passe à">→</span> {after}
            {delta ? (
              <span className={`ml-2 text-[15px] ${delta > 0 ? "text-[#2F6B3F]" : "text-[#9E2F22]"}`}>
                ({delta > 0 ? `+${delta}` : `−${-delta}`})
              </span>
            ) : null}
          </>
        )}
      </span>
    </div>
  );
}

export function GazetteCard({ gazette, title }: { gazette: Gazette; title: string }) {
  const story = gazetteStory(gazette);
  const [first, ...rest] = story.paragraphs;
  const nextWeek = gazette.round + 1;
  return (
    <article
      className="mg-gazette flex flex-col gap-4 px-5 pt-5 pb-6 sm:px-8 sm:pt-6"
      aria-label={`Gazette, ${story.when}`}
    >
      {/* Bandeau */}
      <header className="flex flex-col items-center gap-2 text-center">
        <div className="mg-gz-rule-thin flex w-full items-center justify-between gap-2 pb-1.5">
          <span className="mg-gz-label">Édition du Pôle Nord</span>
          <span className="mg-gz-label">{story.when}</span>
        </div>
        <div className="flex items-center justify-center gap-2 sm:gap-3">
          <Holly />
          <h3 className="mg-gz-masthead m-0 text-[27px] leading-[0.95] sm:text-[38px]">
            La Gazette du Pôle Nord
          </h3>
          <Holly flip />
        </div>
        <div className="mg-gz-rule-double flex w-full items-center justify-between gap-2 py-1">
          <span className="mg-gz-label truncate">{title}</span>
          <span className="mg-gz-label shrink-0">Prix : un chocolat chaud</span>
        </div>
      </header>

      {/* Gros titre et récit */}
      <h4 className="mg-gz-serif m-0 text-center text-[25px] leading-tight font-semibold sm:text-[30px]">
        {story.headline}
      </h4>
      <div className="mg-gz-body flex flex-col gap-2.5">
        {first ? <p className="mg-gz-dropcap m-0">{first}</p> : null}
        {rest.map((line) => (
          <p key={line} className="m-0">
            {line}
          </p>
        ))}
      </div>

      <Magic before={gazette.before} after={gazette.after} round={gazette.round} />

      {gazette.clue ? (
        <aside
          className="mg-gz-clue flex flex-col gap-1 px-4 py-3"
          aria-label={`Indice pour la semaine ${nextWeek}`}
        >
          <span className="mg-gz-label !text-[#9E2F22]">
            L&apos;enquête · indice pour la semaine {nextWeek}
          </span>
          <p className="mg-gz-serif m-0 text-[18px] leading-snug">{clueText(gazette.clue)}</p>
        </aside>
      ) : null}

      {gazette.letters?.length ? (
        <section className="flex flex-col gap-2.5" aria-label="Le courrier des lecteurs">
          <h5 className="mg-gz-label m-0 !text-[12px]">Le courrier des lecteurs</h5>
          {gazette.letters.map((letter, i) => (
            <p key={i} className="mg-gz-body mg-gz-letter">
              « {letter} »
            </p>
          ))}
        </section>
      ) : null}

      {gazette.votes.length ? (
        <details className="mg-gz-body">
          <summary className="mg-gz-label inline-flex min-h-11 items-center gap-2 !text-[13px] underline decoration-dotted underline-offset-4">
            Le carnet des désignations ({gazette.votes.length})
          </summary>
          <ul className="m-0 mt-1 grid list-none grid-cols-1 gap-x-6 gap-y-1 p-0 sm:grid-cols-2">
            {gazette.votes.map((v) => (
              <li key={`${v.voter}-${v.target}`}>
                {v.voter} <span className="text-[#9E2F22]">soupçonne</span> {v.target}
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      <p className="mg-gz-label m-0 text-center" aria-hidden="true">
        ✶ ✶ ✶
      </p>
    </article>
  );
}
