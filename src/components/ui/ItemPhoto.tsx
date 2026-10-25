import { cn } from "@/lib/cn";

type ItemPhotoProps = {
  /** Nom de l'article : sert d'`alt` et d'initiale de repli. */
  name: string;
  /** URL 480 px et 1200 px. Sans photo : dégradé lin + initiale. */
  src480?: string | null;
  src1200?: string | null;
  width?: number | null;
  height?: number | null;
  /** Image sur fond clair : `contain` + `multiply`, fondue dans le fond studio. */
  lightBackground?: boolean;
  sizes?: string;
  className?: string;
  /** Taille de l'initiale, en px. */
  initialSize?: number;
  children?: React.ReactNode;
};

/** Photo d'article sur fond studio, avec repli sur l'initiale. */
export function ItemPhoto({
  name,
  src480,
  src1200,
  width,
  height,
  lightBackground = false,
  sizes = "(max-width: 639px) 50vw, 320px",
  className,
  initialSize = 90,
  children,
}: ItemPhotoProps) {
  if (!src480) {
    const initial = name.trim().charAt(0).toLocaleUpperCase("fr-FR") || "?";
    return (
      <span
        className={cn(
          "relative flex items-center justify-center overflow-hidden rounded-photo tex-initial",
          className,
        )}
      >
        <span
          aria-hidden="true"
          className="font-display leading-none font-light text-ochre/55 italic"
          style={{ fontSize: initialSize }}
        >
          {initial}
        </span>
        {children}
      </span>
    );
  }

  return (
    <span className={cn("relative block overflow-hidden rounded-photo shadow-photo tex-studio", className)}>
      {/* Photos déjà en WebP 480/1200 : pas d'optimisation next/image (docs/10). */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src480}
        srcSet={src1200 ? `${src480} 480w, ${src1200} 1200w` : undefined}
        sizes={sizes}
        alt={name}
        width={width ?? undefined}
        height={height ?? undefined}
        loading="lazy"
        decoding="async"
        className={cn(
          "absolute inset-0 size-full",
          lightBackground ? "object-contain p-[8%] mix-blend-multiply" : "object-cover",
        )}
      />
      {children}
    </span>
  );
}
