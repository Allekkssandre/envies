import { expect, test } from "@playwright/test";
import { createTestList, db, skipWithoutDb } from "./helpers";

// Liste privée : visible sur l'accueil, contenu derrière le mot de passe (même jeton que l'édition).

skipWithoutDb();

async function resetUnlockLimit(slug: string) {
  const { data } = await db.from("lists").select("id").eq("slug", slug).single();
  await db.from("rate_limits").delete().like("bucket", `unlock:${data!.id}:%`);
}

test("liste privée : rien sans mot de passe, tout après", async ({ page, request }) => {
  const slug = await createTestList("privee");
  const { data: list } = await db
    .from("lists")
    .update({ is_private: true, description: "Petit mot caché" })
    .eq("slug", slug)
    .select("id, title")
    .single();
  await resetUnlockLimit(slug);

  // Accueil : la liste est là, marquée privée.
  await page.goto("/");
  const card = page
    .getByRole("link", { name: new RegExp(list!.title) })
    .locator("visible=true")
    .first();
  await expect(card).toContainText("Privée");

  // Page de la liste : ni articles ni petit mot, la demande de mot de passe s'ouvre.
  await page.goto(`/l/${slug}`);
  const dialog = page.getByRole("dialog", { name: `Ouvrir ${list!.title}` });
  await expect(dialog).toBeVisible();
  await expect(page.getByText("Lampe champignon")).toHaveCount(0);
  await expect(page.getByText("Petit mot caché")).toHaveCount(0);

  // Export et fiche directe : rien non plus.
  expect((await request.get(`/api/lists/${list!.id}/export`)).status()).toBe(404);

  // Mauvais puis bon mot de passe.
  await dialog.getByLabel("Mot de passe", { exact: true }).fill("chene");
  await dialog.getByRole("button", { name: "Déverrouiller" }).click();
  await expect(dialog.getByText("Ce n'est pas le bon mot de passe.")).toBeVisible();
  await dialog.getByLabel("Mot de passe", { exact: true }).fill("bouleau");
  await dialog.getByRole("button", { name: "Déverrouiller" }).click();
  await expect(page.getByText("Lampe champignon").locator("visible=true").first()).toBeVisible({
    timeout: 15_000,
  });
  await expect(dialog).toHaveCount(0);

  // Le même accès ouvre la modification, et l'export.
  await page.goto(`/l/${slug}/edition`);
  await expect(page.getByText("Mode édition")).toBeVisible();
  expect((await page.request.get(`/api/lists/${list!.id}/export`)).status()).toBe(200);
});
