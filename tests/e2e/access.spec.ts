import { createClient } from "@supabase/supabase-js";
import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { existsSync } from "node:fs";
import { hashPassword } from "../../src/server/auth/password";
import type { Database } from "../../src/types/database";

// Création de liste et accès en écriture, sur la base locale (seed : « Mes 30 ans » → bouleau).

if (existsSync(".env.local")) process.loadEnvFile(".env.local");
const SUPABASE_URL = process.env.SUPABASE_URL ?? "";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const db = createClient<Database>(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

test.skip(!SUPABASE_URL || !SERVICE_KEY, "base locale requise");

const DAY = 24 * 60 * 60;

/** Les projets desktop et mobile tournent en parallèle : on ne remet à zéro que ses propres compteurs. */
async function resetUnlockLimit(slug: string) {
  const { data } = await db.from("lists").select("id").eq("slug", slug).single();
  await db.from("rate_limits").delete().like("bucket", `unlock:${data!.id}:%`);
}

/** Toute requête du navigateur vers Supabase autre qu'une lecture. */
function watchSupabaseWrites(page: Page): string[] {
  const writes: string[] = [];
  const host = new URL(SUPABASE_URL).host;
  page.on("request", (req) => {
    if (new URL(req.url()).host === host && !["GET", "HEAD", "OPTIONS"].includes(req.method())) {
      writes.push(`${req.method()} ${req.url()}`);
    }
  });
  return writes;
}

async function editCookie(context: BrowserContext) {
  return (await context.cookies()).find((c) => c.name.startsWith("envies_edit_"));
}

const unlockDialog = (page: Page, title: string) => page.getByRole("dialog", { name: `Modifier ${title}` });

test.beforeAll(async () => {
  await db.from("rate_limits").delete().like("bucket", "create:%");
});

test.describe("création et accès", () => {
  test("créer une liste : validation, « C'est prêt. », cookie 30 jours", async ({ page, context }, info) => {
    const writes = watchSupabaseWrites(page);
    await page.goto("/");
    await page.getByRole("link", { name: "Nouvelle liste" }).locator("visible=true").first().click();
    await expect(page).toHaveURL(/\/nouvelle$/);
    await expect(page).toHaveTitle("Nouvelle liste · Envies");

    // Validation à l'envoi
    await page.getByRole("button", { name: "Créer la liste" }).click();
    await expect(page.getByText("Donnez un nom à la liste.")).toBeVisible();
    await expect(page.getByText("Indiquez votre prénom.")).toBeVisible();
    await expect(page.getByText("4 caractères au moins.")).toBeVisible();

    const title = `Test e2e ${info.project.name} ${Date.now()}`;
    await page.getByLabel("Nom de la liste").fill(title);
    await page.getByLabel("Votre prénom").fill("Tess");
    await page.getByLabel("Mot de passe pour modifier").fill("abc");
    await page.getByLabel("Mot de passe pour modifier").blur();
    await expect(page.getByText("4 caractères au moins.")).toBeVisible();
    await page.getByLabel("Mot de passe pour modifier").fill("abcd");
    await page.getByText("Ambre", { exact: true }).click();

    // Aperçu en direct
    const preview = page.getByRole("region", { name: "Aperçu" });
    await expect(preview).toContainText("La liste de Tess");
    await expect(preview).toContainText(title);

    await page.getByRole("button", { name: "Créer la liste" }).click();
    await expect(page.getByRole("heading", { name: "C'est prêt." })).toBeVisible();
    await expect(page.getByText(`« ${title} » est en ligne.`, { exact: false })).toBeVisible();

    const slug = title.toLowerCase().replace(/ /g, "-");
    await expect(page.getByTitle(new RegExp(`/l/${slug}$`))).toBeVisible();
    await expect(
      page.getByTitle(
        new RegExp(`/l/${slug}/edition#cle=[2-9A-HJKMNP-Z]{4}-[2-9A-HJKMNP-Z]{4}-[2-9A-HJKMNP-Z]{4}$`),
      ),
    ).toBeVisible();

    const cookie = await editCookie(context);
    expect(cookie?.httpOnly).toBe(true);
    expect(cookie?.sameSite).toBe("Lax");
    expect(cookie!.expires).toBeGreaterThan(Date.now() / 1000 + 29 * DAY);

    await page.getByRole("link", { name: "Ajouter les premières envies" }).click();
    await expect(page).toHaveURL(new RegExp(`/l/${slug}/edition$`));
    await expect(page.getByText("Mode édition")).toBeVisible();

    // La liste apparaît à l'accueil
    await page.goto("/");
    await expect(page.getByRole("link", { name: new RegExp(title) }).first()).toBeAttached();

    expect(writes).toEqual([]);
  });

  test("le lien secret déverrouille un autre navigateur et disparaît de l'adresse", async ({
    browser,
    page,
  }) => {
    const { data } = await db
      .from("list_secrets")
      .select("edit_key, lists!inner(slug)")
      .eq("lists.slug", "mes-30-ans")
      .single();
    const other = await browser.newContext({ viewport: page.viewportSize() ?? undefined });
    const tab = await other.newPage();
    const writes = watchSupabaseWrites(tab);
    await tab.goto(`/l/mes-30-ans/edition#cle=${data!.edit_key}`);
    await expect(tab.getByText("Mode édition")).toBeVisible();
    await expect.poll(() => tab.url()).toMatch(/\/l\/mes-30-ans\/edition$/);
    expect(tab.url()).not.toContain("cle=");
    expect((await editCookie(other))?.expires).toBeGreaterThan(Date.now() / 1000 + 29 * DAY);
    expect(writes).toEqual([]);
    await other.close();
  });

  test("lien secret invalide : message et demande de mot de passe", async ({ page }) => {
    await page.goto("/l/mes-30-ans/edition#cle=AAAA-BBBB-CCCC");
    const dialog = unlockDialog(page, "Mes 30 ans");
    // La modale n'apparaît qu'après la réponse du serveur sur la clé.
    await expect(dialog).toBeVisible({ timeout: 15_000 });
    await expect(
      dialog.getByText(/Ce lien de modification n'est plus valable\.|Trop d'essais/),
    ).toBeVisible();
    expect(page.url()).not.toContain("cle=");
  });

  test("mot de passe : erreur, session sans « rester déverrouillé », verrouiller", async ({
    page,
    context,
  }) => {
    await resetUnlockLimit("mes-30-ans");
    const writes = watchSupabaseWrites(page);
    await page.goto("/l/mes-30-ans");
    await page
      .getByRole("link", { name: /Modifier/ })
      .locator("visible=true")
      .first()
      .click();
    const dialog = unlockDialog(page, "Mes 30 ans");
    await expect(dialog).toBeVisible();
    const field = dialog.getByLabel("Mot de passe pour modifier");
    await expect(field).toBeFocused();

    await field.fill("sapin");
    await dialog.getByRole("button", { name: "Déverrouiller" }).click();
    await expect(dialog.getByText("Ce n'est pas le bon mot de passe.")).toBeVisible();
    await expect(field).toBeFocused();
    await expect(field).toHaveAttribute("aria-invalid", "true");

    await dialog.getByText("Rester déverrouillé sur cet appareil (30 jours)").click();
    await field.fill("bouleau");
    await field.press("Enter");
    await expect(page.getByText("Mode édition")).toBeVisible();
    await expect(dialog).toBeHidden();
    // Case décochée : cookie de session, perdu à la fermeture du navigateur.
    expect((await editCookie(context))?.expires).toBe(-1);

    await page
      .getByRole("button", { name: "Verrouiller cet appareil" })
      .locator("visible=true")
      .first()
      .click();
    await expect(unlockDialog(page, "Mes 30 ans")).toBeVisible();
    expect(await editCookie(context)).toBeUndefined();

    // ✕ (desktop) ou Échap / glisser (mobile, pas de ✕ dans la maquette) ramène à la page visiteur
    const locked = unlockDialog(page, "Mes 30 ans");
    if ((page.viewportSize()?.width ?? 1440) >= 1024)
      await locked.getByRole("button", { name: "Fermer" }).click();
    else await page.keyboard.press("Escape");
    await expect(page).toHaveURL(/\/l\/mes-30-ans$/);
    expect(writes).toEqual([]);
  });

  test("11 mauvais mots de passe : bloqué", async ({ page }, info) => {
    // 11 vérifications scrypt à la suite : plus long quand d'autres tests tournent en même temps.
    test.setTimeout(60_000);
    // Liste propre au test : aucun autre test ne touche à son compteur d'essais.
    const title = `Test e2e essais ${info.project.name} ${info.repeatEachIndex} ${Date.now()}`;
    const slug = title
      .toLowerCase()
      .replace(/ /g, "-")
      .replace(/[^a-z0-9-]/g, "");
    const { data: list } = await db
      .from("lists")
      .insert({ slug, title, owner_name: "Tess" })
      .select("id")
      .single();
    await db.from("list_secrets").insert({
      list_id: list!.id,
      password_hash: await hashPassword("sapin"),
      edit_key: `T${Date.now()}${info.repeatEachIndex}${info.project.name}`,
    });
    await page.goto(`/l/${slug}/edition`);
    const dialog = unlockDialog(page, title);
    const field = dialog.getByLabel("Mot de passe pour modifier");
    const button = dialog.getByRole("button", { name: "Déverrouiller" });
    for (let i = 1; i <= 10; i++) {
      await field.fill(`faux-${i}`);
      await button.click();
      await expect(dialog.getByText("Ce n'est pas le bon mot de passe.")).toBeVisible();
      await expect(button).toBeEnabled();
    }
    await field.fill("sapin"); // même le bon mot de passe est refusé pendant le blocage
    await button.click();
    await expect(dialog.getByText(/Trop d'essais\. Réessayez dans \d+ minutes?\./)).toBeVisible();
    await expect(button).toBeDisabled();
  });
});
