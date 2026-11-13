"use client";

import { Link2, LoaderCircle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { buttonClasses } from "@/components/ui/Button";
import { SplitTitle } from "@/components/ui/SplitTitle";
import type { PageProduct } from "@/lib/bookmarklet";
import { formatPrice } from "@/lib/format";
import { looksLikeUrl } from "@/lib/normalizeUrl";
import { parsePrice } from "@/lib/parsePrice";
import { addFromPage, addItems } from "@/server/actions/items";
import type { UnlockedList } from "@/server/auth/session";

type Props = { line: string; lists: UnlockedList[]; page?: PageProduct };

/**
 * Choix de la liste puis ajout direct dans « À trier ». Depuis le bouton de favoris (`page`),
 * avec le nom, le prix et la photo lus sur la page ; une seule liste ouverte : ajout immédiat.
 */
export function ShareTarget({ line, lists, page }: Props) {
  const router = useRouter();
  const [chosen, setChosen] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const isLink = looksLikeUrl(line) || /^https?:\/\//i.test(line);

  function add(list: UnlockedList) {
    setChosen(list.id);
    setError(null);
    startTransition(async () => {
      if (page) {
        const result = await addFromPage({ listId: list.id, ...page });
        if (!result.ok) {
          setError(result.error.message);
          setChosen(null);
          return;
        }
        toast(
          result.data.status === "created" ? `Ajouté à ${list.title}` : `Article complété dans ${list.title}`,
        );
        router.push(`/l/${list.slug}/edition`);
        return;
      }
      const result = await addItems({ listId: list.id, lines: [line] });
      if (!result.ok) {
        setError(result.error.message);
        setChosen(null);
        return;
      }
      toast(result.data.created.length ? `Ajouté à ${list.title}` : "Déjà dans la liste");
      router.push(`/l/${list.slug}/edition`);
    });
  }

  // Bouton de favoris et une seule liste ouverte sur cet appareil : pas de choix à faire.
  const auto = useRef(false);
  useEffect(() => {
    if (!page || lists.length !== 1 || auto.current) return;
    auto.current = true;
    add(lists[0]!);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- une seule fois, à l'arrivée.
  }, []);

  const price = page
    ? parsePrice(page.price, /^[A-Za-z]{3}$/.test(page.currency) ? page.currency.toUpperCase() : null)
    : null;

  return (
    <div className="relative flex flex-col gap-6">
      {page ? (
        <div className="flex items-center gap-4 rounded-field border border-line bg-white/55 p-3">
          {page.image ? (
            // Aperçu venu de la boutique : pas d'optimisation Next pour une adresse quelconque.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={page.image}
              alt=""
              referrerPolicy="no-referrer"
              className="size-20 shrink-0 rounded-[14px] bg-white object-contain"
            />
          ) : null}
          <div className="flex min-w-0 flex-col gap-1">
            <span className="line-clamp-3 text-[15px] leading-snug font-semibold">
              {page.title || hostOf(page.url)}
            </span>
            {price ? (
              <span className="text-[15px] text-ink-soft">
                {formatPrice(price.cents, price.currency ?? "EUR")}
              </span>
            ) : null}
            <span className="truncate text-[13px] text-muted">{hostOf(page.url)}</span>
          </div>
        </div>
      ) : (
        <p className="m-0 flex items-start gap-2.5 rounded-field border border-line bg-white/55 px-4 py-3.5 text-[15px] leading-snug">
          {isLink ? <Link2 aria-hidden="true" size={18} className="mt-0.5 shrink-0 text-muted" /> : null}
          <span className="line-clamp-3 break-all">{line}</span>
        </p>
      )}

      {lists.length === 0 ? (
        <>
          <p className="m-0 text-base text-ink-soft">
            {page
              ? "Ouvrez d'abord une de vos listes en mode édition sur cet appareil."
              : "Ouvrez d'abord une de vos listes en mode édition sur ce téléphone."}
          </p>
          <Link href="/" className={buttonClasses("ink", 56, "w-full sm:w-auto sm:self-start")}>
            Toutes les listes
          </Link>
        </>
      ) : (
        <section aria-labelledby="share-choose" className="flex flex-col gap-3">
          <h2 id="share-choose" className="m-0 text-base font-semibold">
            Dans quelle liste ?
          </h2>
          <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
            {lists.map((list) => (
              <li key={list.id}>
                <button
                  type="button"
                  onClick={() => add(list)}
                  disabled={pending}
                  aria-busy={chosen === list.id}
                  className="flex min-h-16 w-full items-center justify-between gap-3 rounded-field border border-line-strong bg-white/60 px-4 py-3 text-left text-ink transition-colors duration-180 hover:bg-white/85 disabled:opacity-60"
                >
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <SplitTitle
                      as="span"
                      title={list.title}
                      opsz={72}
                      restColor="text-ochre-deep"
                      className="truncate text-[22px]"
                    />
                    <span className="text-sm text-muted">La liste de {list.ownerName}</span>
                  </span>
                  {chosen === list.id ? (
                    <LoaderCircle aria-hidden="true" size={20} className="shrink-0 animate-spin text-muted" />
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
          {error ? (
            <p role="alert" className="m-0 text-sm text-rust">
              {error}
            </p>
          ) : null}
        </section>
      )}
    </div>
  );
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}
