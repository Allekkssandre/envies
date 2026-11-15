import { expect, test, type Page } from "@playwright/test";
import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { skipWithoutDb } from "./helpers";

// Secret Santa de bout en bout : création, tirage, mails (écrits en fichiers), pages des lutins.
skipWithoutDb();
if (existsSync(".env.local")) process.loadEnvFile(".env.local");
const MAIL_DIR = process.env.SANTA_MAIL_DIR ?? "";
test.skip(!MAIL_DIR, "SANTA_MAIL_DIR requis");

type Mail = { to: string; subject: string; text: string };

/** Dernier mail reçu par chaque adresse (attend qu'ils soient tous écrits). */
async function lastMails(emails: string[]): Promise<Map<string, Mail>> {
  const found = new Map<string, Mail>();
  await expect
    .poll(
      async () => {
        found.clear();
        const files = existsSync(MAIL_DIR) ? (await readdir(MAIL_DIR)).sort() : [];
        for (const file of files) {
          const mail = JSON.parse(await readFile(path.join(MAIL_DIR, file), "utf8")) as Mail;
          if (emails.includes(mail.to)) found.set(mail.to, mail);
        }
        return found.size;
      },
      { timeout: 20_000 },
    )
    .toBe(emails.length);
  return found;
}

const linkOf = (mail: Mail) => new URL(/https?:\/\/\S+\/lutins\/moi\/\S+/.exec(mail.text)![0]).pathname;

async function fillParticipant(page: Page, n: number, first: string, last: string, email: string) {
  await page.getByLabel(`Prénom du participant ${n}`).fill(first);
  await page.getByLabel(`Nom du participant ${n}`).fill(last);
  await page.getByLabel(`Adresse mail du participant ${n}`).fill(email);
}

test("Secret Santa : tirage unique, secret pour l'organisation, fiche et liste d'idées", async ({
  page,
}, info) => {
  test.setTimeout(120_000);
  const run = `${info.project.name}-${Date.now()}`;
  const people = ["Alice", "Basile", "Chloé"].map((first, i) => ({
    first,
    last: `Test${i + 1}`,
    email: `lutin${i + 1}-${run}@exemple.test`,
  }));

  // Création
  await page.goto("/lutins");
  await page.getByLabel("Nom du Secret Santa").fill(`Test e2e santa ${run}`);
  await page.getByLabel("Mot de passe de l'organisation").fill("bouleau");
  await page.getByRole("button", { name: "Créer le Secret Santa" }).click();
  await expect(page.getByRole("heading", { level: 1, name: `Test e2e santa ${run}` })).toBeVisible({
    timeout: 15_000,
  });
  const organizerUrl = page.url();

  // Préparation : 3 thèmes, 3 participants
  await page.getByRole("textbox", { name: /^\d+ thèmes?$/ }).fill("Cuisine\nLecture\nMusique");
  for (const [i, p] of people.entries()) await fillParticipant(page, i + 1, p.first, p.last, p.email);
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.getByRole("button", { name: "Enregistré" })).toBeVisible();

  // Lancement
  await page.getByRole("button", { name: "Lancer le tirage" }).click();
  await page.getByRole("button", { name: "Lancer et envoyer les mails" }).click();
  await expect(page.getByText("Tirage vérifié")).toBeVisible({ timeout: 20_000 });
  // L'organisation ne voit aucun thème associé à une personne, ni aucun « offre à ».
  await expect(page.getByText(/offre à/)).toHaveCount(0);

  // Chaque lutin ouvre son lien
  const mails = await lastMails(people.map((p) => p.email));
  const seen: { me: string; target: string; theme: string; path: string }[] = [];
  for (const p of people) {
    const mail = mails.get(p.email)!;
    expect(mail.subject).toContain(`Test e2e santa ${run}`);
    // Le mail ne contient pas le tirage.
    for (const other of people) expect(mail.text).not.toContain(other.last);
    const linkPath = linkOf(mail);
    await page.goto(linkPath);
    const heading = page.getByRole("heading", { level: 1 });
    await expect(heading).toBeVisible();
    const target = (await heading.textContent())!.replace(/\s+/g, " ").trim();
    const theme = (await page.getByText("Votre thème").locator("..").textContent())!
      .replace("Votre thème", "")
      .trim();
    seen.push({ me: `${p.first} ${p.last}`, target, theme, path: linkPath });
  }
  for (const s of seen) expect(s.target).not.toBe(s.me);
  expect(new Set(seen.map((s) => s.target)).size).toBe(3);
  expect(new Set(seen.map((s) => s.theme)).size).toBe(3);
  for (const s of seen) expect(["Cuisine", "Lecture", "Musique"]).toContain(s.theme);

  // Alice confirme, remplit sa fiche et crée sa liste d'idées
  const alice = seen.find((s) => s.me.startsWith("Alice"))!;
  await page.goto(alice.path);
  await page.getByRole("button", { name: "J'ai bien noté" }).click();
  await expect(page.getByText("C'est noté. Gardez le secret.")).toBeVisible();
  await page.getByLabel("Pointure").fill("39");
  await page.getByRole("button", { name: "Enregistrer ma fiche" }).click();
  await expect(page.getByRole("button", { name: "Enregistré" })).toBeVisible();
  await page.getByRole("button", { name: "Créer ma liste d'idées" }).click();
  await expect(page).toHaveURL(/\/l\/idees-alice-[a-z0-9]+\/edition/, { timeout: 15_000 });
  await expect(page.getByText("Mode édition")).toBeVisible();

  // Son Santa voit sa fiche et sa liste
  const santaOfAlice = seen.find((s) => s.target.startsWith("Alice"))!;
  await page.goto(santaOfAlice.path);
  await expect(page.getByText("39", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Voir sa liste d'idées" }).click();
  await expect(page).toHaveURL(/\/l\/idees-alice-/, { timeout: 15_000 });
  await expect(page.getByRole("heading", { level: 1, name: /Mes idées/ })).toBeVisible();

  // L'organisation voit la confirmation, et toujours aucun tirage
  await page.goto(organizerUrl);
  await expect(page.getByText("1 sur 3 ont confirmé avoir vu leur tirage.")).toBeVisible();
  await expect(page.getByText("Tirage vérifié")).toBeVisible();
  for (const s of seen) await expect(page.getByText(s.theme, { exact: true })).toHaveCount(1);
});
