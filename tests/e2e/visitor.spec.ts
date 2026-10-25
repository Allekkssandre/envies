import AxeBuilder from "@axe-core/playwright";
import { createClient } from "@supabase/supabase-js";
import { expect, test, type Page } from "@playwright/test";
import { existsSync } from "node:fs";

// Parcours visiteur sur la base locale (supabase db reset : migrations + seed).

if (existsSync(".env.local")) process.loadEnvFile(".env.local");

const isMobile = (page: Page) => (page.viewportSize()?.width ?? 1440) < 1024;

async function applyMaisonSecondeMain(page: Page, withFavorites: boolean) {
  if (isMobile(page)) {
    await page.getByRole("button", { name: /^Filtres/ }).click();
    const sheet = page.getByRole("dialog", { name: "Filtres" });
    await sheet.getByRole("button", { name: /^Maison & déco/ }).click();
    await sheet.getByRole("button", { name: "Seconde main OK" }).click();
    if (withFavorites) await sheet.getByRole("switch", { name: "Seulement les coups de cœur" }).click();
    await sheet.getByRole("button", { name: withFavorites ? "Voir 1 article" : "Voir 2 articles" }).click();
    await expect(sheet).toBeHidden();
  } else {
    await page
      .getByRole("navigation", { name: "Catégories" })
      .getByRole("button", { name: /^Maison & déco/ })
      .click();
    await page.getByRole("button", { name: /^Tags/ }).click();
    await page.getByRole("checkbox", { name: "Seconde main OK" }).check();
    await page.keyboard.press("Escape");
    if (withFavorites) await page.getByRole("button", { name: "Coups de cœur", exact: true }).click();
  }
}

const cards = (page: Page) => page.locator(`main a[href*="/a/"]`);

