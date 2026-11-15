import { useId, type CSSProperties } from "react";

// Le compteur de Magie : une boule à neige remplie de lumière dorée. Plus la Magie baisse,
// plus la lumière descend et plus le givre gagne le verre. L'état se lit aussi en toutes
// lettres et en chiffres, jamais par la seule couleur.

export type GlobeState = "serene" | "fragile" | "critical" | "zero";

export const GLOBE_LABEL: Record<GlobeState, string> = {
  serene: "Sereine",
  fragile: "Fragile",
  critical: "Critique",
  zero: "Éteinte",
};

export function globeState(value: number, max: number): GlobeState {
  if (value <= 0) return "zero";
  const ratio = max > 0 ? value / max : 0;
  return ratio >= 0.6 ? "serene" : ratio >= 0.3 ? "fragile" : "critical";
}

// Flocons à l'intérieur du verre : position, durée, décalage, dérive.
const FLAKES: [number, number, number, number, number][] = [
  [62, 9, 0, 8, 1.6],
  [84, 11, -3, -6, 1.2],
  [102, 8, -6, 5, 2],
  [126, 12, -1, -8, 1.4],
  [148, 10, -7, 7, 1.8],
  [168, 9, -4, -5, 1.3],
  [74, 13, -9, 6, 1.1],
  [116, 10, -11, -4, 1.7],
  [158, 12, -2.5, 6, 1.2],
  [92, 9.5, -5.5, -7, 1.5],
  [138, 11, -8, 4, 1.9],
  [178, 10.5, -10, -6, 1.1],
];

// Paillettes dans la lumière, relatives à sa surface.
const SPARKS: [number, number, number][] = [
  [44, 24, 0],
  [70, 52, -1.2],
  [96, 30, -2.1],
  [150, 44, -0.6],
  [176, 22, -1.8],
  [196, 58, -2.6],
  [58, 80, -3.1],
  [184, 90, -0.9],
];

const CX = 120;
const CY = 112;
const R = 96;

