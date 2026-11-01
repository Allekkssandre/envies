import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { formatPrice } from "@/lib/format";
import { ItemSheet } from "@/components/item/ItemSheet";
import { ListView } from "@/components/list/ListView";
import { loadListPage } from "@/server/db/listPage";
import { itemName } from "@/types/models";

export async function generateMetadata({ params }: PageProps<"/l/[slug]/a/[ref]">): Promise<Metadata> {
  const { slug, ref } = await params;
  const { list, content } = await loadListPage(slug);
  const item = content.items.find((i) => i.ref === ref);
  if (!item) return {};
  const name = itemName(item);
  const price =
    item.priceCents !== null ? formatPrice(item.priceCents, item.currency ?? list.currency) : null;
  const description = [price, `Dans « ${list.title} », la liste de ${list.ownerName}`]
    .filter(Boolean)
    .join(" · ");
  return {
    title: `${name} · ${list.title}`,
    description,
    alternates: { canonical: `/l/${list.slug}/a/${item.ref}` },
    openGraph: {
      title: name,
      description,
      url: `/l/${list.slug}/a/${item.ref}`,
      siteName: "Envies",
      locale: "fr_FR",
      type: "website",
    },
  };
}

/** Lien direct vers une fiche : la liste en fond, la fiche ouverte par-dessus. */
export default async function ItemPage({ params }: PageProps<"/l/[slug]/a/[ref]">) {
  const { slug, ref } = await params;
  const { list, content } = await loadListPage(slug);
  if (!content.items.some((i) => i.ref === ref)) notFound();
  return (
    <>
      <ListView list={list} content={content} />
      <ItemSheet list={list} content={content} itemRef={ref} mode="page" />
    </>
  );
}
