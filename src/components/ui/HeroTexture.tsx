/**
 * Texture d'un héros en vraie image (et non en fond CSS) : le navigateur la demande dès
 * la lecture du HTML, sans attendre les feuilles de style. C'est souvent le plus grand
 * élément affiché (LCP). La classe `tex-*` du parent garde la couleur de repli.
 */
export function HeroTexture({ images }: { images: { desktop: string; mobile: string } }) {
  return (
    <picture>
      <source media="(min-width: 640px)" srcSet={images.desktop} />
      <img
        src={images.mobile}
        alt=""
        aria-hidden="true"
        fetchPriority="high"
        className="pointer-events-none absolute inset-0 size-full object-cover"
      />
    </picture>
  );
}
