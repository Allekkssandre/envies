import { expect, test, type Page } from "@playwright/test";
import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { db, skipWithoutDb } from "./helpers";

// La Magie de Noël de bout en bout : 12 joueurs, choix des camps, vote, gazette,
// identification, cinq manches, révélation.
skipWithoutDb();
if (existsSync(".env.local")) process.loadEnvFile(".env.local");
const MAIL_DIR = process.env.SANTA_MAIL_DIR ?? "";
test.skip(!MAIL_DIR, "SANTA_MAIL_DIR requis");

type Mail = { to: string; text: string };

async function links(emails: string[]): Promise<string[]> {
  const found = new Map<string, string>();
  await expect
    .poll(
      async () => {
        const files = existsSync(MAIL_DIR) ? (await readdir(MAIL_DIR)).sort() : [];
        for (const file of files) {
          const mail = JSON.parse(await readFile(path.join(MAIL_DIR, file), "utf8")) as Mail;
          const link = /https?:\/\/\S+\/lutins\/moi\/\S+/.exec(mail.text)?.[0];
          if (emails.includes(mail.to) && link) found.set(mail.to, new URL(link).pathname);
        }
        return found.size;
      },
      { timeout: 30_000 },
    )
    .toBe(emails.length);
  return emails.map((e) => found.get(e)!);
}

/** Recule le début de la partie : les échéances passées se résolvent à la prochaine visite. */
async function rewind(santaId: string, days: number) {
  await db
    .from("magic_games")
    .update({ starts_at: new Date(Date.now() - days * 86_400_000 - 60_000).toISOString() })
    .eq("santa_id", santaId);
}

async function join(page: Page, link: string) {
  await page.goto(`${link}/jeu`);
  const buttons = page.getByRole("button", {
    name: /^(Père Noël|Grinch|Pour les Pères Noël|Pour les Grinchs|Découvrir mon rôle)$/,
  });
  await buttons.first().click();
  await expect(page.getByRole("region", { name: "Mon rôle" })).toBeVisible({ timeout: 15_000 });
}

