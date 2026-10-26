import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { hashPassword } from "../../src/server/auth/password";
import { db, isDesktop, skipWithoutDb, unlock } from "./helpers";

// Import d'un fichier Excel (maquettes ImportV4 / MImportV4) et export.

skipWithoutDb();

const FIXTURE = "tests/fixtures/import-45.xlsx";

async function createImportList(name: string) {
  const slug = `test-e2e-import-${name}-${Date.now()}`;
  const { data: list } = await db
    .from("lists")
    .insert({ slug, title: `Test e2e édition import ${name}`, owner_name: "Tess" })
    .select("id")
    .single();
  await db.from("list_secrets").insert({
    list_id: list!.id,
    password_hash: await hashPassword("bouleau"),
    edit_key: `IMP${Date.now()}${Math.floor(Math.random() * 1000)}`,
  });
  await db.from("categories").insert([
    { list_id: list!.id, name: "Déco", position: "a0" },
    { list_id: list!.id, name: "Livres", position: "a1" },
  ]);
  return { slug, listId: list!.id };
}

const target = (page: Page, column: string) =>
  page
    .getByRole("row")
    .filter({ has: page.getByText(column, { exact: true }) })
    .getByRole("combobox");

test("importer import-45.xlsx : colonnes devinées, 43 articles, 2 catégories", async ({ page }, info) => {
  test.setTimeout(90_000);
  const { slug, listId } = await createImportList(info.project.name);
  await unlock(page, slug);
  if (isDesktop(page)) await page.getByRole("link", { name: "Importer" }).click();
  else await page.goto(`/l/${slug}/edition/importer`);
  await expect(page.getByText("Déposez un fichier ici, ou choisissez-le")).toBeVisible({ timeout: 15_000 });

  // Mauvais format.
  await page
    .getByLabel("Choisir un fichier")
    .setInputFiles({ name: "photo.png", mimeType: "image/png", buffer: Buffer.from([1, 2, 3]) });
  await expect(page.getByText("Ce format n'est pas lu. Utilisez .xlsx, .xls, .csv ou .ods.")).toBeVisible();

  await page.getByLabel("Choisir un fichier").setInputFiles(FIXTURE);
  await expect(page.getByText("import-45.xlsx")).toBeVisible();
  await expect(page.getByText("45 lignes · 8 colonnes")).toBeVisible();

  // Correspondance de la maquette ImportV4.
  const expected: [string, string][] = [
    ["Article", "title"],
    ["URL", "url"],
    ["Prix (€)", "price"],
    ["Rayon", "category"],
    ["Top", "favorite"],
    ["Mots-clés", "tags"],
    ["Commentaire", "note"],
    ["Acheté ?", "skip"],
  ];
  for (const [column, value] of expected) await expect(target(page, column)).toHaveValue(value);
  await expect(page.getByText("deviné", { exact: true })).toHaveCount(7);
  await expect(page.getByText("2 nouvelles : Jardin, Cuisine")).toBeVisible();
  await expect(page.getByText("oui, x, 1, ✓ comptent comme oui")).toBeVisible();
  const preview = page.getByRole("complementary", { name: "Aperçu" });
  await expect(preview).toContainText("Lampe champignon");
  await expect(preview).toContainText("Fauteuil en rotin");
  await expect(preview).toContainText("Liseuse 7 pouces");
  await expect(
    page.getByText("2 lignes ont un lien déjà présent dans la liste : elles seront ignorées."),
  ).toBeVisible();
  await expect(page.getByText("45 lignes − 2 doublons").locator("visible=true")).toBeVisible();

  // Une cible déjà prise : l'autre colonne passe à « Ne pas importer ».
  await target(page, "Commentaire").selectOption("title");
  await expect(target(page, "Article")).toHaveValue("skip");
  await target(page, "Article").selectOption("title");
  await expect(target(page, "Commentaire")).toHaveValue("skip");
  await target(page, "Commentaire").selectOption("note");

  if (isDesktop(page)) {
    const { violations } = await new AxeBuilder({ page }).analyze();
    expect(
      violations.flatMap((v) =>
        v.nodes.map((n) => `${v.id}: ${n.target.join(" ")} ${n.any[0]?.message ?? ""}`),
      ),
    ).toEqual([]);
  }

  // Sans lecture des liens (pas de réseau pendant les tests).
  await page.getByText("Compléter depuis les liens").click();
  await page.getByRole("button", { name: "Importer 43 articles" }).locator("visible=true").click();
  await expect(page.getByRole("heading", { name: "43 articles importés" })).toBeVisible({ timeout: 30_000 });
  await expect(
    page.getByText("2 doublons ignorés · 2 catégories créées : Jardin, Cuisine · 3 tags créés"),
  ).toBeVisible();

  const { count } = await db.from("items").select("id", { count: "exact", head: true }).eq("list_id", listId);
  expect(count).toBe(43);
  const { data: cats } = await db.from("categories").select("name").eq("list_id", listId).order("position");
  expect(cats!.map((c) => c.name)).toEqual(["Déco", "Livres", "Jardin", "Cuisine"]);

  await page.getByRole("link", { name: "Voir les articles à trier" }).click();
  await expect(page.getByRole("region", { name: "À trier" })).toContainText("Lampe champignon", {
    timeout: 15_000,
  });
});

test("glisser un fichier Excel sur l'édition ouvre l'import ; export .xlsx", async ({ page }, info) => {
  test.skip(!isDesktop(page), "glisser-déposer : desktop");
  test.setTimeout(60_000);
  const { slug, listId } = await createImportList(`${info.project.name}-glisser`);
  await unlock(page, slug);
  const base64 = readFileSync(FIXTURE).toString("base64");
  await expect(async () => {
    await page.evaluate(async (b64) => {
      const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      const data = new DataTransfer();
      data.items.add(new File([bytes], "noel.xlsx"));
      window.dispatchEvent(new DragEvent("dragenter", { dataTransfer: data }));
      window.dispatchEvent(new DragEvent("drop", { dataTransfer: data, cancelable: true }));
    }, base64);
    await expect(page).toHaveURL(new RegExp(`/l/${slug}/edition/importer$`), { timeout: 2000 });
  }).toPass({ timeout: 15_000 });
  await expect(page.getByText("noel.xlsx")).toBeVisible({ timeout: 15_000 });
  await expect(target(page, "Article")).toHaveValue("title");

  const res = await page.request.get(`/api/lists/${listId}/export`);
  expect(res.status()).toBe(200);
  expect(res.headers()["content-type"]).toContain("spreadsheetml");
  expect(res.headers()["content-disposition"]).toMatch(/envies-test-e2e-import-.*\.xlsx/);
});
