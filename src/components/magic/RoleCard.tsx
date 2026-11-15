"use client";

import { useState, useSyncExternalStore } from "react";
import type { Role } from "@/lib/magic/engine";
import { ROLE_LABEL, ROLE_MISSION } from "@/lib/magic/texts";

// Carte de rôle, face cachée à la première visite : on la retourne d'un geste.
// L'appareil s'en souvient ensuite (simple confort, rien d'important n'en dépend).

function SantaHat() {
  return (
    <svg viewBox="0 0 120 100" className="h-auto w-[56%]" aria-hidden="true">
      <defs>
        <linearGradient id="mg-hat" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#E0574A" />
          <stop offset="100%" stopColor="#8E2318" />
        </linearGradient>
      </defs>
      <path
        d="M22 74 C 30 36 54 14 84 12 C 96 11 104 20 102 30 C 96 26 88 26 82 32 C 74 42 76 58 86 74 Z"
        fill="url(#mg-hat)"
      />
      <circle cx="104" cy="32" r="10" fill="#F7F1E6" />
      <rect x="14" y="70" width="80" height="18" rx="9" fill="#F7F1E6" />
      <path d="M20 80 h68" stroke="#E6DCCB" strokeWidth="2" strokeDasharray="2 5" strokeLinecap="round" />
    </svg>
  );
}

function CrackedBauble() {
  return (
    <svg viewBox="0 0 120 120" className="h-auto w-[52%]" aria-hidden="true">
      <defs>
        <radialGradient id="mg-bauble" cx="38%" cy="35%" r="70%">
          <stop offset="0%" stopColor="#7FC59E" />
          <stop offset="60%" stopColor="#2F6B4F" />
          <stop offset="100%" stopColor="#0D2219" />
        </radialGradient>
      </defs>
      <path d="M60 8 v12" stroke="#CFE3F5" strokeWidth="2" />
      <rect x="50" y="18" width="20" height="12" rx="3" fill="#B9C6D6" />
      <circle cx="60" cy="72" r="42" fill="url(#mg-bauble)" />
      <path
        d="M44 34 L56 56 L46 70 L60 84 L52 104"
        fill="none"
        stroke="#E6F1FB"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      <path d="M56 56 L70 60" stroke="#E6F1FB" strokeWidth="1.6" />
      <ellipse cx="44" cy="54" rx="9" ry="5" fill="#fff" opacity="0.35" transform="rotate(-35 44 54)" />
    </svg>
  );
}

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
        <div
          className={`mg-face mg-face-front flex flex-col items-center justify-between p-6 text-center ${
            role === "pn" ? "mg-face-pn" : "mg-face-gr"
          }`}
          aria-hidden={!flipped}
        >
          <span className="mg-frame" aria-hidden="true" />
          <span className="mg-kicker relative mt-2 !text-[var(--mg-gold-hi)]">Vous êtes</span>
          {role === "pn" ? <SantaHat /> : <CrackedBauble />}
          <div className="relative flex flex-col gap-2">
            <span className="mg-title text-[34px] leading-none !text-[#FFF6E0]">{ROLE_LABEL[role]}</span>
            <span className="text-[14px] leading-snug text-[#F7EEDD]">{ROLE_MISSION[role]}</span>
          </div>
          <span className="relative mb-1 text-[12px] text-[#F7EEDD]/80">
            Personne d&apos;autre ne voit cette carte.
          </span>
        </div>
      </div>
    </div>
  );
}