test("La Magie de Noël : camps, vote, gazette, identification, révélation", async ({ page }, info) => {
  test.setTimeout(240_000);
  const run = `${info.project.name}-${Date.now()}`;
  const title = `Test e2e magie ${run}`;
  const people = Array.from({ length: 12 }, (_, i) => ({
    first: `Joueur${String.fromCharCode(65 + i)}`,
    last: `Test${i + 1}`,
    email: `magie${i + 1}-${run}@exemple.test`,
  }));

  // Secret Santa à 12, lancé
  await page.goto("/lutins");
  await page.getByLabel("Nom du Secret Santa").fill(title);
  await page.getByLabel("Mot de passe de l'organisation").fill("bouleau");
  await page.getByRole("button", { name: "Créer le Secret Santa" }).click();
  await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible({ timeout: 15_000 });
  const organizerUrl = page.url();
  await page
    .getByRole("textbox", { name: /^\d+ thèmes?$/ })
    .fill(people.map((_, i) => `Thème ${i + 1}`).join("\n"));
  for (const [i, p] of people.entries()) {
    if (i >= 3) await page.getByRole("button", { name: "Ajouter un participant" }).click();
    await page.getByLabel(`Prénom du participant ${i + 1}`, { exact: true }).fill(p.first);
    await page.getByLabel(`Nom du participant ${i + 1}`, { exact: true }).fill(p.last);
    await page.getByLabel(`Adresse mail du participant ${i + 1}`, { exact: true }).fill(p.email);
  }
  await page.getByRole("button", { name: "Lancer le tirage" }).click();
  await page.getByRole("button", { name: "Lancer et envoyer les mails" }).click();
  await expect(page.getByText("Tirage vérifié")).toBeVisible({ timeout: 30_000 });

  // L'organisation ouvre le jeu
  const start = new Date(Date.now() + 3 * 86_400_000);
  const local = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}-${String(start.getDate()).padStart(2, "0")}T20:00`;
  await page.getByLabel("Début de la partie").fill(local);
  await page.getByLabel("Durée d'une manche (jours)").fill("1");
  await page.getByRole("button", { name: "Ouvrir le jeu" }).click();
  await expect(page.getByText(/^Choix des camps jusqu'au/)).toBeVisible({ timeout: 15_000 });

  const { data: santa } = await db.from("santas").select("id").eq("title", title).single();
  const santaId = santa!.id;
  const paths = await links(people.map((p) => p.email));

  // Onze joueurs choisissent, dans l'ordre. Le douzième sera placé d'office au début de la partie.
  await page.goto(paths[0]!);
  await page.getByRole("link", { name: "Entrer dans le jeu" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "La Magie de Noël" })).toBeVisible();
  await expect(page.getByText(/Choisissez votre camp/)).toBeVisible();
  for (const link of paths.slice(0, 11)) await join(page, link);
  // Aucun message tant que la partie n'a pas commencé.
  await expect(page.getByRole("log")).toHaveCount(0);

  // Début de la partie : tchat ouvert, vote de la manche 1
  await rewind(santaId, 0);
  await page.goto(`${paths[11]!}/jeu`);
  await expect(page.getByRole("region", { name: "Mon rôle" })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText(/^Manche 1 sur 5/)).toBeVisible();
  await expect(page.getByRole("log")).toContainText("La partie commence.");
  await expect(page.getByLabel("Présents").getByRole("listitem")).toHaveCount(6);
  await expect(page.getByRole("region", { name: "Identifications" })).toContainText("2 restantes");

  // Message et vote
  await page.getByLabel("Votre message").fill("Bonjour à tous");
  await page.getByRole("button", { name: "Envoyer" }).click();
  await expect(page.getByRole("log")).toContainText("Bonjour à tous");
  const vote = page.getByRole("region", { name: "Vote de la manche 1" });
  await vote.getByRole("button").first().click();
  await expect(vote.getByRole("button", { pressed: true })).toContainText("votre vote");

  // Identification : définitive, une de moins
  const ids = page.getByRole("region", { name: "Identifications" });
  await ids.getByLabel("Personne").selectOption({ index: 1 });
  await ids.getByLabel("Rôle").selectOption("inf");
  await ids.getByRole("button", { name: "Déposer" }).click();
  await expect(ids).toContainText("1 restante");
  await expect(ids).toContainText(": Infiltré");

  // Fin du vote de la manche 1 : gazette, manche 2
  await rewind(santaId, 1);
  await page.reload();
  await expect(page.getByText(/^(Manche 2 sur 5|Partie terminée)/)).toBeVisible({ timeout: 15_000 });
  const { data: rounds } = await db.from("magic_rounds").select("round").eq("santa_id", santaId);
  expect(rounds).toHaveLength(1);
  const { data: gazettes } = await db
    .from("magic_messages")
    .select("chat")
    .eq("santa_id", santaId)
    .eq("kind", "gazette");
  expect(gazettes!.map((g) => g.chat).sort()).toEqual(["gr", "pn"]);

  // La base ne contient aucun rôle en clair
  const { data: stored } = await db.from("magic_players").select("secret").eq("santa_id", santaId);
  expect(stored).toHaveLength(12);
  for (const row of stored!) expect(row.secret).toMatch(/^v1\./);

  // Fin de partie, puis révélation par l'organisation
  await rewind(santaId, 6);
  await page.reload();
  await expect(page.getByText(/^Partie terminée/)).toBeVisible({ timeout: 20_000 });
  await page.goto(organizerUrl);
  await page.getByRole("button", { name: "Révéler les rôles et le classement" }).click();
  await expect(page.getByText(/Rôles et classement révélés\.$/)).toBeVisible({ timeout: 15_000 });

  await page.goto(`${paths[3]!}/jeu`);
  const table = page.getByRole("region", { name: "Rôles et classement" }).getByRole("table");
  await expect(table.getByRole("row")).toHaveCount(13);
  await expect(table.getByRole("cell", { name: "Grinch", exact: true })).toHaveCount(5);
  await expect(table.getByRole("cell", { name: "Père Noël", exact: true })).toHaveCount(5);
  await expect(table.getByRole("cell", { name: /infiltré$/ })).toHaveCount(2);
});