test.describe("visiteur", () => {
  test("accueil → liste → filtres → fiche → trouver ailleurs", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1, name: "Envies" })).toBeVisible();
    await expect(page.getByText("3 listes")).toBeVisible();

    // Recherche instantanée, insensible aux accents
    await page.getByLabel("Chercher une liste").fill("noel");
    await expect(page.getByRole("link", { name: /Noël en famille/ }).locator("visible=true")).toHaveCount(1);
    await expect(page.getByRole("link", { name: /Mes 30 ans/ }).locator("visible=true")).toHaveCount(0);
    await page.getByLabel("Chercher une liste").fill("");

    await page
      .getByRole("link", { name: /Mes 30 ans/ })
      .locator("visible=true")
      .click();
    await expect(page).toHaveURL(/\/l\/mes-30-ans$/);
    await expect(page).toHaveTitle("Mes 30 ans · liste de Merin · Envies");

    // 4 sections + « Non classé », 3 coups de cœur, ≈ 757 €
    const sections = page.getByRole("heading", { level: 2 });
    await expect(sections).toHaveText([
      "Maison & déco",
      "Lecture & carnets",
      "Musique",
      "Sport",
      "Non classé",
    ]);
    await expect(page.getByRole("img", { name: "Coup de cœur" })).toHaveCount(3);
    await expect(page.getByText("≈ 757 €").locator("visible=true").first()).toBeVisible();

    // Maison & déco + Seconde main OK → 2 articles
    await applyMaisonSecondeMain(page, false);
    await expect(cards(page)).toHaveCount(2);
    await expect(cards(page).nth(0)).toContainText("Fauteuil en rotin");
    await expect(cards(page).nth(1)).toContainText("Vase boule en céramique");
    await expect(page).toHaveURL(/c=.+&t=seconde-main-ok/);

    // + Coups de cœur → seulement le vase
    if (isMobile(page)) {
      await page.getByRole("button", { name: /^Filtres/ }).click();
      const sheet = page.getByRole("dialog", { name: "Filtres" });
      await sheet.getByRole("switch", { name: "Seulement les coups de cœur" }).click();
      await sheet.getByRole("button", { name: "Voir 1 article" }).click();
    } else {
      await page.getByRole("button", { name: "Coups de cœur", exact: true }).click();
    }
    await expect(cards(page)).toHaveCount(1);
    await expect(cards(page).first()).toContainText("Vase boule en céramique");
    await expect(page).toHaveURL(/fav=1/);

    // Fiche
    await cards(page).first().click();
    const sheet = page.getByRole("dialog", { name: "Vase boule en céramique" });
    await expect(sheet).toBeVisible();
    await expect(page).toHaveURL(/\/l\/mes-30-ans\/a\/[0-9a-f]+\?/);
    await expect(sheet.getByRole("link", { name: /Voir sur leboncoin\.fr/ })).toHaveAttribute(
      "rel",
      "noopener noreferrer nofollow",
    );

    // Trouver ailleurs : 9 liens, mots modifiables
    const elsewhere = sheet.getByRole("region", { name: "Trouver ailleurs" });
    const links = elsewhere.getByRole("link");
    await expect(links).toHaveCount(9);
    await expect(elsewhere.getByRole("link", { name: /leboncoin/ })).toHaveAttribute(
      "href",
      "https://www.leboncoin.fr/recherche?text=vase+boule+en+c%C3%A9ramique",
    );
    await elsewhere.getByLabel("Mots de la recherche").fill("vase boule");
    await expect(elsewhere.getByRole("link", { name: /Vinted/ })).toHaveAttribute(
      "href",
      "https://www.vinted.fr/catalog?search_text=vase+boule",
    );

    // Le bouton retour ferme la fiche sans quitter la liste
    await page.goBack();
    await expect(sheet).toBeHidden();
    await expect(page).toHaveURL(/\/l\/mes-30-ans\?.*fav=1/);
    await expect(cards(page)).toHaveCount(1);
  });

  test("lien direct vers une fiche : la liste en fond, la fiche ouverte", async ({ page, context }) => {
    await page.goto("/l/mes-30-ans");
    const href = await cards(page).first().getAttribute("href");
    expect(href).toMatch(/\/l\/mes-30-ans\/a\//);

    const other = await context.newPage();
    await other.goto(href!);
    await expect(other.getByRole("dialog", { name: "Lampe champignon en verre soufflé" })).toBeVisible();
    await expect(other).toHaveTitle("Lampe champignon en verre soufflé · Mes 30 ans · Envies");
    await other.getByRole("button", { name: "Fermer" }).locator("visible=true").first().click();
    await expect(other).toHaveURL(/\/l\/mes-30-ans$/);
    await expect(other.getByRole("heading", { level: 1 })).toHaveText("Mes 30 ans");
  });

  test("clavier : précédent / suivant, Échap", async ({ page }) => {
    test.skip(isMobile(page), "raccourcis clavier : desktop");
    await page.goto("/l/mes-30-ans");
    await cards(page).first().focus();
    await page.keyboard.press("Enter");
    const dialog = page.getByRole("dialog");
    await expect(dialog).toContainText("1 sur 12");
    await page.keyboard.press("ArrowRight");
    await expect(dialog).toContainText("2 sur 12");
    await expect(page.getByRole("dialog", { name: "Fauteuil en rotin" })).toBeVisible();
    await page.keyboard.press("ArrowLeft");
    await expect(dialog).toContainText("1 sur 12");
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(page).toHaveURL(/\/l\/mes-30-ans$/);
  });

  test("liste ou fiche inconnue : 404", async ({ page }) => {
    const res = await page.goto("/l/cette-liste-n-existe-pas");
    expect(res?.status()).toBe(404);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Introuvable");
    await expect(page.getByRole("link", { name: "Toutes les listes" })).toBeVisible();

    const item = await page.goto("/l/mes-30-ans/a/0000000000");
    expect(item?.status()).toBe(404);
  });

  test("ancien slug : redirection 308", async ({ request }) => {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    test.skip(!url || !key, "base locale requise");
    const db = createClient(url!, key!, { auth: { persistSession: false } });
    const { data: list } = await db.from("lists").select("id").eq("slug", "mes-30-ans").single();
    const oldSlug = `ancien-${Date.now()}`;
    await db.from("list_redirects").insert({ old_slug: oldSlug, list_id: list!.id });
    try {
      const res = await request.get(`/l/${oldSlug}?c=x`, { maxRedirects: 0 });
      expect(res.status()).toBe(308);
      expect(res.headers()["location"]).toMatch(/\/l\/mes-30-ans\?c=x$/);
    } finally {
      await db.from("list_redirects").delete().eq("old_slug", oldSlug);
    }
  });

  test("aucune violation axe : accueil, liste, fiche, filtres", async ({ page }) => {
    const check = async (where: string) => {
      const { violations } = await new AxeBuilder({ page }).analyze();
      expect(violations.map((v) => `${where} · ${v.id}: ${v.help}`)).toEqual([]);
    };
    await page.goto("/");
    await expect(page.getByRole("link", { name: /Mes 30 ans/ }).first()).toBeAttached();
    await check("accueil");

    await page.goto("/l/mes-30-ans");
    await check("liste");

    await cards(page).first().click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.waitForTimeout(400);
    await check("fiche");
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toBeHidden();

    if (isMobile(page)) {
      await page.getByRole("button", { name: /^Filtres/ }).click();
      await expect(page.getByRole("dialog", { name: "Filtres" })).toBeVisible();
      await page.waitForTimeout(400);
      await check("filtres");
    }
  });
});
