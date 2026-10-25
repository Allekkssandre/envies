"use client";

import { ArrowUpRight, Check, Copy, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { SplitTitle } from "@/components/ui/SplitTitle";
import { SEARCH_GROUPS, SEARCH_SITES, encodeQuery } from "@/config/search-sites";
import { cn } from "@/lib/cn";

type SearchElsewhereProps = {
  initialQuery: string;
  layout: "desktop" | "mobile";
  id?: string;
};

/** Liens de recherche vers d'autres boutiques. Rien n'est suivi ni enregistré.
 *  Monté avec une `key` par article : les mots repartent de `initialQuery`. */
export function SearchElsewhere({ initialQuery, layout, id }: SearchElsewhereProps) {
  const [words, setWords] = useState(initialQuery);
  const [copied, setCopied] = useState(false);
  const q = encodeQuery(words);
  const mobile = layout === "mobile";

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(t);
  }, [copied]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(words);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <section
      id={id}
      aria-labelledby={`${id ?? "elsewhere"}-title`}
      className="flex scroll-mt-20 flex-col gap-4"
    >
      <div className={cn(mobile ? "" : "flex items-baseline justify-between gap-3 pt-3.5")}>
        <span id={`${id ?? "elsewhere"}-title`} className="contents">
          <SplitTitle
            as="h3"
            title="Trouver ailleurs"
            opsz={72}
            tracking="none"
            restColor="text-ochre"
            className={mobile ? "text-[34px]" : "text-4xl"}
          />
        </span>
        <p className={cn("m-0 text-muted", mobile ? "mt-1.5 text-sm" : "text-[13px]")}>
          {mobile
            ? "Même recherche, autres boutiques. Modifiez les mots si besoin."
            : "même recherche, autres boutiques"}
        </p>
      </div>

      <div className="flex gap-2">
        <label className="flex h-[50px] min-w-0 flex-1 items-center gap-2.5 rounded-full border border-ink/15 bg-white/60 px-[18px] focus-within:border-ink focus-within:shadow-[0_0_0_4px_rgb(167_106_25/0.2)]">
          <Search aria-hidden="true" size={17} strokeWidth={1.75} className="shrink-0" />
          <span className="sr-only">Mots de la recherche</span>
          <input
            type="text"
            value={words}
            onChange={(e) => setWords(e.target.value)}
            className={cn(
              "min-w-0 flex-1 border-0 bg-transparent text-ink outline-none focus-visible:outline-none",
              mobile ? "text-base" : "text-[15px]",
            )}
          />
        </label>
        <button
          type="button"
          aria-label="Copier le nom"
          onClick={() => void copy()}
          className="flex size-[50px] shrink-0 items-center justify-center rounded-full border border-ink/15 bg-white/60 text-ink transition-colors duration-180 hover:bg-white/90"
        >
          {copied ? (
            <Check aria-hidden="true" size={18} strokeWidth={2} className="text-olive" />
          ) : (
            <Copy aria-hidden="true" size={18} strokeWidth={1.6} />
          )}
        </button>
      </div>

      {mobile ? (
        <div className="flex flex-col gap-1">
          {SEARCH_GROUPS.map((group) => (
            <div key={group.id} className="flex flex-col gap-1">
              <h4 className="m-0 pt-3.5 pb-1 text-[11px] caps text-muted first:pt-1.5">
                {group.mobileLabel}
              </h4>
              <ul role="list" className="m-0 grid list-none grid-cols-3 gap-2 p-0">
                {SEARCH_SITES.filter((s) => s.group === group.id).map((site) => (
                  <li key={site.id}>
                    <a
                      href={site.url(q)}
                      target="_blank"
                      rel="noopener noreferrer nofollow"
                      className={cn(
                        "flex h-[52px] items-center justify-center gap-1 rounded-field border px-1 text-sm font-semibold text-ink no-underline",
                        group.id === "secondhand"
                          ? "border-olive/18 bg-olive/10"
                          : "border-ink/10 bg-white/60",
                      )}
                    >
                      {site.shortLabel ?? site.label}
                      <ArrowUpRight aria-hidden="true" size={13} strokeWidth={2} />
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      ) : (
        <dl className="m-0 grid grid-cols-[140px_minmax(0,1fr)] items-center gap-y-0.5 text-[15px]">
          {SEARCH_GROUPS.map((group) => (
            <div key={group.id} className="contents">
              <dt className="text-xs caps tracking-[0.16em] text-muted">{group.label}</dt>
              <dd className="m-0">
                <ul role="list" className="m-0 flex list-none flex-wrap gap-x-[22px] p-0">
                  {SEARCH_SITES.filter((s) => s.group === group.id).map((site) => (
                    <li key={site.id}>
                      <a
                        href={site.url(q)}
                        target="_blank"
                        rel="noopener noreferrer nofollow"
                        className="inline-flex h-10 items-center gap-1 font-semibold text-ink underline underline-offset-4 hover:text-rust"
                      >
                        {site.label}
                        <ArrowUpRight aria-hidden="true" size={14} strokeWidth={2} />
                      </a>
                    </li>
                  ))}
                </ul>
              </dd>
            </div>
          ))}
        </dl>
      )}

      <p className={cn("m-0 leading-normal text-muted", mobile ? "mt-1.5 text-xs" : "text-[13px]")}>
        Ces liens ouvrent une simple recherche dans un nouvel onglet. Rien n&apos;est suivi ni rémunéré.
      </p>
    </section>
  );
}
