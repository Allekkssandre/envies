import { useId, type CSSProperties } from "react";

// Le compteur de Magie : une boule à neige à l'ancienne. Dedans, un hameau sous la neige et un
// sapin dont les ampoules s'allument avec la Magie. Quand elle baisse, les ampoules s'éteignent
// une à une, les fenêtres du chalet faiblissent et le givre gagne le verre. À 0, tout est gelé.
// L'état se lit aussi en chiffres et en toutes lettres, jamais par la seule couleur.

export type GlobeState = "serene" | "fragile" | "critical" | "zero";

export const GLOBE_LABEL: Record<GlobeState, string> = {
  serene: "rayonnante",
  fragile: "vacillante",
  critical: "en danger",
  zero: "éteinte",
};

export function globeState(value: number, max: number): GlobeState {
  if (value <= 0) return "zero";
  const ratio = max > 0 ? value / max : 0;
  return ratio >= 0.6 ? "serene" : ratio >= 0.3 ? "fragile" : "critical";
}

const CX = 130;
const CY = 118;
const R = 100;

// Ampoules de la guirlande, de haut en bas.
const BULBS: [number, number][] = [
  [129, 118],
  [141, 121],
  [152, 117],
  [118, 142],
  [130, 147],
  [143, 148],
  [156, 145],
  [166, 140],
  [110, 170],
  [124, 176],
  [139, 178],
  [153, 177],
  [167, 172],
];
const BULB_COLORS = ["#F0604D", "#F7C948", "#9CCBF2", "#F7C948"];

// Flocons : position, durée, décalage, dérive, rayon.
const FLAKES: [number, number, number, number, number][] = [
  [60, 9, 0, 8, 1.6],
  [82, 11, -3, -6, 1.2],
  [104, 8, -6, 5, 2],
  [128, 12, -1, -8, 1.4],
  [152, 10, -7, 7, 1.8],
  [174, 9, -4, -5, 1.3],
  [196, 13, -9, 6, 1.1],
  [70, 10, -11, -4, 1.7],
  [116, 12, -2.5, 6, 1.2],
  [164, 9.5, -5.5, -7, 1.5],
  [208, 11, -8, 4, 1.9],
  [92, 10.5, -10, -6, 1.1],
];

// Étincelles dorées qui montent autour du sapin.
const SPARKS: [number, number, number][] = [
  [104, 150, 0],
  [176, 158, -1.1],
  [120, 132, -2.3],
  [162, 120, -0.6],
  [96, 118, -3.1],
  [184, 132, -1.8],
  [140, 100, -2.7],
  [112, 176, -0.3],
  [170, 186, -3.6],
  [150, 140, -1.5],
];

const HOLLY_LEAF = "M0 0 C 6 -6 12 -2 16 -8 C 18 -2 24 -2 26 2 C 20 4 22 10 16 12 C 12 6 6 10 0 0 Z";

