import { cn } from "@/lib/cn";

/** Feuille au trait (symbole `leaf` des maquettes), viewBox 100 × 40. */
function Leaf({ x, y, angle, w }: { x: number; y: number; angle: number; w: number }) {
  const h = w * 0.4;
  return (
    <g transform={`translate(${x} ${y}) rotate(${angle})`}>
      <svg x={0} y={-h / 2} width={w} height={h} viewBox="0 0 100 40" overflow="visible">
        <path d="M2 20 C 22 2, 62 0, 98 20 C 62 40, 22 38, 2 20 Z" />
        <path d="M2 20 L 92 20" />
        <path d="M30 20 L 42 11 M50 20 L 62 10 M30 20 L 42 29 M50 20 L 62 30" />
      </svg>
    </g>
  );
}

const LEAVES = [
  { x: 318, y: 60, angle: 200, w: 110 },
  { x: 316, y: 120, angle: -20, w: 100 },
  { x: 320, y: 200, angle: 170, w: 120 },
  { x: 312, y: 270, angle: 10, w: 104 },
  { x: 288, y: 360, angle: 190, w: 124 },
  { x: 270, y: 440, angle: -30, w: 96 },
  { x: 238, y: 540, angle: 160, w: 112 },
  { x: 228, y: 620, angle: 25, w: 98 },
];

/** Tige et 8 feuilles au trait lin, posées sur les héros sombres. Décoratif. */
export function Foliage({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 420 760"
      className={cn(
        "pointer-events-none absolute fill-none stroke-linen [stroke-width:1.2] opacity-55 [stroke-linecap:round] [stroke-linejoin:round]",
        className,
      )}
    >
      <path d="M330 0 C 280 150, 350 290, 270 450 S 210 650, 250 760" />
      {LEAVES.map((leaf) => (
        <Leaf key={`${leaf.x}-${leaf.y}`} {...leaf} />
      ))}
    </svg>
  );
}

type HaloProps = {
  tone: "ochre" | "olive";
  className?: string;
  /** Opacité du centre (ocre .2–.3, olive .14–.16). */
  strength?: number;
};

/** Disque de lumière radial en fond de page. Jamais au-dessus du texte. */
export function Halo({ tone, className, strength }: HaloProps) {
  const rgb = tone === "ochre" ? "214 160 70" : "87 97 44";
  const a = strength ?? (tone === "ochre" ? 0.22 : 0.15);
  return (
    <div
      aria-hidden="true"
      className={cn("pointer-events-none absolute -z-10 size-[900px] rounded-full", className)}
      style={{ background: `radial-gradient(closest-side, rgb(${rgb} / ${a}), rgb(${rgb} / 0))` }}
    />
  );
}
