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

function KrampusMask() {
  return (
    <svg viewBox="0 0 120 120" className="h-auto w-[58%]" aria-hidden="true">
      <defs>
        <linearGradient id="mg-horn" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stopColor="#5A3B22" />
          <stop offset="100%" stopColor="#E9D9B8" />
        </linearGradient>
        <radialGradient id="mg-face" cx="50%" cy="40%" r="60%">
          <stop offset="0%" stopColor="#4B2A22" />
          <stop offset="100%" stopColor="#1A0E0B" />
        </radialGradient>
      </defs>
      {/* Cornes */}
      <path d="M40 44 C 30 30 26 14 34 4 C 36 16 42 26 50 34 Z" fill="url(#mg-horn)" />
      <path d="M80 44 C 90 30 94 14 86 4 C 84 16 78 26 70 34 Z" fill="url(#mg-horn)" />
      <path d="M33 10 L 37 12 M31 18 L 36 19 M32 26 L 38 26" stroke="#5A3B22" strokeWidth="1.2" />
      <path d="M87 10 L 83 12 M89 18 L 84 19 M88 26 L 82 26" stroke="#5A3B22" strokeWidth="1.2" />
      {/* Tête et fourrure */}
      <path
        d="M60 30 C 82 30 92 46 90 66 C 88 86 74 100 60 104 C 46 100 32 86 30 66 C 28 46 38 30 60 30 Z"
        fill="url(#mg-face)"
      />
      <path
        d="M30 62 C 24 70 26 84 34 92 C 34 84 36 78 40 74 Z M90 62 C 96 70 94 84 86 92 C 86 84 84 78 80 74 Z"
        fill="#2A1712"
      />
      {/* Yeux */}
      <path d="M44 58 Q 50 54 56 60 Q 50 62 44 58 Z" fill="#F2C14E" />
      <path d="M76 58 Q 70 54 64 60 Q 70 62 76 58 Z" fill="#F2C14E" />
      <circle cx="50.5" cy="58.6" r="1.3" fill="#1A0E0B" />
      <circle cx="69.5" cy="58.6" r="1.3" fill="#1A0E0B" />
      {/* Sourire et langue */}
      <path d="M46 78 Q 60 88 74 78" fill="none" stroke="#E9D9B8" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M57 82 Q 60 96 64 82 Z" fill="#B42A1F" />
      {/* Grelot */}
      <path d="M56 104 Q 60 100 64 104 L 66 112 H 54 Z" fill="#D9A441" />
      <circle cx="60" cy="113" r="2" fill="#8C6424" />
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
          {role === "pn" ? <SantaHat /> : <KrampusMask />}
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
