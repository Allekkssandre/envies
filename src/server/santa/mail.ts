import "server-only";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

// Envoi des mails du Secret Santa (docs/13-secret-santa.md § Mails).
// Production : API transactionnelle de Brevo (BREVO_API_KEY, SANTA_MAIL_FROM).
// Tests : SANTA_MAIL_DIR, chaque mail écrit en JSON dans ce dossier (jamais sur Vercel).

export type Mail = { to: string; toName: string; subject: string; text: string; html: string };
export type MailResult = { ok: true } | { ok: false; error: string };

const BREVO_URL = "https://api.brevo.com/v3/smtp/email";
const TIMEOUT_MS = 10_000;

function testDir(): string | null {
  const dir = process.env.SANTA_MAIL_DIR;
  return dir && !process.env.VERCEL ? dir : null;
}

/** Un moyen d'envoi est configuré. */
export function mailConfigured(): boolean {
  return Boolean(testDir() || (process.env.BREVO_API_KEY && process.env.SANTA_MAIL_FROM));
}

export async function sendMail(mail: Mail): Promise<MailResult> {
  const dir = testDir();
  if (dir) {
    await mkdir(dir, { recursive: true });
    const name = `${Date.now()}-${mail.to.replace(/[^a-z0-9]/gi, "_")}.json`;
    await writeFile(path.join(dir, name), JSON.stringify(mail, null, 2));
    return { ok: true };
  }
  const apiKey = process.env.BREVO_API_KEY;
  const from = process.env.SANTA_MAIL_FROM;
  if (!apiKey || !from) return { ok: false, error: "non configuré" };
  try {
    const res = await fetch(BREVO_URL, {
      method: "POST",
      headers: { "api-key": apiKey, "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        sender: { email: from, name: process.env.SANTA_MAIL_FROM_NAME || "Secret Santa · Envies" },
        replyTo: { email: process.env.SANTA_MAIL_REPLY_TO || from },
        to: [{ email: mail.to, name: mail.toName }],
        subject: mail.subject,
        textContent: mail.text,
        htmlContent: mail.html,
        // Pas de suivi : le lien personnel n'est pas réécrit par le service d'envoi.
        headers: { "X-Mailin-Track": "0", "X-Mailin-Track-Clicks": "0", "X-Mailin-Track-Opens": "0" },
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (res.ok) return { ok: true };
    const detail = await res.text().catch(() => "");
    return { ok: false, error: `${res.status} ${detail.slice(0, 200)}` };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "réseau" };
  }
}

const escape = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export type InviteContent = {
  firstName: string;
  title: string;
  url: string;
  message: string | null;
  budget: string | null;
  exchangeDate: string | null;
  /** La Magie de Noël, ouverte en même temps que le tirage : un seul mail pour les deux. */
  game?: {
    url: string;
    /** « lundi 1 décembre à 09:00 » */
    when: string;
    started: boolean;
    clue: string | null;
  } | null;
};

const GAME_INTRO =
  "Le sort a aussi désigné en secret quelques Krampus parmi les participants, environ un sur quatre. Chaque semaine où ils restent cachés, ils éteignent un peu de la Magie de Noël. Tous les autres sont des Pères Noël : à eux de découvrir qui sont les Krampus.";

function gameLines(g: NonNullable<InviteContent["game"]>): string[] {
  return [
    g.started
      ? "Votre rôle vous attend, face cachée. Chaque semaine, vous pouvez désigner la personne que vous soupçonnez d'être un Krampus. Un clic suffit, et rien n'est obligatoire."
      : `Votre rôle vous attend, face cachée. À partir du ${g.when}, vous pourrez chaque semaine désigner la personne que vous soupçonnez d'être un Krampus. Un clic suffit, et rien n'est obligatoire.`,
    "Une gazette arrive par mail à la fin de chaque semaine. Si ce mail est arrivé dans les indésirables, marquez-le comme « non spam » pour la recevoir.",
  ];
}

/** Mail d'invitation : le lien personnel, et rien du tirage lui-même, ni du rôle. */
export function inviteMail(to: string, toName: string, c: InviteContent): Mail {
  const details = [
    c.budget ? `Budget : ${c.budget}` : null,
    c.exchangeDate ? `Échange des cadeaux : ${c.exchangeDate}` : null,
  ].filter((x): x is string => Boolean(x));
  const g = c.game ?? null;
  const subject = g ? `Secret Santa et Magie de Noël : ${c.title}` : `Secret Santa : ${c.title}`;
  const text = [
    `Bonjour ${c.firstName},`,
    "",
    `Le tirage au sort de « ${c.title} » est fait.`,
    "Découvrez à qui vous offrez un cadeau, et votre thème :",
    c.url,
    "",
    ...(c.message ? [c.message, ""] : []),
    ...(details.length ? [...details, ""] : []),
    ...(g
      ? [
          "Cette année, un jeu en plus : La Magie de Noël.",
          "",
          GAME_INTRO,
          "",
          ...gameLines(g).flatMap((l) => [l, ""]),
          ...(g.clue ? [`Premier indice : ${g.clue}`, ""] : []),
          "Découvrir mon rôle :",
          g.url,
          "",
        ]
      : []),
    "Ce lien est personnel. Ne le transférez pas.",
  ].join("\n");
  const gameHtml = g
    ? `<div style="margin:32px 0 0;padding:28px 24px;border-radius:22px;background:#0E1626;background-image:linear-gradient(180deg,#14213A,#0B1322);color:#EEF1F7">
<p style="font-family:Arial,sans-serif;font-size:12px;letter-spacing:.22em;text-transform:uppercase;color:#C9A55C;margin:0 0 10px">Cette année, un jeu en plus</p>
<h2 style="font-weight:400;font-size:28px;line-height:1.12;margin:0 0 18px;color:#F7E7C1">La Magie de Noël</h2>
<p style="font-size:16px;line-height:1.55;margin:0 0 14px;color:#EEF1F7">${escape(GAME_INTRO)}</p>
${gameLines(g)
  .map((l, i) =>
    i === 0
      ? `<p style="font-size:16px;line-height:1.55;margin:0 0 14px;color:#EEF1F7">${escape(l)}</p>`
      : `<p style="font-family:Arial,sans-serif;font-size:13px;line-height:1.5;margin:0 0 14px;color:#A9B4C8">${escape(l)}</p>`,
  )
  .join("")}
${g.clue ? `<p style="margin:0 0 18px;padding:14px 18px;border:1px solid #6B5A2E;border-radius:14px;background:#1A2740;color:#F3D9A0;font-size:16px;line-height:1.5"><span style="display:block;font-family:Arial,sans-serif;font-size:11px;letter-spacing:.2em;text-transform:uppercase;color:#C9A55C;margin-bottom:4px">Premier indice</span>${escape(g.clue)}</p>` : ""}
<p style="margin:8px 0 0"><a href="${escape(g.url)}" style="display:inline-block;background:#E8C170;color:#141D30;text-decoration:none;font-family:Arial,sans-serif;font-weight:700;font-size:16px;padding:14px 28px;border-radius:999px">Découvrir mon rôle</a></p>
</div>`
    : "";
  const html = `<!doctype html><html lang="fr"><body style="margin:0;background:#F3EBDD;font-family:Georgia,serif;color:#2B2416">
<div style="max-width:520px;margin:0 auto;padding:40px 24px">
<p style="font-size:13px;letter-spacing:.18em;text-transform:uppercase;color:#7A6A4E;margin:0 0 12px">Secret Santa</p>
<h1 style="font-weight:400;font-size:34px;line-height:1.1;margin:0 0 24px">${escape(c.title)}</h1>
<p style="font-size:17px;line-height:1.5;margin:0 0 8px">Bonjour ${escape(c.firstName)},</p>
<p style="font-size:17px;line-height:1.5;margin:0 0 28px">Le tirage au sort est fait. Découvrez à qui vous offrez un cadeau, et votre thème.</p>
<p style="margin:0 0 28px"><a href="${escape(c.url)}" style="display:inline-block;background:#2B2416;color:#F7F1E6;text-decoration:none;font-family:Arial,sans-serif;font-weight:600;font-size:16px;padding:14px 26px;border-radius:999px">Découvrir mon tirage</a></p>
${c.message ? `<p style="font-size:16px;line-height:1.5;font-style:italic;margin:0 0 20px">${escape(c.message).replace(/\n/g, "<br>")}</p>` : ""}
${details.map((d) => `<p style="font-size:15px;margin:0 0 6px;color:#4A3F2C">${escape(d)}</p>`).join("")}
${gameHtml}
<p style="font-size:13px;color:#7A6A4E;margin:28px 0 0;font-family:Arial,sans-serif">Ce lien est personnel. Ne le transférez pas.</p>
</div></body></html>`;
  return { to, toName, subject, text, html };
}
