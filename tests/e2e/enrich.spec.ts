import { expect, test } from "@playwright/test";
import { addLines, createTestList, db, inbox, skipWithoutDb, unlock } from "./helpers";

// Extraction depuis un lien, de bout en bout : les pages viennent du serveur local de fixtures
// (tests/e2e/fixture-server.mjs), que seul le serveur de test a le droit de lire.

skipWithoutDb();

const FIXTURES = "http://127.0.0.1:4599";

test("un lien se remplit sans recharger ; photos trouvées ; relire la page ; lien bloqué", async ({
  page,
}, info) => {
  test.setTimeout(90_000);
  const slug = await createTestList(`${info.project.name}-extraction`);
  await unlock(page, slug);

  // Repère : si la page se recharge, il disparaît.
  await page.evaluate(() => ((window as unknown as { __sansRecharger: boolean }).__sansRecharger = true));

  const url = `${FIXTURES}/produit/lampe?t=${info.project.name}-${Date.now()}`;
  await addLines(page, [url]);
  const card = inbox(page).getByRole("listitem").filter({ hasText: "Lampe Tolomeo" });
  // La carte passe de « Récupération… » au produit (temps réel), sans recharger. Le critère des
  // 10 s se vérifie en preview ; ici la base locale est partagée par 4 navigateurs à la fois.
  await expect(card).toBeVisible({ timeout: 20_000 });
  await expect(card).toContainText(/89\s€/);
  const photo = card.locator('img[src*="/item-images/"]');
  await expect(photo).toBeVisible();
  // Produit sur fond blanc : fondu dans le fond studio.
  await expect(photo).toHaveClass(/mix-blend-multiply/);
  expect(
    await page.evaluate(() => (window as unknown as { __sansRecharger?: boolean }).__sansRecharger),
  ).toBe(true);

  // Catégorie proposée d'après le fil d'Ariane (Maison › Luminaires), jamais appliquée seule.
  const { data: row } = await db
    .from("items")
    .select("suggested_category_id, category_id, categories!items_suggested_category_id_fkey(name)")
    .eq("url", url)
    .single();
  expect(row?.category_id).toBeNull();
  expect((row?.categories as { name: string } | null)?.name).toBe("Maison & déco");

  // Lien bloqué : « Rien trouvé · compléter ».
  await addLines(page, [`${FIXTURES}/bloque/${info.project.name}`]);
  await expect(inbox(page).getByText("Rien trouvé · compléter")).toBeVisible({ timeout: 10_000 });

  // Fiche : photos trouvées sur la page, la courante entourée ; en choisir une autre.
  await page.getByRole("link", { name: "Modifier : Lampe Tolomeo" }).first().click();
  const editor = page.getByRole("dialog", { name: /Modifier l'article/ });
  await expect(editor).toBeVisible({ timeout: 15_000 });
  const found = editor.getByRole("group", { name: "Trouvées sur la page" });
  await expect(found.getByRole("button")).toHaveCount(2);
  await expect(found.getByRole("button", { name: "Photo 1" })).toHaveAttribute("aria-pressed", "true");
  await found.getByRole("button", { name: "Photo 2" }).click();
  await expect(found.getByRole("button", { name: "Photo 2" })).toHaveAttribute("aria-pressed", "true", {
    timeout: 15_000,
  });

  // Relire la page : le prix a baissé.
  await editor.getByRole("button", { name: "Relire la page du lien" }).click();
  await expect(page.getByText(/Prix mis à jour : 79\s€ \(avant 89\s€\)/)).toBeVisible({ timeout: 15_000 });
  await expect(editor.getByLabel("Prix")).toHaveValue("79");
});
