"use client";

import { Link2, LoaderCircle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { buttonClasses } from "@/components/ui/Button";
import { SplitTitle } from "@/components/ui/SplitTitle";
import { looksLikeUrl } from "@/lib/normalizeUrl";
import { addItems } from "@/server/actions/items";
import type { UnlockedList } from "@/server/auth/session";

type Props = { line: string; lists: UnlockedList[] };

/** Choix de la liste puis ajout direct dans « À trier ». */
export function ShareTarget({ line, lists }: Props) {
  const router = useRouter();
  const [chosen, setChosen] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const isLink = looksLikeUrl(line) || /^https?:\/\//i.test(line);

  function add(list: UnlockedList) {
    setChosen(list.id);
    setError(null);
    startTransition(async () => {
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

  return (
    <div className="relative flex flex-col gap-6">
      <p className="m-0 flex items-start gap-2.5 rounded-field border border-line bg-white/55 px-4 py-3.5 text-[15px] leading-snug">
        {isLink ? <Link2 aria-hidden="true" size={18} className="mt-0.5 shrink-0 text-muted" /> : null}
        <span className="line-clamp-3 break-all">{line}</span>
      </p>

      {lists.length === 0 ? (
        <>
          <p className="m-0 text-base text-ink-soft">
            Ouvrez d&apos;abord une de vos listes en mode édition sur ce téléphone.
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
