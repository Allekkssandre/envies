"use client";

import { useState, useSyncExternalStore } from "react";
import type { Role } from "@/lib/magic/engine";
import { ROLE_LABEL, ROLE_MISSION } from "@/lib/magic/texts";

// Carte de rôle, face cachée à la première visite : on la retourne d'un geste.
// L'appareil s'en souvient ensuite (simple confort, rien d'important n'en dépend).

// Cartes illustrées (design/magie/*@2x.png, exportées en WebP dans public/magie/).
// Le texte de l'image est doublé en texte masqué pour les lecteurs d'écran.
const CARD_IMAGE: Record<Role, string> = {
  pn: "/magie/carte-pere-noel.webp",
  gr: "/magie/carte-krampus.webp",
};

const noop = () => () => {};

function readFlipped(key: string): boolean {
  try {
    return localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

/** Carte déjà retournée sur cet appareil, ou retournée à l'instant. */
export function useFlipped(storageKey: string): [boolean, () => void] {
  const stored = useSyncExternalStore(
    noop,
    () => readFlipped(storageKey),
    () => false,
  );
  const [clicked, setClicked] = useState(false);
  const flip = () => {
    setClicked(true);
    try {
      localStorage.setItem(storageKey, "1");
    } catch {
      // Sans stockage, on la retournera à la prochaine visite.
    }
  };
  return [stored || clicked, flip];
}

export function RoleCard({ role, flipped, onFlip }: { role: Role; flipped: boolean; onFlip: () => void }) {
  return (
    <div className="mg-card mx-auto w-full max-w-[300px]" data-flipped={flipped}>
      <div className="mg-card-inner">
        <button
          type="button"
          onClick={onFlip}
          tabIndex={flipped ? -1 : 0}
          aria-hidden={flipped}
          className="mg-face mg-face-back flex flex-col items-center justify-center gap-4 p-6 text-center"
        >
          <span className="mg-frame" aria-hidden="true" />
          <svg viewBox="0 0 40 40" className="w-16" aria-hidden="true">
            <path
              d="M20 2 L24.5 14.5 L38 15 L27.5 23 L31 36 L20 28.5 L9 36 L12.5 23 L2 15 L15.5 14.5 Z"
              fill="#E8C170"
            />
          </svg>
          <span className="mg-title text-[26px] leading-tight">Votre rôle</span>
          <span className="mg-btn">Retourner la carte</span>
        </button>
        <div className="mg-face mg-face-front mg-face-image" aria-hidden={!flipped}>
          {/* eslint-disable-next-line @next/next/no-img-element -- image statique, déjà optimisée */}
          <img
            src={CARD_IMAGE[role]}
            alt=""
            width={840}
            height={1173}
            className="block h-full w-full object-contain"
            decoding="async"
          />
          <span className="sr-only">
            Vous êtes {ROLE_LABEL[role]}. {ROLE_MISSION[role]} Personne d&apos;autre ne voit cette carte.
          </span>
        </div>
      </div>
    </div>
  );
}
