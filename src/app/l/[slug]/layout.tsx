import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { getListBySlug } from "@/server/db/lists";

// La liste est lue avant tout streaming : vrai 404 et vraie redirection 308.
export const instant = false;

async function resolveList(slug: string) {
  const lookup = await getListBySlug(slug);
  if (lookup.kind === "redirect") permanentRedirect(`/l/${lookup.slug}`);
  if (lookup.kind === "missing") notFound();
  return lookup.list;
}

export async function generateMetadata({ params }: LayoutProps<"/l/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const lookup = await getListBySlug(slug);
  if (lookup.kind !== "found") return {};
  const { list } = lookup;
  const description = list.description ?? `La liste de ${list.ownerName}`;
  return {
    // `absolute` + `template` : la fiche hérite du suffixe « · Envies ».
    title: {
      absolute: `${list.title} · liste de ${list.ownerName} · Envies`,
      template: "%s · Envies",
    },
    description,
    alternates: { canonical: `/l/${list.slug}` },
    // Aperçu dans les messageries ; l'image vient de `opengraph-image.tsx`.
    openGraph: {
      title: `${list.title} · liste de ${list.ownerName}`,
      description,
      url: `/l/${list.slug}`,
      siteName: "Envies",
      locale: "fr_FR",
      type: "website",
    },
  };
}

export default async function ListLayout({ children, modal, params }: LayoutProps<"/l/[slug]">) {
  const { slug } = await params;
  await resolveList(slug);
  return (
    <>
      {children}
      {modal}
    </>
  );
}
