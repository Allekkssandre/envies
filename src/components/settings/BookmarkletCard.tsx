"use client";

import { BookmarkPlus, Copy } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button, buttonClasses } from "@/components/ui/Button";
import { bookmarkletHref } from "@/lib/bookmarklet";
import { Card } from "./Card";

/**
 * Installation du bouton de favoris « Ajouter à Envies ». Ordinateur : le glisser dans la barre
 * de favoris. Téléphone : copier son code et le coller comme adresse d'un favori.
 */
export function BookmarkletCard() {
  const link = useRef<HTMLAnchorElement>(null);
  const [code, setCode] = useState<string | null>(null);

  useEffect(() => {
    const href = bookmarkletHref(window.location.origin);
    // React refuse les adresses `javascript:` dans `href` : posée directement sur l'élément.
    link.current?.setAttribute("href", href);
    queueMicrotask(() => setCode(href));
  }, []);

  async function copy() {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      toast("Code copié");
    } catch {
      toast("La copie n'a pas marché.");
    }
  }

  return (
    <Card
      id="favori"
      title="Bouton d'ajout"
      text="Certaines boutiques refusent leurs pages à Envies. Ce bouton lit le nom, le prix et la photo dans votre navigateur."
    >
      <div className="flex flex-col gap-3 max-lg:hidden">
        <div className="flex items-center gap-4">
          <a
            ref={link}
            draggable
            onClick={(e) => {
              e.preventDefault();
              toast("Glissez-le dans la barre de favoris.");
            }}
            className={buttonClasses("ink", 46, "cursor-grab active:cursor-grabbing")}
          >
            <BookmarkPlus aria-hidden="true" />
            Ajouter à Envies
          </a>
          <p className="m-0 text-[13px] text-muted">
            Glissez ce bouton dans la barre de favoris. Sur une fiche produit, cliquez dessus.
          </p>
        </div>
      </div>
      <div className="flex flex-col gap-3 lg:hidden">
        <Button variant="outline" size={46} className="w-full" onClick={copy} disabled={!code}>
          <Copy aria-hidden="true" />
          Copier le code du favori
        </Button>
        <p className="m-0 text-[13px] text-muted">
          Ajoutez un favori à n&apos;importe quelle page, puis remplacez son adresse par ce code. Sur une
          fiche produit, ouvrez ce favori.
        </p>
      </div>
      <p className="m-0 text-[13px] text-muted">
        Un article déjà dans la liste est complété : son prix et sa photo s&apos;ajoutent.
      </p>
    </Card>
  );
}
