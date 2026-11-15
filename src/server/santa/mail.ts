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
};

/** Mail d'invitation : le lien personnel, et rien du tirage lui-même. */
export function inviteMail(to: string, toName: string, c: InviteContent): Mail {
  const details = [
    c.budget ? `Budget : ${c.budget}` : null,
    c.exchangeDate ? `Échange des cadeaux : ${c.exchangeDate}` : null,
  ].filter((x): x is string => Boolean(x));
  const subject = `Secret Santa : ${c.title}`;
  const text = [
    `Bonjour ${c.firstName},`,
    "",
    `Le tirage au sort de « ${c.title} » est fait.`,
    "Découvrez à qui vous offrez un cadeau, et votre thème :",
    c.url,
    "",
    ...(c.message ? [c.message, ""] : []),
    ...(details.length ? [...details, ""] : []),
    "Ce lien est personnel. Ne le transférez pas.",
  ].join("\n");
  const html = `<!doctype html><html lang="fr"><body style="margin:0;background:#F3EBDD;font-family:Georgia,serif;color:#2B2416">
<div style="max-width:520px;margin:0 auto;padding:40px 24px">
<p style="font-size:13px;letter-spacing:.18em;text-transform:uppercase;color:#7A6A4E;margin:0 0 12px">Secret Santa</p>
<h1 style="font-weight:400;font-size:34px;line-height:1.1;margin:0 0 24px">${escape(c.title)}</h1>
<p style="font-size:17px;line-height:1.5;margin:0 0 8px">Bonjour ${escape(c.firstName)},</p>
<p style="font-size:17px;line-height:1.5;margin:0 0 28px">Le tirage au sort est fait. Découvrez à qui vous offrez un cadeau, et votre thème.</p>
<p style="margin:0 0 28px"><a href="${escape(c.url)}" style="display:inline-block;background:#2B2416;color:#F7F1E6;text-decoration:none;font-family:Arial,sans-serif;font-weight:600;font-size:16px;padding:14px 26px;border-radius:999px">Découvrir mon tirage</a></p>
${c.message ? `<p style="font-size:16px;line-height:1.5;font-style:italic;margin:0 0 20px">${escape(c.message).replace(/\n/g, "<br>")}</p>` : ""}
${details.map((d) => `<p style="font-size:15px;margin:0 0 6px;color:#4A3F2C">${escape(d)}</p>`).join("")}
<p style="font-size:13px;color:#7A6A4E;margin:28px 0 0;font-family:Arial,sans-serif">Ce lien est personnel. Ne le transférez pas.</p>
</div></body></html>`;
  return { to, toName, subject, text, html };
}
