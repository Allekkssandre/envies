import { useId } from "react";

// Garnitures de Noël des panneaux du jeu : guirlande de sapin, boules, lumières, nœud de
// velours, houx. Purement décoratives (aria-hidden), animées en CSS (magic.css), immobiles
// si l'appareil demande moins de mouvement.

/** Point d'une courbe de Bézier quadratique. */
function quad(p0: number[], c: number[], p1: number[], t: number): [number, number] {
  const u = 1 - t;
  return [
    u * u * p0[0]! + 2 * u * t * c[0]! + t * t * p1[0]!,
    u * u * p0[1]! + 2 * u * t * c[1]! + t * t * p1[1]!,
  ];
}

// Deux festons qui se rejoignent au centre, sous le nœud.
const LEFT = { p0: [-20, 6], c: [180, 76], p1: [360, 14] };
const RIGHT = { p0: [360, 14], c: [540, 76], p1: [740, 6] };
const SWAG_PATH = "M-20 6 Q180 76 360 14 Q540 76 740 6";
const WIRE_PATH = "M-20 14 Q180 88 360 22 Q540 88 740 14";

const BULB_COLORS = ["#ffd98a", "#ff8a6b", "#fff1c9", "#9fe0b0", "#ffc25c"];
const BAUBLES: { swag: typeof LEFT; t: number; drop: number; r: number; tone: "red" | "gold" | "green" }[] = [
  { swag: LEFT, t: 0.3, drop: 18, r: 8, tone: "gold" },
  { swag: LEFT, t: 0.52, drop: 30, r: 11, tone: "red" },
  { swag: LEFT, t: 0.74, drop: 14, r: 7, tone: "green" },
  { swag: RIGHT, t: 0.26, drop: 14, r: 7, tone: "green" },
  { swag: RIGHT, t: 0.48, drop: 30, r: 11, tone: "red" },
  { swag: RIGHT, t: 0.7, drop: 18, r: 8, tone: "gold" },
  { swag: LEFT, t: 0.12, drop: 10, r: 6, tone: "red" },
  { swag: RIGHT, t: 0.88, drop: 10, r: 6, tone: "red" },
];

/**
 * Aiguilles de sapin en biais le long des festons : brins courts, orientés au hasard (tirage
 * fixe, identique au serveur et au navigateur), pour casser la régularité du peigne.
 */
function needles(shade: number): string {
  let seed = 7 + shade * 31;
  const rnd = () => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed / 2147483648;
  };
  const parts: string[] = [];
  for (const s of [LEFT, RIGHT]) {
    for (let i = 0; i <= 60; i++) {
      const [x, y] = quad(s.p0, s.c, s.p1, i / 60);
      for (let k = 0; k < 3; k++) {
        const angle = (rnd() * 2 - 1) * 1.25 + (rnd() < 0.5 ? 0 : Math.PI);
        const len = 6 + rnd() * 9;
        const ox = (rnd() * 2 - 1) * 4;
        const oy = (rnd() * 2 - 1) * 5 - shade * 2;
        const dx = Math.sin(angle) * len;
        const dy = Math.cos(angle) * len;
        parts.push(`M${(x + ox).toFixed(1)} ${(y + oy).toFixed(1)}l${dx.toFixed(1)} ${dy.toFixed(1)}`);
      }
    }
  }
  return parts.join("");
}
const NEEDLES = [needles(0), needles(1), needles(2)];