export function MagicGlobe({ value, max }: { value: number; max: number }) {
  const id = useId().replace(/:/g, "");
  const ratio = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0;
  const state = globeState(value, max);
  const lit = state !== "zero";
  const bulbsOn = lit ? Math.max(1, Math.round(ratio * BULBS.length)) : 0;
  const sparks = lit ? Math.round(ratio * SPARKS.length) : 0;
  const windows = { serene: 1, fragile: 0.75, critical: 0.35, zero: 0 }[state];
  // Le givre part du bord du verre et avance vers le centre quand la Magie baisse.
  const frostFrom = lit ? 0.6 + 0.4 * ratio : 0;
  const u = (name: string) => `url(#${id}-${name})`;

  return (
    <div className="flex flex-col items-center gap-2">
      <div
        role="meter"
        aria-label="Magie de Noël"
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={value}
        aria-valuetext={`${value} sur ${max}, ${GLOBE_LABEL[state]}`}
        className="mg-globe relative"
        data-state={state}
        style={{ width: "min(320px, 80vw)" }}
      >
        <svg
          viewBox="0 0 260 300"
          className="block h-auto w-full"
          style={{ overflow: "visible" }}
          aria-hidden="true"
        >
          <defs>
            <radialGradient id={`${id}-halo`} cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#F7C46A" stopOpacity={0.5 * ratio + 0.04} />
              <stop offset="100%" stopColor="#F7C46A" stopOpacity="0" />
            </radialGradient>
            <radialGradient id={`${id}-sky`} cx="50%" cy="30%" r="80%">
              <stop offset="0%" stopColor="#30497a" />
              <stop offset="70%" stopColor="#14254a" />
              <stop offset="100%" stopColor="#0b1530" />
            </radialGradient>
            <radialGradient id={`${id}-aura`} cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#FFE3A3" stopOpacity="0.9" />
              <stop offset="45%" stopColor="#F5B94F" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#F5B94F" stopOpacity="0" />
            </radialGradient>
            <linearGradient id={`${id}-snow`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#FFFFFF" />
              <stop offset="100%" stopColor="#CFDDEE" />
            </linearGradient>
            <linearGradient id={`${id}-fir`} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#24563F" />
              <stop offset="55%" stopColor="#1A4431" />
              <stop offset="100%" stopColor="#123224" />
            </linearGradient>
            <radialGradient id={`${id}-frost`} cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#E6F1FB" stopOpacity="0" />
              <stop offset={`${Math.max(0, frostFrom - 0.1) * 100}%`} stopColor="#E6F1FB" stopOpacity="0" />
              <stop offset={`${frostFrom * 100}%`} stopColor="#DCEBF8" stopOpacity="0.5" />
              <stop offset="100%" stopColor="#F6FAFE" stopOpacity="0.95" />
            </radialGradient>
            <linearGradient id={`${id}-wood`} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#3B2010" />
              <stop offset="30%" stopColor="#7A4A26" />
              <stop offset="55%" stopColor="#8F5A30" />
              <stop offset="100%" stopColor="#2E180B" />
            </linearGradient>
            <linearGradient id={`${id}-ribbon`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#C8372B" />
              <stop offset="100%" stopColor="#7E1912" />
            </linearGradient>
            <linearGradient id={`${id}-brass`} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#8C6424" />
              <stop offset="50%" stopColor="#F3D58E" />
              <stop offset="100%" stopColor="#8C6424" />
            </linearGradient>
            <filter id={`${id}-noise`} x="0" y="0" width="100%" height="100%">
              <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed="11" result="n" />
              <feColorMatrix
                in="n"
                type="matrix"
                values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 1.7 -0.6"
                result="specks"
              />
              <feComposite in="SourceGraphic" in2="specks" operator="in" />
            </filter>
            <filter id={`${id}-glow`} x="-100%" y="-100%" width="300%" height="300%">
              <feGaussianBlur stdDeviation="3" />
            </filter>
            <filter id={`${id}-soft`} x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="8" />
            </filter>
            <clipPath id={`${id}-clip`}>
              <circle cx={CX} cy={CY} r={R} />
            </clipPath>
          </defs>

          {/* Halo chaud autour de la boule */}
          <circle className="mg-glow" cx={CX} cy={CY + 10} r={R + 40} fill={u("halo")} />

          <g clipPath={u("clip")}>
            {/* Ciel de nuit et étoiles lointaines */}
            <rect x={CX - R} y={CY - R} width={2 * R} height={2 * R} fill={u("sky")} />
            <g fill="#fff" opacity="0.7">
              <circle cx="72" cy="62" r="0.9" />
              <circle cx="98" cy="40" r="0.7" />
              <circle cx="176" cy="48" r="1" />
              <circle cx="200" cy="80" r="0.7" />
              <circle cx="60" cy="96" r="0.6" />
              <circle cx="190" cy="104" r="0.8" />
            </g>

            {/* Lumière de la Magie autour du sapin */}
            <circle
              className="mg-glow"
              cx="140"
              cy="140"
              r="78"
              fill={u("aura")}
              opacity={0.1 + 0.75 * ratio}
            />

            {/* Collines enneigées */}
            <path d="M20 186 Q 70 166 118 180 T 240 172 V 240 H 20 Z" fill="#DCE7F4" />
            <path d="M20 204 Q 90 186 160 200 T 245 194 V 240 H 20 Z" fill={u("snow")} />

            {/* Chalet */}
            <g>
              <rect x="52" y="168" width="38" height="28" fill="#6B3B22" />
              <path d="M46 170 L71 148 L96 170 Z" fill="#4A2A18" />
              <path d="M44 171 L71 146 L98 171 L94 173 L71 152 L48 173 Z" fill="#F7FBFF" />
              <rect x="80" y="150" width="7" height="12" fill="#4A2A18" />
              <rect x="79" y="148" width="9" height="3" rx="1" fill="#F7FBFF" />
              <rect x="58" y="176" width="9" height="9" fill="#2B3348" />
              <rect x="75" y="176" width="9" height="9" fill="#2B3348" />
              <g opacity={windows}>
                <rect x="58" y="176" width="9" height="9" fill="#FFD27A" />
                <rect x="75" y="176" width="9" height="9" fill="#FFD27A" />
                <rect
                  x="54"
                  y="172"
                  width="34"
                  height="18"
                  fill="#FFC861"
                  opacity="0.35"
                  filter={u("glow")}
                />
              </g>
              <path
                d="M62.5 176 V185 M58 180.5 H67 M79.5 176 V185 M75 180.5 H84"
                stroke="#4A2A18"
                strokeWidth="1"
              />
            </g>

            {/* Sapin */}
            <g>
              <path d="M140 150 L196 198 H84 Z" fill={u("fir")} />
              <path d="M140 128 L186 176 H94 Z" fill={u("fir")} />
              <path d="M140 106 L174 147 H106 Z" fill={u("fir")} />
              <path d="M140 88 L163 122 H117 Z" fill={u("fir")} />
              {/* Neige sur les branches */}
              <g fill="#F4F9FF" opacity="0.85">
                <path d="M84 198 Q 98 192 110 197 Q 124 191 138 197 Q 152 191 166 197 Q 180 191 196 198 Z" />
                <path d="M94 176 Q 106 171 118 175 Q 130 170 142 175 Q 156 170 170 175 Q 178 172 186 176 Z" />
                <path d="M106 147 Q 116 143 126 146 Q 136 142 146 146 Q 158 142 174 147 Z" />
              </g>
              {/* Guirlande dorée */}
              <g fill="none" stroke="#E9C26A" strokeWidth="1.2" opacity="0.85">
                <path d="M123 116 Q 140 126 158 114" />
                <path d="M112 139 Q 140 154 170 137" />
                <path d="M104 167 Q 140 184 176 166" />
              </g>
              {/* Ampoules */}
              {BULBS.map(([x, y], i) => {
                const on = i < bulbsOn;
                const color = BULB_COLORS[i % BULB_COLORS.length]!;
                return (
                  <g key={i}>
                    {on ? (
                      <circle
                        className="mg-bulb"
                        cx={x}
                        cy={y}
                        r="5"
                        fill={color}
                        opacity="0.55"
                        filter={u("glow")}
                        style={{ animationDelay: `${-((i * 0.37) % 3)}s` } as CSSProperties}
                      />
                    ) : null}
                    <circle cx={x} cy={y} r="2.4" fill={on ? color : "#3A4256"} />
                    {on ? <circle cx={x - 0.7} cy={y - 0.8} r="0.8" fill="#fff" opacity="0.8" /> : null}
                  </g>
                );
              })}
              {/* Étoile */}
              <g className="mg-star">
                {lit ? (
                  <circle cx="140" cy="84" r="14" fill="#FFE7A8" opacity="0.6" filter={u("soft")} />
                ) : null}
                <path
                  d="M140 72 L143.8 80.6 L153 81.3 L146 87.2 L148.2 96.2 L140 91.4 L131.8 96.2 L134 87.2 L127 81.3 L136.2 80.6 Z"
                  fill={lit ? "#FFE08A" : "#8390A8"}
                  stroke={lit ? "#FFF4D0" : "none"}
                  strokeWidth="0.8"
                />
              </g>
            </g>

            {/* Étincelles */}
            {SPARKS.slice(0, sparks).map(([x, y, d], i) => (
              <circle
                key={i}
                className="mg-spark"
                cx={x}
                cy={y}
                r="1.3"
                fill="#FFE7A8"
                style={{ animationDelay: `${d}s` } as CSSProperties}
              />
            ))}

            {/* Neige qui tombe */}
            {lit
              ? FLAKES.map(([x, d, delay, drift, r], i) => (
                  <circle
                    key={i}
                    className="mg-flake"
                    cx={x}
                    cy={CY - R}
                    r={r}
                    fill="#fff"
                    opacity="0.9"
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
            <circle cx={CX} cy={CY} r={R} fill={u("frost")} />
            <circle cx={CX} cy={CY} r={R} fill={u("frost")} filter={u("noise")} opacity="0.9" />
          </g>

          {/* Verre */}
          <circle cx={CX} cy={CY} r={R} fill="none" stroke="rgba(235,244,255,0.55)" strokeWidth="1.6" />
          <circle cx={CX} cy={CY} r={R - 3} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="4" />
          <path
            d={`M ${CX - 74} ${CY - 44} A ${R - 12} ${R - 12} 0 0 1 ${CX - 22} ${CY - 84}`}
            fill="none"
            stroke="rgba(255,255,255,0.6)"
            strokeWidth="6"
            strokeLinecap="round"
          />
          <path
            d={`M ${CX + 62} ${CY + 58} A ${R - 14} ${R - 14} 0 0 0 ${CX + 82} ${CY + 18}`}
            fill="none"
            stroke="rgba(255,255,255,0.22)"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <ellipse
            cx={CX + 54}
            cy={CY - 62}
            rx="8"
            ry="4"
            fill="rgba(255,255,255,0.4)"
            transform={`rotate(35 ${CX + 54} ${CY - 62})`}
          />

          {/* Socle en bois tourné */}
          <path d="M52 212 Q130 236 208 212 L222 266 Q130 292 38 266 Z" fill={u("wood")} />
          <path d="M52 212 Q130 236 208 212" fill="none" stroke={u("brass")} strokeWidth="3" />
          <path d="M38 266 Q130 292 222 266 L224 274 Q130 300 36 274 Z" fill="#24130A" />
          {/* Ruban de velours */}
          <path d="M47 232 Q130 256 213 232 L216 246 Q130 270 44 246 Z" fill={u("ribbon")} />
          <path d="M47 232 Q130 256 213 232" fill="none" stroke="#E25546" strokeWidth="1" opacity="0.7" />
          {/* Nœud */}
          <g transform="translate(130 250)">
            <path d="M0 0 C -10 -14 -30 -14 -28 -2 C -26 8 -10 6 0 0 Z" fill="#B42A1F" />
            <path d="M0 0 C 10 -14 30 -14 28 -2 C 26 8 10 6 0 0 Z" fill="#A3241A" />
            <path d="M-3 2 L -12 22 L -6 20 L -2 26 Z" fill="#8E1E15" />
            <path d="M3 2 L 12 22 L 6 20 L 2 26 Z" fill="#7E1912" />
            <ellipse cx="0" cy="0" rx="5" ry="6" fill="#C8372B" />
          </g>
          {/* Houx */}
          <g transform="translate(78 244) rotate(-12)">
            <path d={HOLLY_LEAF} fill="#2F6B3F" />
            <path d={HOLLY_LEAF} fill="#27593A" transform="scale(-1 1)" />
            <circle cx="-2" cy="-3" r="3.2" fill="#D9342B" />
            <circle cx="3.5" cy="-1" r="3.2" fill="#C42A22" />
            <circle cx="0" cy="3" r="3.2" fill="#E0453A" />
          </g>
          <g transform="translate(184 246) rotate(14)">
            <path d={HOLLY_LEAF} fill="#2F6B3F" />
            <circle cx="-1" cy="-2" r="3" fill="#D9342B" />
            <circle cx="3" cy="2" r="3" fill="#C42A22" />
          </g>
        </svg>
      </div>

      <div className="flex flex-col items-center gap-1">
        <p className="m-0 flex items-baseline gap-2" aria-hidden="true">
          <span className="mg-title text-[64px] leading-none">{value}</span>
          <span className="text-[15px] text-[var(--mg-soft)]">sur {max}</span>
        </p>
        <p className="mg-script m-0 text-[22px]" aria-hidden="true">
          Magie {GLOBE_LABEL[state]}
        </p>
        {max <= 40 ? (
          <div className="mg-pips mt-1 flex max-w-[280px] flex-wrap justify-center gap-1" aria-hidden="true">
            {Array.from({ length: max }, (_, i) => (
              <span key={i} data-on={i < value} />
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
