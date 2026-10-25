import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test.describe("socle", () => {
  test("la page /design affiche le système visuel", async ({ page }) => {
    const response = await page.goto("/design");
    expect(response?.status()).toBe(200);

    await expect(page).toHaveTitle("Système visuel · Envies");
    await expect(page.locator("html")).toHaveAttribute("lang", "fr");
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Fondations");
    await expect(page.getByRole("heading", { level: 2, name: "Les composants" })).toBeVisible();

    // Polices et tokens appliqués
    const bodyFont = await page.evaluate(() => getComputedStyle(document.body).fontFamily);
    expect(bodyFont).toContain("Instrument");
    const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    expect(bg).toBe("rgb(243, 237, 226)");

    // Pas de défilement horizontal
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test("les composants interactifs répondent", async ({ page }) => {
    await page.goto("/design");
    const chip = page.getByRole("button", { name: "Tout 24" });
    await expect(chip).toHaveAttribute("aria-pressed", "false");
    await chip.click();
    await expect(chip).toHaveAttribute("aria-pressed", "true");

    const toggle = page.getByRole("switch", { name: "Ranger directement" });
    await expect(toggle).toHaveAttribute("aria-checked", "false");
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-checked", "true");

    await page
      .getByRole("button", { name: "Afficher le mot de passe" })
      .or(page.getByRole("button", { name: "Masquer le mot de passe" }))
      .click();
  });

  test("aucune violation d'accessibilité détectée par axe", async ({ page }) => {
    await page.goto("/design");
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
  });
});