/** Guirlande de sapin garnie, posée en haut d'un panneau. */
export function Garland({ accent = "red" }: { accent?: "red" | "gold" }) {
  const id = useId().replace(/:/g, "");
  // Sur velours rouge : nœud doré et boules or, vert et ivoire ; sur sapin : nœud rouge.
  const tones: Record<"red" | "gold" | "green", "red" | "gold" | "green" | "ivory"> =
    accent === "gold"
      ? { red: "gold", gold: "ivory", green: "green" }
      : { red: "red", gold: "gold", green: "green" };
  const bulbs = [LEFT, RIGHT].flatMap((s, side) =>
    Array.from({ length: 9 }, (_, i) => {
      const t = 0.06 + i * 0.11;
      const [x, y] = quad(s.p0, [s.c[0]!, s.c[1]! + 12], s.p1, t);
      return {
        x,
        y: y + 8,
        color: BULB_COLORS[(i + side * 2) % BULB_COLORS.length]!,
        delay: (i * 0.37 + side * 0.9) % 3,
      };
    }),
  );
  const cones = [
    { ...pt(LEFT, 0.4), rot: -18 },
    { ...pt(RIGHT, 0.6), rot: 16 },
  ];
  return (
    <svg
      aria-hidden="true"
      className="mg-garland"
      viewBox="0 0 720 110"
      preserveAspectRatio="xMidYMin slice"
      focusable="false"
    >
      <defs>
        <radialGradient id={`${id}-red`} cx="35%" cy="30%" r="75%">
          <stop offset="0" stopColor="#ff9c8a" />
          <stop offset="0.35" stopColor="#c0362a" />
          <stop offset="1" stopColor="#4a0d0a" />
        </radialGradient>
        <radialGradient id={`${id}-gold`} cx="35%" cy="30%" r="75%">
          <stop offset="0" stopColor="#fff4d1" />
          <stop offset="0.4" stopColor="#e2b558" />
          <stop offset="1" stopColor="#5e3f0e" />
        </radialGradient>
        <radialGradient id={`${id}-green`} cx="35%" cy="30%" r="75%">
          <stop offset="0" stopColor="#bfe8c9" />
          <stop offset="0.4" stopColor="#2f7a52" />
          <stop offset="1" stopColor="#0b2617" />
        </radialGradient>
        <radialGradient id={`${id}-ivory`} cx="35%" cy="30%" r="75%">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.45" stopColor="#e9e1cf" />
          <stop offset="1" stopColor="#6d6250" />
        </radialGradient>
        <radialGradient id={`${id}-glow`}>
          <stop offset="0" stopColor="#ffe7a8" stopOpacity="0.9" />
          <stop offset="1" stopColor="#ffe7a8" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${id}-velvet`} x1="0" y1="0" x2="0" y2="1">
          {accent === "gold" ? (
            <>
              <stop offset="0" stopColor="#fff0c4" />
              <stop offset="0.5" stopColor="#d1a24a" />
              <stop offset="1" stopColor="#6b4610" />
            </>
          ) : (
            <>
              <stop offset="0" stopColor="#d2483a" />
              <stop offset="0.55" stopColor="#8e1d17" />
              <stop offset="1" stopColor="#4d0b08" />
            </>
          )}
        </linearGradient>
      </defs>

      {/* Sapin : brins en peigne, plusieurs épaisseurs de vert, un peu de neige */}
      <g fill="none" strokeLinecap="butt">
        <path
          d={SWAG_PATH}
          stroke="#071a10"
          strokeWidth="34"
          strokeDasharray="1.2 1.4"
          transform="translate(0 2)"
        />
        <path d={SWAG_PATH} stroke="#123a25" strokeWidth="28" strokeDasharray="1.3 1.8" />
        <path
          d={SWAG_PATH}
          stroke="#1d4a31"
          strokeWidth="23"
          strokeDasharray="1.1 2.1"
          transform="translate(1.5 -2)"
        />
        <path
          d={SWAG_PATH}
          stroke="#2a6141"
          strokeWidth="18"
          strokeDasharray="1 2.4"
          transform="translate(-1 -3)"
        />
        <path
          d={SWAG_PATH}
          stroke="#3b7a53"
          strokeWidth="12"
          strokeDasharray="0.9 3"
          transform="translate(0.5 -5)"
        />
        <path
          d={SWAG_PATH}
          stroke="#5c9a6c"
          strokeWidth="6"
          strokeDasharray="0.7 5"
          transform="translate(-1 -7)"
        />
        <path d={NEEDLES[0]} stroke="#245a3b" strokeWidth="1.6" strokeLinecap="round" />
        <path d={NEEDLES[1]} stroke="#3f8459" strokeWidth="1.3" strokeLinecap="round" />
        <path d={NEEDLES[2]} stroke="#6fae7d" strokeWidth="1" strokeLinecap="round" strokeOpacity="0.8" />
        <path
          d={SWAG_PATH}
          stroke="#f4f7fb"
          strokeOpacity="0.8"
          strokeWidth="3.4"
          strokeDasharray="0.1 7 0.1 17 0.1 11"
          strokeLinecap="round"
          transform="translate(0 -12)"
        />
      </g>

      {/* Pommes de pin */}
      {cones.map((c, i) => (
        <g key={i} transform={`translate(${c.x} ${c.y + 6}) rotate(${c.rot})`}>
          <ellipse rx="6" ry="10" fill="#5b3a1e" />
          <path
            d="M-5 -4 Q0 -1 5 -4 M-6 1 Q0 4 6 1 M-5 6 Q0 9 5 6"
            stroke="#2e1c0c"
            strokeWidth="1.4"
            fill="none"
          />
        </g>
      ))}

      {/* Boules suspendues, qui se balancent doucement */}
      {BAUBLES.map((b, i) => {
        const [x, y] = quad(b.swag.p0, b.swag.c, b.swag.p1, b.t);
        return (
          <g
            key={i}
            className="mg-bauble"
            style={{ transformOrigin: `${x}px ${y}px`, animationDelay: `${-i * 0.8}s` }}
          >
            <line x1={x} y1={y} x2={x} y2={y + b.drop} stroke="#d9b56a" strokeWidth="0.8" />
            <rect x={x - 2.6} y={y + b.drop - 1} width="5.2" height="4" rx="1" fill="#c9a24e" />
            <circle cx={x} cy={y + b.drop + 3 + b.r} r={b.r} fill={`url(#${id}-${tones[b.tone]})`} />
            <ellipse
              cx={x - b.r * 0.35}
              cy={y + b.drop + 3 + b.r * 0.6}
              rx={b.r * 0.28}
              ry={b.r * 0.18}
              fill="#fff"
              opacity="0.55"
            />
          </g>
        );
      })}

      {/* Lumières sur leur fil */}
      <path d={WIRE_PATH} fill="none" stroke="#1a140a" strokeWidth="0.9" opacity="0.8" />
      {bulbs.map((b, i) => (
        <g key={i} className="mg-light" style={{ animationDelay: `${-b.delay}s` }}>
          <circle cx={b.x} cy={b.y + 3} r="9" fill={`url(#${id}-glow)`} opacity="0.55" />
          <rect x={b.x - 1.6} y={b.y - 2.5} width="3.2" height="3" fill="#2a2214" />
          <ellipse cx={b.x} cy={b.y + 3.5} rx="2.6" ry="4" fill={b.color} />
        </g>
      ))}

      {/* Nœud de velours au centre */}
      <g transform="translate(360 18)">
        <path d="M-4 4 L-16 46 L-9 42 L-5 50 L1 6 Z" fill={`url(#${id}-velvet)`} />
        <path d="M4 4 L16 46 L9 42 L5 50 L-1 6 Z" fill={`url(#${id}-velvet)`} />
        <path d="M-2 0 C-18 -18 -38 -8 -30 4 C-24 14 -10 8 -2 2 Z" fill={`url(#${id}-velvet)`} />
        <path d="M2 0 C18 -18 38 -8 30 4 C24 14 10 8 2 2 Z" fill={`url(#${id}-velvet)`} />
        <path
          d="M-6 -2 C-16 -10 -26 -6 -24 0"
          stroke={accent === "gold" ? "#fff6dc" : "#f08a78"}
          strokeOpacity="0.5"
          strokeWidth="1.2"
          fill="none"
        />
        <path
          d="M6 -2 C16 -10 26 -6 24 0"
          stroke={accent === "gold" ? "#fff6dc" : "#f08a78"}
          strokeOpacity="0.5"
          strokeWidth="1.2"
          fill="none"
        />
        <rect
          x="-6"
          y="-5"
          width="12"
          height="11"
          rx="3"
          fill={accent === "gold" ? "#b8862f" : "#a3281e"}
          stroke="#e8c170"
          strokeWidth="1"
        />
        <Holly x={0} y={-6} scale={0.8} />
      </g>
    </svg>
  );
}

