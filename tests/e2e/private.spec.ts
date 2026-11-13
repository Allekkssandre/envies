import { expect, test } from "@playwright/test";
import { hashPassword } from "../../src/server/auth/password";
import { createTestList, db, skipWithoutDb } from "./helpers";

// Liste privée : visible sur l'accueil, contenu derrière le lien de lecture ou un mot de passe.

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

test("liste privée : le lien et le mot de passe de lecture ouvrent la lecture, pas la modification", async ({
  browser,
}) => {
  const slug = await createTestList("lecture");
  const { data: list } = await db
    .from("lists")
    .update({ is_private: true })
    .eq("slug", slug)
    .select("id, title")
    .single();
  await resetUnlockLimit(slug);
  const { data: secret } = await db
    .from("list_secrets")
    .update({ read_password_hash: await hashPassword("tilleul") })
    .eq("list_id", list!.id)
    .select("read_key")
    .single();

  // Lien de lecture : la liste s'ouvre seule, le fragment disparaît de l'adresse.
  const reader = await browser.newContext();
  const page = await reader.newPage();
  await page.goto(`/l/${slug}#acces=${secret!.read_key}`);
  await expect(page.getByText("Lampe champignon").locator("visible=true").first()).toBeVisible({
    timeout: 15_000,
  });
  expect(new URL(page.url()).hash).toBe("");
  // La modification demande toujours son mot de passe.
  await page.goto(`/l/${slug}/edition`);
  await expect(page.getByRole("dialog", { name: `Modifier ${list!.title}` })).toBeVisible();
  await reader.close();

  // Mot de passe de lecture : lecture seule aussi.
  const friend = await browser.newContext();
  const other = await friend.newPage();
  await other.goto(`/l/${slug}`);
  const dialog = other.getByRole("dialog", { name: `Ouvrir ${list!.title}` });
  await dialog.getByLabel("Mot de passe", { exact: true }).fill("tilleul");
  await dialog.getByRole("button", { name: "Déverrouiller" }).click();
  await expect(other.getByText("Lampe champignon").locator("visible=true").first()).toBeVisible({
    timeout: 15_000,
  });
  await other.goto(`/l/${slug}/edition`);
  await expect(other.getByRole("dialog", { name: `Modifier ${list!.title}` })).toBeVisible();
  await friend.close();
});
