/**
 * URL publique du site (OpenGraph, liens absolus). Production : `NEXT_PUBLIC_SITE_URL` ;
 * preview Vercel : `https://${VERCEL_URL}` ; local : localhost.
 */
export function siteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (explicit) return explicit.replace(/\/+$/, "");
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return `http://localhost:${process.env.PORT ?? 3000}`;
}
