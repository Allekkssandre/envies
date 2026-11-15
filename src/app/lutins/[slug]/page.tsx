import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { OrganizerBoard } from "@/components/santa/OrganizerBoard";
import { SantaShell } from "@/components/santa/SantaShell";
import { SantaUnlock } from "@/components/santa/SantaUnlock";
import { siteUrl } from "@/lib/siteUrl";
import { getServiceDb } from "@/server/db/client";
import { getSantaBySlug, loadOrganizerView } from "@/server/santa/db";
import { hasOrganizerAccess } from "@/server/santa/session";

export const metadata: Metadata = {
  title: "Organisation du Secret Santa",
  robots: { index: false, follow: false },
};

export default function OrganizerPage({ params }: PageProps<"/lutins/[slug]">) {
  return (
    <SantaShell wide>
      <Suspense fallback={<div className="relative h-80" aria-hidden="true" />}>
        <Organizer params={params} />
      </Suspense>
    </SantaShell>
  );
}

async function Organizer({ params }: Pick<PageProps<"/lutins/[slug]">, "params">) {
  const { slug } = await params;
  const santa = await getSantaBySlug(slug);
  if (!santa) notFound();
  if (!(await hasOrganizerAccess(santa.id))) return <SantaUnlock santaId={santa.id} title={santa.title} />;
  const [view, { data: secret }] = await Promise.all([
    loadOrganizerView(santa),
    getServiceDb().from("santa_secrets").select("edit_key").eq("santa_id", santa.id).single(),
  ]);
  const organizerUrl = `${siteUrl()}/lutins/${santa.slug}#cle=${secret?.edit_key ?? ""}`;
  return <OrganizerBoard view={view} organizerUrl={organizerUrl} />;
}