export function MagicGlobe({
  value,
  max,
  compact = false,
}: {
  value: number;
  max: number;
  compact?: boolean;
}) {
  const id = useId().replace(/:/g, "");
  const ratio = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0;
  const state = globeState(value, max);
  const lit = state !== "zero";
  // Hauteur de la lumière dans le verre (le haut garde toujours un peu d'air).
  const top = CY - R;
  const span = 2 * R * 0.9;
  const level = top + 2 * R - span * ratio;
  // Le givre commence d'autant plus près du centre que la Magie est basse.
  const frostFrom = lit ? 0.62 + 0.38 * ratio : 0;

  return (
    <div className="flex flex-col items-center gap-3">
      <div
        role="meter"
        aria-label="Magie de Noël"
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={value}
        aria-valuetext={`${value} sur ${max}, ${GLOBE_LABEL[state].toLowerCase()}`}
        className="mg-globe relative"
        data-state={state}
        style={{ width: compact ? 180 : "min(300px, 78vw)" }}
      >
        <svg
          viewBox="0 0 240 290"
          className="block h-auto w-full"
          style={{ overflow: "visible" }}
          aria-hidden="true"
        >
          <defs>
            <radialGradient id={`${id}-halo`} cx="50%" cy="45%" r="55%">
              <stop offset="0%" stopColor="#E8C170" stopOpacity={0.55 * ratio + 0.05} />
              <stop offset="100%" stopColor="#E8C170" stopOpacity="0" />
            </radialGradient>
            <radialGradient id={`${id}-inside`} cx="50%" cy="35%" r="75%">
              <stop offset="0%" stopColor="#24395f" />
              <stop offset="100%" stopColor="#0b1322" />
            </radialGradient>
            <linearGradient id={`${id}-light`} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="200">
              <stop offset="0%" stopColor="#FFF1C4" stopOpacity="0.95" />
              <stop offset="5%" stopColor="#F3C25A" stopOpacity="0.7" />
              <stop offset="55%" stopColor="#D9982F" stopOpacity="0.55" />
              <stop offset="100%" stopColor="#9C6A1C" stopOpacity="0.8" />
            </linearGradient>
            <radialGradient id={`${id}-frost`} cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#E6F1FB" stopOpacity="0" />
              <stop offset={`${Math.max(0, frostFrom - 0.08) * 100}%`} stopColor="#E6F1FB" stopOpacity="0" />
              <stop offset={`${frostFrom * 100}%`} stopColor="#DCEBF8" stopOpacity="0.55" />
              <stop offset="100%" stopColor="#F4F9FE" stopOpacity="0.92" />
            </radialGradient>
            <linearGradient id={`${id}-base`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#6B4523" />
              <stop offset="55%" stopColor="#3E2611" />
              <stop offset="100%" stopColor="#1E1208" />
            </linearGradient>
            <linearGradient id={`${id}-rim`} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#8C6424" />
              <stop offset="50%" stopColor="#F7E7C1" />
              <stop offset="100%" stopColor="#8C6424" />
            </linearGradient>
            <filter id={`${id}-noise`} x="0" y="0" width="100%" height="100%">
              <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="7" result="n" />
              <feColorMatrix
                in="n"
                type="matrix"
                values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 1.6 -0.55"
                result="specks"
              />
              <feComposite in="SourceGraphic" in2="specks" operator="in" />
            </filter>
            <filter id={`${id}-blur`} x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="6" />
            </filter>
            <clipPath id={`${id}-clip`}>
              <circle cx={CX} cy={CY} r={R} />
            </clipPath>
          </defs>

          {/* Halo derrière la boule */}
          <circle className="mg-glow" cx={CX} cy={CY} r={R + 34} fill={`url(#${id}-halo)`} />

          {/* Intérieur */}
          <g clipPath={`url(#${id}-clip)`}>
            <rect x={CX - R} y={CY - R} width={2 * R} height={2 * R} fill={`url(#${id}-inside)`} />
            {/* Lumière dorée, surface ondulée */}
            <g className="mg-liquid" style={{ transform: `translateY(${level}px)` }}>
              <g className="mg-wave">
                <path
                  d="M -20 8 Q 10 -4 40 8 T 100 8 T 160 8 T 220 8 T 280 8 T 340 8 V 260 H -20 Z"
                  fill={`url(#${id}-light)`}
                  opacity={lit ? 1 : 0}
                />
                <path
                  d="M -20 8 Q 10 -4 40 8 T 100 8 T 160 8 T 220 8 T 280 8 T 340 8"
                  fill="none"
                  stroke="#FFF6DD"
                  strokeWidth="1.5"
                  opacity={lit ? 0.8 : 0}
                />
              </g>
              <rect
                x="0"
                y="0"
                width="240"
                height="220"
                fill="#FFE7A8"
                opacity={lit ? 0.12 : 0}
                filter={`url(#${id}-blur)`}
              />
            </g>
            {/* Sapin */}
            <g opacity={lit ? 1 : 0.75}>
              <path d="M120 128 L150 170 H136 L160 200 H80 L104 170 H90 Z" fill="#163a2b" />
              <path d="M120 150 L144 184 H96 Z" fill="#1f4d39" />
              <rect x="114" y="200" width="12" height="12" fill="#3a2614" />
              {lit ? (
                <g fill="#F7E7C1">
                  <circle cx="108" cy="176" r="2.2" />
                  <circle cx="133" cy="168" r="2" />
                  <circle cx="121" cy="190" r="2.2" />
                  <circle cx="98" cy="195" r="1.8" />
                  <circle cx="142" cy="194" r="1.8" />
                </g>
              ) : null}
            </g>
            {/* Étoile du sapin */}
            <g className="mg-star">
              {lit ? (
                <circle cx="120" cy="122" r="16" fill="#F7E7C1" opacity="0.5" filter={`url(#${id}-blur)`} />
              ) : null}
              <path
                d="M120 110 L123.5 118.5 L132.5 119 L125.5 124.5 L128 133 L120 128 L112 133 L114.5 124.5 L107.5 119 L116.5 118.5 Z"
                fill={lit ? "#FFE7A8" : "#7d8aa3"}
              />
            </g>
            {/* Neige */}
            {lit
              ? FLAKES.map(([x, d, delay, drift, r], i) => (
                  <circle
                    key={i}
                    className="mg-flake"
                    cx={x}
                    cy={CY - R}
                    r={r}
                    fill="#fff"
                    opacity="0.85"
                    style={
                      {
                        "--d": `${d}s`,
                        "--delay": `${delay}s`,
                        "--drift": `${drift}px`,
                      } as CSSProperties
                    }
                  />
                ))
              : null}
            {/* Givre */}
            <circle cx={CX} cy={CY} r={R} fill={`url(#${id}-frost)`} />
            <circle
              cx={CX}
              cy={CY}
              r={R}
              fill={`url(#${id}-frost)`}
              filter={`url(#${id}-noise)`}
              opacity="0.9"
            />
          </g>

          {/* Verre */}
          <circle cx={CX} cy={CY} r={R} fill="none" stroke="rgba(230,240,252,0.45)" strokeWidth="1.5" />
          <path
            d={`M ${CX - 70} ${CY - 46} A ${R - 12} ${R - 12} 0 0 1 ${CX - 18} ${CY - 82}`}
            fill="none"
            stroke="rgba(255,255,255,0.55)"
            strokeWidth="5"
            strokeLinecap="round"
          />
          <ellipse
            cx={CX + 52}
            cy={CY - 58}
            rx="7"
            ry="4"
            fill="rgba(255,255,255,0.35)"
            transform={`rotate(35 ${CX + 52} ${CY - 58})`}
          />

          {/* Socle */}
          <path d="M44 214 Q120 236 196 214 L210 262 Q120 286 30 262 Z" fill={`url(#${id}-base)`} />
          <path d="M44 214 Q120 236 196 214" fill="none" stroke={`url(#${id}-rim)`} strokeWidth="3" />
          <path
            d="M33 254 Q120 278 207 254"
            fill="none"
            stroke={`url(#${id}-rim)`}
            strokeWidth="1.5"
            opacity="0.7"
          />
        </svg>
      </div>

      <div className="flex flex-col items-center gap-1.5">
        <p className="m-0 flex items-baseline gap-2" aria-hidden="true">
          <span className={`mg-title leading-none ${compact ? "text-[44px]" : "text-[64px]"}`}>{value}</span>
          <span className="text-[15px] text-[var(--mg-soft)]">sur {max}</span>
        </p>
        <p className="mg-kicker m-0" aria-hidden="true">
          Magie {GLOBE_LABEL[state].toLowerCase()}
        </p>
        {max <= 40 ? (
          <div className="mg-pips flex max-w-[260px] flex-wrap justify-center gap-1" aria-hidden="true">
            {Array.from({ length: max }, (_, i) => (
              <span key={i} data-on={i < value} />
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
