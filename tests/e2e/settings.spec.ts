import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Browser, type Page } from "@playwright/test";
import { addLines, createTestList, db, isDesktop, skipWithoutDb, unlock } from "./helpers";

// Réglages (maquettes ReglagesV4 / MReglagesV4) et critères du jalon 7.

skipWithoutDb();

const listIdOf = async (slug: string) =>
  (await db.from("lists").select("id").eq("slug", slug).single()).data!.id;

async function openSettings(page: Page, slug: string) {
  await page.goto(`/l/${slug}/edition/reglages`);
  await expect(page.getByRole("heading", { level: 1, name: /^Réglages de / })).toBeVisible({
    timeout: 15_000,
  });
}

/** Un autre appareil : nouveau contexte, déverrouillé par mot de passe. */
async function otherDevice(browser: Browser, slug: string) {
  const context = await browser.newContext({ locale: "fr-FR", viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  await unlock(page, slug);
  return { context, page };
}

test("adresse : l'ancien lien redirige (308) ; nom enregistré", async ({ page, request }, info) => {
  test.setTimeout(60_000);
  const slug = await createTestList(`${info.project.name}-adresse`);
  await unlock(page, slug);
  if (isDesktop(page)) await page.getByRole("link", { name: "Réglages", exact: true }).click();
  else await page.getByRole("link", { name: "Réglages de la liste" }).click();
  await expect(page).toHaveURL(new RegExp(`/l/${slug}/edition/reglages$`), { timeout: 15_000 });

  const title = page.getByLabel("Nom de la liste");
  await expect(title).toHaveValue(`Test e2e édition ${info.project.name}-adresse`);
  await title.fill(`Test e2e édition ${info.project.name} renommée`);
  await title.press("Enter");
  await expect(page.getByText("Enregistré", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("renommée");

  const next = `${slug}-nouvelle`;
  const address = page.getByRole("textbox", { name: "Adresse", exact: true }).locator("visible=true");
  await address.fill(next);
  await address.press("Enter");
  await expect(page.getByText("Les anciens liens redirigeront vers la nouvelle adresse.")).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`/l/${next}/edition/reglages$`));

  const old = await request.get(`/l/${slug}`, { maxRedirects: 0 });
  expect(old.status()).toBe(308);
  expect(old.headers().location).toMatch(new RegExp(`/l/${next}$`));
  const oldItem = await request.get(`/l/${slug}/edition`, { maxRedirects: 0 });
  expect(oldItem.status()).toBe(308);

  // Une adresse prise par une autre liste est refusée.
  await address.fill("mes-30-ans");
  await address.press("Enter");
  await expect(page.getByText("Cette adresse est déjà prise.")).toBeVisible();
});

test("régénérer le lien secret : l'ancien n'est plus valable, l'autre appareil est verrouillé", async ({
  page,
  browser,
}, info) => {
  test.setTimeout(90_000);
  const slug = await createTestList(`${info.project.name}-cle`);
  const listId = await listIdOf(slug);
  const { data: before } = await db.from("list_secrets").select("edit_key").eq("list_id", listId).single();
  const other = await otherDevice(browser, slug);

  await unlock(page, slug);
  await openSettings(page, slug);
  await expect(page.getByText(`edition#cle=${before!.edit_key}`)).toBeVisible();
  await page.getByRole("button", { name: "Régénérer le lien secret" }).click();
  await expect(page.getByText("L'ancien lien ne marchera plus. Régénérer ?")).toBeVisible();
  await page.getByRole("button", { name: "Oui", exact: true }).locator("visible=true").click();
  await expect(page.getByText(`edition#cle=${before!.edit_key}`)).toBeHidden({ timeout: 15_000 });
  const { data: after } = await db.from("list_secrets").select("edit_key").eq("list_id", listId).single();
  expect(after!.edit_key).not.toBe(before!.edit_key);
  await expect(page.getByText(`edition#cle=${after!.edit_key}`)).toBeVisible();

  // Cet appareil reste déverrouillé.
  await page.goto(`/l/${slug}/edition`);
  await expect(page.getByText("Mode édition")).toBeVisible({ timeout: 15_000 });

  // L'ancien lien secret, sur un appareil neuf.
  const fresh = await browser.newContext({ locale: "fr-FR" });
  const freshPage = await fresh.newPage();
  await freshPage.goto(`/l/${slug}/edition#cle=${before!.edit_key}`);
  await expect(freshPage.getByText("Ce lien de modification n'est plus valable.")).toBeVisible({
    timeout: 15_000,
  });
  await fresh.close();

  // L'autre appareil est verrouillé à sa prochaine action.
  await addLines(other.page, ["Un carnet"]).catch(() => undefined);
  await expect(
    other.page.getByText("La modification s'est verrouillée. Saisissez le mot de passe pour continuer."),
  ).toBeVisible({ timeout: 30_000 });
  await expect(other.page.getByRole("dialog", { name: /^Modifier Test e2e/ })).toBeVisible({
    timeout: 15_000,
  });
  await other.context.close();
});

test("mot de passe changé : nouveau mot de passe accepté ailleurs", async ({ page, browser }, info) => {
  test.skip(!isDesktop(page), "desktop");
  test.setTimeout(60_000);
  const slug = await createTestList(`${info.project.name}-mdp`);
  await unlock(page, slug);
  await openSettings(page, slug);
  await page.getByLabel("Nouveau mot de passe").fill("cerisier");
  await page.getByRole("button", { name: "Changer" }).click();
  await expect(page.getByText("Mot de passe changé. Les autres appareils devront le saisir.")).toBeVisible();

  const context = await browser.newContext({ locale: "fr-FR" });
  const other = await context.newPage();
  await other.goto(`/l/${slug}/edition`);
  const dialog = other.getByRole("dialog", { name: /^Modifier Test e2e/ });
  await dialog.getByLabel("Mot de passe pour modifier").fill("cerisier");
  await dialog.getByRole("button", { name: "Déverrouiller" }).click();
  await expect(other.getByText("Mode édition")).toBeVisible({ timeout: 15_000 });
  await context.close();
});

test("catégories et tags : renommer, ordonner, couleur, supprimer et annuler", async ({ page }, info) => {
  test.setTimeout(90_000);
  const slug = await createTestList(`${info.project.name}-taxo`);
  const listId = await listIdOf(slug);
  await db.from("tags").insert({ list_id: listId, name: "Priorité", color: "rouille", position: "a0" });
  await unlock(page, slug);
  await openSettings(page, slug);
  const categories = page.getByRole("list", { name: "Catégories" });
  await expect(categories).toContainText("2 articles");
  await expect(categories).toContainText("Non classé");

  // Renommer en place.
  const name = page.getByLabel("Nom de la catégorie : Lecture & carnets");
  await name.fill("Livres");
  await name.press("Enter");
  await expect
    .poll(async () =>
      (await db.from("categories").select("name").eq("list_id", listId).order("position")).data!.map(
        (c) => c.name,
      ),
    )
    .toEqual(["Maison & déco", "Livres"]);

  // Ordonner au clavier : Livres passe en premier.
  const handle = page.getByRole("button", { name: "Déplacer : Livres" });
  // Saisir (une seule fois : un second Espace relâcherait), puis monter d'un cran avant de déposer.
  await expect(async () => {
    if ((await handle.getAttribute("aria-pressed")) !== "true") {
      await handle.focus();
      await page.keyboard.press("Space");
    }
    await expect(handle).toHaveAttribute("aria-pressed", "true", { timeout: 1000 });
  }).toPass({ timeout: 15_000 });
  await expect(async () => {
    await page.keyboard.press("ArrowUp");
    await expect(page.getByText("Livres à la place de Maison & déco.")).toBeAttached({ timeout: 1000 });
  }).toPass({ timeout: 15_000 });
  await page.keyboard.press("Space");
  await expect
    .poll(async () =>
      (await db.from("categories").select("name").eq("list_id", listId).order("position")).data!.map(
        (c) => c.name,
      ),
    )
    .toEqual(["Livres", "Maison & déco"]);

  // Supprimer : les articles passent dans « Non classé », « Annuler » remet tout.
  await page.getByRole("button", { name: "Supprimer la catégorie : Maison & déco" }).click();
  await expect(page.getByText("Catégorie supprimée")).toBeVisible();
  await expect(page.getByLabel("Nom de la catégorie : Maison & déco")).toHaveCount(0);
  await expect
    .poll(
      async () =>
        (await db.from("items").select("id").eq("list_id", listId).is("category_id", null)).data!.length,
    )
    .toBe(2);
  await page.getByRole("button", { name: "Annuler" }).click();
  await expect(page.getByLabel("Nom de la catégorie : Maison & déco")).toHaveValue("Maison & déco");
  await expect
    .poll(
      async () =>
        (await db.from("items").select("id").eq("list_id", listId).is("category_id", null)).data!.length,
    )
    .toBe(0);

  // Tag : couleur, puis suppression annulée.
  await page.getByRole("button", { name: "Couleur du tag : Priorité" }).click();
  await page.getByRole("radio", { name: "Olive" }).click();
  await expect
    .poll(async () => (await db.from("tags").select("color").eq("list_id", listId).single()).data!.color)
    .toBe("olive");
  await page.getByRole("button", { name: "Supprimer le tag : Priorité" }).click();
  await expect(page.getByText("Tag supprimé")).toBeVisible();
  await page.getByRole("button", { name: "Annuler" }).click();
  await expect(page.getByLabel("Nom du tag : Priorité")).toHaveValue("Priorité");

  // Nouvelle catégorie.
  await page.getByLabel("Nouvelle catégorie").fill("Musique");
  await page.getByLabel("Nouvelle catégorie").press("Enter");
  await expect(page.getByLabel("Nom de la catégorie : Musique")).toHaveValue("Musique");

  if (isDesktop(page)) {
    const { violations } = await new AxeBuilder({ page }).analyze();
    expect(violations.map((v) => `${v.id}: ${v.help} (${v.nodes.length})`)).toEqual([]);
  }
});

test("supprimer la liste : disparaît de l'accueil, l'ancien lien donne 404", async ({
  page,
  request,
}, info) => {
  test.setTimeout(60_000);
  const slug = await createTestList(`${info.project.name}-suppr`);
  const title = `Test e2e édition ${info.project.name}-suppr`;
  await unlock(page, slug);
  await openSettings(page, slug);
  await expect(
    page.getByText("Les 4 articles et leurs photos seront effacés. Impossible de revenir en arrière."),
  ).toBeVisible();
  const confirm = page.getByLabel(`Tapez « ${title} » pour confirmer`);
  const button = page.getByRole("button", { name: "Supprimer la liste" });
  await expect(button).toBeDisabled();
  await confirm.fill(title.toLowerCase());
  await expect(button).toBeDisabled();
  await confirm.fill(title);
  await expect(button).toBeEnabled();
  await button.click();

  await expect(page).toHaveURL(/\/$/, { timeout: 15_000 });
  await expect(page.getByText("Liste supprimée.")).toBeVisible();
  await page.reload();
  await expect(page.getByText(title)).toHaveCount(0);
  expect((await request.get(`/l/${slug}`, { maxRedirects: 0 })).status()).toBe(404);
});
