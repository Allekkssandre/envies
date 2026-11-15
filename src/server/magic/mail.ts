import "server-only";
import type { Role } from "@/lib/magic/engine";
import { CAMP_LABEL, clueText, endText, formatMoment, gazetteLines } from "@/lib/magic/texts";
import type { Gazette } from "@/lib/magic/types";
import type { Mail } from "@/server/santa/mail";

// Mails de La Magie de Noël. Jamais de rôle ni de secret personnel : seulement ce que la
// gazette dit à tout le monde, et le lien personnel vers le jeu.

const escape = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

const NO_LINK = "Ouvrez le lien reçu pour le Secret Santa, puis « Entrer dans le jeu ».";

type Block = { kind: "p" | "clue" | "small"; text: string };

function layout(opts: {
  to: string;
  toName: string;
  subject: string;
  kicker: string;
  heading: string;
  blocks: Block[];
  url: string | null;
  cta: string;
}): Mail {
  const text = [
    `Bonjour ${opts.toName},`,
    "",
    ...opts.blocks.flatMap((b) => [b.kind === "clue" ? `Indice : ${b.text}` : b.text, ""]),
    opts.url ? `${opts.cta} : ${opts.url}` : NO_LINK,
    "",
    "Ce lien est personnel. Ne le transférez pas.",
  ].join("\n");
  const body = opts.blocks
    .map((b) =>
      b.kind === "clue"
        ? `<p style="margin:0 0 18px;padding:14px 18px;border:1px solid #6B5A2E;border-radius:14px;background:#1A2740;color:#F3D9A0;font-size:16px;line-height:1.5"><span style="display:block;font-family:Arial,sans-serif;font-size:11px;letter-spacing:.2em;text-transform:uppercase;color:#C9A55C;margin-bottom:4px">Indice</span>${escape(b.text)}</p>`
        : b.kind === "small"
          ? `<p style="margin:0 0 14px;font-family:Arial,sans-serif;font-size:13px;line-height:1.5;color:#A9B4C8">${escape(b.text)}</p>`
          : `<p style="margin:0 0 14px;font-size:17px;line-height:1.55;color:#EEF1F7">${escape(b.text)}</p>`,
    )
    .join("");
  const cta = opts.url
    ? `<p style="margin:26px 0 8px"><a href="${escape(opts.url)}" style="display:inline-block;background:#E8C170;color:#141D30;text-decoration:none;font-family:Arial,sans-serif;font-weight:700;font-size:16px;padding:14px 28px;border-radius:999px">${escape(opts.cta)}</a></p>`
    : `<p style="margin:22px 0 8px;font-family:Arial,sans-serif;font-size:14px;color:#A9B4C8">${escape(NO_LINK)}</p>`;
  const html = `<!doctype html><html lang="fr"><body style="margin:0;background:#0E1626;font-family:Georgia,serif">
<div style="max-width:540px;margin:0 auto;padding:40px 24px;color:#EEF1F7">
<p style="font-family:Arial,sans-serif;font-size:12px;letter-spacing:.22em;text-transform:uppercase;color:#C9A55C;margin:0 0 10px">${escape(opts.kicker)}</p>
<h1 style="font-weight:400;font-size:32px;line-height:1.12;margin:0 0 24px;color:#F7E7C1">${escape(opts.heading)}</h1>
<p style="margin:0 0 14px;font-size:17px;line-height:1.55;color:#EEF1F7">Bonjour ${escape(opts.toName)},</p>
${body}${cta}
<p style="font-family:Arial,sans-serif;font-size:12px;color:#7D8AA3;margin:30px 0 0">Ce lien est personnel. Ne le transférez pas. Si ce mail est arrivé dans les indésirables, marquez-le comme « non spam » pour recevoir la gazette chaque semaine.</p>
</div></body></html>`;
  return { to: opts.to, toName: opts.toName, subject: opts.subject, text, html };
}

export function openingMail(
  to: string,
  firstName: string,
  c: { title: string; url: string | null; startsAt: string; gazette: Gazette },
): Mail {
  const started = new Date(c.startsAt).getTime() <= Date.now();
  return layout({
    to,
    toName: firstName,
    subject: "La Magie de Noël : votre rôle vous attend",
    kicker: c.title,
    heading: "La Magie de Noël commence",
    blocks: [
      {
        kind: "p",
        text: "Un jeu se joue en parallèle du Secret Santa. Environ un joueur sur quatre est un Grinch, tiré au sort. Les autres sont Pères Noël.",
      },
      {
        kind: "p",
        text: started
          ? "Chaque semaine, vous pouvez désigner la personne que vous soupçonnez. Un clic, et c'est facultatif."
          : `À partir du ${formatMoment(c.startsAt)}, vous pourrez chaque semaine désigner la personne que vous soupçonnez. Un clic, et c'est facultatif.`,
      },
      ...(c.gazette.clue ? [{ kind: "clue" as const, text: clueText(c.gazette.clue) }] : []),
    ],
    url: c.url,
    cta: "Découvrir mon rôle",
  });
}

export function gazetteMail(
  to: string,
  firstName: string,
  c: { title: string; url: string | null; gazette: Gazette },
): Mail {
  const { title, lines } = gazetteLines(c.gazette);
  const end = endText(c.gazette);
  return layout({
    to,
    toName: firstName,
    subject: end ? "La Magie de Noël : fin de partie" : `La Gazette du Pôle Nord, ${title.toLowerCase()}`,
    kicker: `${c.title} · ${title}`,
    heading: end ?? "La Gazette du Pôle Nord",
    blocks: [
      ...lines.map((text) => ({ kind: "p" as const, text })),
      ...(c.gazette.clue ? [{ kind: "clue" as const, text: clueText(c.gazette.clue) }] : []),
      ...(c.gazette.votes.length
        ? [{ kind: "small" as const, text: "Qui a désigné qui : à lire dans le jeu." }]
        : []),
    ],
    url: c.url,
    cta: end ? "Voir la fin de partie" : "Désigner un suspect",
  });
}

export function revealMail(
  to: string,
  firstName: string,
  c: { title: string; url: string | null; winner: Role | null },
): Mail {
  return layout({
    to,
    toName: firstName,
    subject: "La Magie de Noël : les rôles sont révélés",
    kicker: c.title,
    heading: "Les masques tombent",
    blocks: [
      {
        kind: "p",
        text: c.winner
          ? `Victoire pour ${CAMP_LABEL[c.winner]}. Découvrez qui était qui, et qui a eu le meilleur flair.`
          : "Découvrez qui était qui, et qui a eu le meilleur flair.",
      },
    ],
    url: c.url,
    cta: "Voir les rôles",
  });
}
