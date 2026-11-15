import { expect, test } from "@playwright/test";
import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { db, skipWithoutDb } from "./helpers";

// La Magie de Noël de bout en bout : 8 joueurs, rôles tirés, carte retournée, désignations,
// masque qui tombe, gazette par mail, révélation.
skipWithoutDb();
if (existsSync(".env.local")) process.loadEnvFile(".env.local");
const MAIL_DIR = process.env.SANTA_MAIL_DIR ?? "";
test.skip(!MAIL_DIR, "SANTA_MAIL_DIR requis");

type Mail = { to: string; subject: string; text: string };

async function mails(): Promise<Mail[]> {
  const files = existsSync(MAIL_DIR) ? (await readdir(MAIL_DIR)).sort() : [];
  return Promise.all(
    files.map(async (f) => JSON.parse(await readFile(path.join(MAIL_DIR, f), "utf8")) as Mail),
  );
}

async function links(emails: string[], suffix: RegExp): Promise<string[]> {
  const found = new Map<string, string>();
  await expect
    .poll(
      async () => {
        for (const mail of await mails()) {
          const link = /https?:\/\/\S+\/lutins\/moi\/\S+/.exec(mail.text)?.[0];
          if (emails.includes(mail.to) && link && suffix.test(link)) {
            found.set(mail.to, new URL(link).pathname);
          }
        }
        return found.size;
      },
      { timeout: 30_000 },
    )
    .toBe(emails.length);
  return emails.map((e) => found.get(e)!);
}

/** Recule le début de la partie : les semaines échues se résolvent à la prochaine visite. */
async function rewind(santaId: string, days: number) {
  await db
    .from("magic_games")
    .update({ starts_at: new Date(Date.now() - days * 86_400_000 - 60_000).toISOString() })
    .eq("santa_id", santaId);
}

test("La Magie de Noël : rôle, désignations, masque qui tombe, gazette, révélation", async ({
  page,
}, info) => {
  test.setTimeout(240_000);
  const run = `${info.project.name}-${Date.now()}`;
  const title = `Test e2e magie ${run}`;
  const people = Array.from({ length: 8 }, (_, i) => ({
    first: `Joueur${String.fromCharCode(65 + i)}`,
    last: `Test${i + 1}`,
    email: `magie${i + 1}-${run}@exemple.test`,
  }));
  const emails = people.map((p) => p.email);

  // Secret Santa à 8, lancé
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
  await expect(page.getByText(/^8 joueurs\. Première semaine le/)).toBeVisible({ timeout: 15_000 });

  const { data: santa } = await db.from("santas").select("id").eq("title", title).single();
  const santaId = santa!.id;

  // Chacun reçoit un mail d'ouverture avec son lien direct vers le jeu, sans son rôle.
  const paths = await links(emails, /\/jeu$/);
  const opening = (await mails()).filter((m) => emails.includes(m.to) && /rôle vous attend/.test(m.subject));
  expect(opening).toHaveLength(8);
  for (const m of opening) expect(m.text).not.toMatch(/Vous êtes (un )?(Krampus|Père Noël)/);

  // La base ne contient aucun rôle en clair.
  const { data: stored } = await db.from("magic_players").select("secret, out_role").eq("santa_id", santaId);
  expect(stored).toHaveLength(8);
  for (const row of stored!) {
    expect(row.secret).toMatch(/^v1\./);
    expect(row.out_role).toBeNull();
  }

  // Avant le début : la carte se retourne, la désignation n'est pas encore ouverte.
  await page.goto(paths[0]!);
  await expect(page.getByRole("heading", { level: 1, name: /La Magie de Noël/ })).toBeVisible();
  await expect(page.getByRole("meter", { name: "Magie de Noël" })).toBeVisible();
  await expect(page.getByText(/^Vous pourrez désigner la personne/)).toBeVisible();
  await page.getByRole("button", { name: "Retourner la carte" }).click();
  await expect(page.getByRole("region", { name: "Mon rôle" })).toContainText(/Père Noël|Krampus/);
  await expect(page.getByRole("region", { name: "Gazette" })).toContainText(/indice pour la semaine 1/i);

  // Semaine 1 : sept joueurs désignent JoueurH, qui désigne JoueurA.
  await rewind(santaId, 0);
  for (const [i, link] of paths.entries()) {
    await page.goto(link);
    const panel = page.getByRole("region", { name: "Votre suspect" });
    await expect(panel).toContainText("Votre suspect de la semaine 1", { timeout: 15_000 });
    const target = i === 7 ? "JoueurA" : "JoueurH";
    await panel.getByRole("button", { name: target, exact: true }).click();
    await expect(panel.getByRole("button", { name: target, exact: true })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(panel).toContainText(`Vous soupçonnez ${target}.`);
  }
  await expect(page.getByText("8 personnes ont désigné cette semaine.")).toBeVisible({ timeout: 25_000 });

  // Fin de la semaine 1 : le masque de JoueurH tombe, la gazette part par mail.
  await rewind(santaId, 1);
  await page.goto(paths[0]!);
  await expect(page.getByText(/^(Semaine 2 sur 5|Partie terminée)/)).toBeVisible({ timeout: 15_000 });
  const gazette = page.getByRole("region", { name: "Gazette" });
  await expect(gazette).toContainText("Le masque de JoueurH est tombé");
  await expect(gazette.getByText(/^Le carnet des désignations \(8\)$/)).toBeVisible();
  await expect(page.getByRole("region", { name: "Votre suspect" })).toContainText("Rôles déjà révélés");
  await expect
    .poll(
      async () => (await mails()).filter((m) => emails.includes(m.to) && /semaine 1$/.test(m.subject)).length,
      {
        timeout: 30_000,
      },
    )
    .toBe(8);
  const { data: fallen } = await db
    .from("magic_players")
    .select("out_round")
    .eq("santa_id", santaId)
    .not("out_round", "is", null);
  expect(fallen).toHaveLength(1);

  // Fin de partie, puis révélation par l'organisation.
  await rewind(santaId, 6);
  await page.reload();
  await expect(page.getByText(/^Partie terminée/)).toBeVisible({ timeout: 20_000 });
  await page.goto(organizerUrl);
  await page.getByRole("button", { name: "Révéler les rôles et le classement" }).click();
  await expect(page.getByText(/Rôles et classement révélés\.$/)).toBeVisible({ timeout: 15_000 });

  await page.goto(paths[3]!);
  const table = page.getByRole("region", { name: "Rôles et flair" }).getByRole("table");
  await expect(table.getByRole("row")).toHaveCount(9);
  await expect(table.getByText("Krampus", { exact: true })).toHaveCount(2);
  await expect(table.getByText("Père Noël", { exact: true })).toHaveCount(6);
});