function pt(s: typeof LEFT, t: number) {
  const [x, y] = quad(s.p0, s.c, s.p1, t);
  return { x, y };
}

/** Brin de houx : deux feuilles, trois baies. */
function Holly({ x, y, scale = 1 }: { x: number; y: number; scale?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      <path
        d="M0 0 C-6 -3 -10 -2 -14 -6 C-13 -2 -16 0 -19 0 C-16 2 -15 5 -16 8 C-12 5 -8 6 0 2 Z"
        fill="#2c6b45"
        stroke="#173d27"
        strokeWidth="0.8"
      />
      <path
        d="M0 0 C6 -3 10 -2 14 -6 C13 -2 16 0 19 0 C16 2 15 5 16 8 C12 5 8 6 0 2 Z"
        fill="#357a50"
        stroke="#173d27"
        strokeWidth="0.8"
      />
      <circle cx="-2.6" cy="1.5" r="2.8" fill="#c42b22" />
      <circle cx="2.6" cy="1.5" r="2.8" fill="#d6372b" />
      <circle cx="0" cy="-1.8" r="2.8" fill="#b4241c" />
      <circle cx="-0.8" cy="-2.6" r="0.8" fill="#fff" opacity="0.6" />
    </g>
  );
}

/** Ornement sous un titre : filets dorés, volutes, houx au centre. */
export function Flourish({ className = "" }: { className?: string }) {
  return (
    <svg aria-hidden="true" focusable="false" className={`mg-flourish ${className}`} viewBox="0 0 220 22">
      <g fill="none" stroke="#d4ae63" strokeWidth="1" strokeLinecap="round">
        <path d="M4 11 H78 C86 11 88 4 82 4 C77 4 78 10 84 11" />
        <path d="M216 11 H142 C134 11 132 4 138 4 C143 4 142 10 136 11" />
        <path d="M30 14 H70" strokeOpacity="0.5" />
        <path d="M150 14 H190" strokeOpacity="0.5" />
      </g>
      <circle cx="4" cy="11" r="1.6" fill="#d4ae63" />
      <circle cx="216" cy="11" r="1.6" fill="#d4ae63" />
      <Holly x={110} y={11} scale={0.85} />
    </svg>
  );
}

/** Brin de houx épinglé en haut d'un panneau repliable. */
export function HollyPin() {
  return (
    <svg aria-hidden="true" focusable="false" className="mg-holly-pin" viewBox="-24 -14 48 28">
      <Holly x={0} y={0} scale={1} />
    </svg>
  );
}
