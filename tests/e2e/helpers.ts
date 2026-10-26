import { createClient } from "@supabase/supabase-js";
import { expect, test, type Page } from "@playwright/test";
import { existsSync } from "node:fs";
import { hashPassword } from "../../src/server/auth/password";
import type { Database } from "../../src/types/database";

// Mode édition sur une liste créée pour chaque test (les données de démo ne sont pas touchées).

if (existsSync(".env.local")) process.loadEnvFile(".env.local");
const SUPABASE_URL = process.env.SUPABASE_URL ?? "";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
export const db = createClient<Database>(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

export const skipWithoutDb = () => test.skip(!SUPABASE_URL || !SERVICE_KEY, "base locale requise");

export const isDesktop = (page: Page) => (page.viewportSize()?.width ?? 1440) >= 1024;

export async function createTestList(name: string) {
  const slug = `test-e2e-edition-${name}-${Date.now()}`;
  const { data: list } = await db
    .from("lists")
    .insert({ slug, title: `Test e2e édition ${name}`, owner_name: "Tess" })
    .select("id")
    .single();
  await db.from("list_secrets").insert({
    list_id: list!.id,
    password_hash: await hashPassword("bouleau"),
    edit_key: `E2E${Date.now()}${Math.floor(Math.random() * 1000)}`,
  });
  const { data: cats } = await db
    .from("categories")
    .insert([
      { list_id: list!.id, name: "Maison & déco", position: "a0" },
      { list_id: list!.id, name: "Lecture & carnets", position: "a1" },
    ])
    .select("id, name");
  const maison = cats!.find((c) => c.name.startsWith("Maison"))!.id;
  const lecture = cats!.find((c) => c.name.startsWith("Lecture"))!.id;
  const now = new Date().toISOString();
  await db.from("items").insert([
    { list_id: list!.id, title: "Lampe champignon", category_id: maison, position: "a0", sorted_at: now },
    { list_id: list!.id, title: "Fauteuil en rotin", category_id: maison, position: "a1", sorted_at: now },
    { list_id: list!.id, title: "Coffret BD", category_id: lecture, position: "a2", sorted_at: now },
    { list_id: list!.id, title: "Liseuse", category_id: lecture, position: "a3", sorted_at: now },
  ]);
  return slug;
}

export async function unlock(page: Page, slug: string) {
  await page.goto(`/l/${slug}/edition`);
  const dialog = page.getByRole("dialog", { name: /^Modifier Test e2e/ });
  await dialog.getByLabel("Mot de passe pour modifier").fill("bouleau");
  await dialog.getByRole("button", { name: "Déverrouiller" }).click();
  // Déverrouillage + rendu de l'édition : ~2 s sur la base locale, davantage quand 4 workers tournent.
  await expect(page.getByText("Mode édition")).toBeVisible({ timeout: 15_000 });
}

export const section = (page: Page, name: string) => page.getByRole("region", { name });
export const cardTitles = (page: Page, name: string) =>
  section(page, name).getByRole("heading", { level: 3 });
export const inbox = (page: Page) => page.getByRole("region", { name: "À trier" });

/** Attend la fin des enregistrements (zone d'édition `aria-busy`) avant de recharger. */
export async function reloadWhenSaved(page: Page) {
  await expect(page.locator('main[aria-busy="true"]')).toHaveCount(0, { timeout: 20_000 });
  await page.reload();
}

/** Ajoute des lignes : barre d'ajout (desktop) ou feuille « Ajouter » (mobile). */
export async function addLines(page: Page, lines: string[]) {
  if (isDesktop(page)) {
    const field = page.getByLabel("Collez un lien, ou écrivez un nom");
    await field.fill(lines.join("\n"));
    await field.press("Enter");
    await expect(field).toHaveValue("");
  } else {
    await page.getByRole("button", { name: "Ajouter", exact: true }).click();
    const sheet = page.getByRole("dialog", { name: "Ajouter" });
    await sheet.getByLabel("Un lien ou un nom par ligne").fill(lines.join("\n"));
    await sheet.getByRole("button", { name: "Ajouter", exact: true }).click();
    await expect(sheet.getByLabel("Un lien ou un nom par ligne")).toHaveValue("");
    await sheet.getByRole("button", { name: "Fermer" }).click();
    await expect(sheet).toBeHidden();
  }
}
