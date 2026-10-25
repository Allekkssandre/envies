/** URL publique d'une image d'article dans le bucket `item-images`. */
export function imageUrl(path: string, size: 480 | 1200): string {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  return `${base}/storage/v1/object/public/item-images/${path}-${size}.webp`;
}
