import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { normalizeUrl } from "../../src/lib/normalizeUrl";
import { createTestList, db, inbox, skipWithoutDb, unlock } from "./helpers";

// Jalon 8 : cible de partage, manifeste, aperçus de lien.
skipWithoutDb();

test.describe("finitions", () => {
  test("partage sans liste déverrouillée : message d'aide", async ({ page }) => {
    await page.goto(`/partage?title=Lampe&text=${encodeURIComponent("Une lampe https://exemple.fr/lampe")}`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Ajouter à une liste");
    await expect(page.getByText("https://exemple.fr/lampe")).toBeVisible();
    await expect(
      page.getByText("Ouvrez d'abord une de vos listes en mode édition sur ce téléphone."),
    ).toBeVisible();
    const { violations } = await new AxeBuilder({ page }).analyze();
    expect(violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
  });

  test("partage vide : retour à l'accueil", async ({ page }) => {
    await page.goto("/partage");
    await expect(page).toHaveURL(/\/$/);
  });

  test("partage d'un nom vers une liste déverrouillée : ajouté dans « À trier »", async ({ page }, info) => {
    test.setTimeout(60_000);
    const slug = await createTestList(`${info.project.name}-partage`);
    await unlock(page, slug);

    await page.goto(`/partage?title=${encodeURIComponent("Carafe en verre soufflé")}`);
    const choice = page.getByRole("button", { name: /Test e2e édition .*partage/ });
    await expect(choice).toBeVisible();
    const { violations } = await new AxeBuilder({ page }).analyze();
    expect(violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);

    await choice.click();
    await expect(page).toHaveURL(new RegExp(`/l/${slug}/edition`), { timeout: 15_000 });
    await expect(inbox(page)).toContainText("Carafe en verre soufflé");

    const { data: list } = await db.from("lists").select("id").eq("slug", slug).single();
    const { data: items } = await db
      .from("items")
      .select("title, sorted_at")
      .eq("list_id", list!.id)
      .eq("title", "Carafe en verre soufflé");
    expect(items).toHaveLength(1);
    expect(items![0].sorted_at).toBeNull();
  });

  test("bouton de favoris : complète un article que la boutique refusait de montrer", async ({
    page,
  }, info) => {
    test.setTimeout(60_000);
    const slug = await createTestList(`${info.project.name}-favori`);
    await unlock(page, slug);
    const { data: list } = await db.from("lists").select("id").eq("slug", slug).single();
    const shopUrl = `https://boutique.exemple/produits/lampe-champignon-${info.project.name}`;
    const n = normalizeUrl(shopUrl)!;
    // Article ajouté par son lien, page refusée au serveur : nom tiré de l'adresse, ni prix ni photo.
    await db.from("items").insert({
      list_id: list!.id,
      title: "Lampe champignon",
      url: n.url,
      url_key: n.urlKey,
      domain: n.domain,
      position: "a0",
      fetch_status: "failed",
      fetch_error: "blocked",
      meta: { provisionalTitle: "Lampe champignon" },
    });

    const params = new URLSearchParams({
      url: shopUrl,
      title: "Lampe champignon en céramique | Boutique",
      price: "35,90",
      currency: "EUR",
      image: "",
      depuis: "favori",
    });
    await page.goto(`/partage?${params}`);
    // Une seule liste ouverte sur l'appareil : ajout sans choix, puis retour à la liste.
    await expect(page).toHaveURL(new RegExp(`/l/${slug}/edition`), { timeout: 15_000 });
    await expect(inbox(page)).toContainText("Lampe champignon en céramique");

    const { data: items } = await db
      .from("items")
      .select("title, price_cents, currency, price_source, fetch_status")
      .eq("list_id", list!.id)
      .eq("url_key", n.urlKey);
    expect(items).toEqual([
      {
        title: "Lampe champignon en céramique",
        price_cents: 3590,
        currency: "EUR",
        price_source: "page",
        fetch_status: "partial",
      },
    ]);
  });

  test("manifeste, icônes et images d'aperçu", async ({ request, page }) => {
    const manifest = await (await request.get("/manifest.webmanifest")).json();
    expect(manifest.share_target).toMatchObject({ action: "/partage", method: "GET" });
    for (const icon of manifest.icons as { src: string }[]) {
      expect((await request.get(icon.src)).status()).toBe(200);
    }

    await page.goto("/l/mes-30-ans");
    const ogImage = await page.locator('meta[property="og:image"]').first().getAttribute("content");
    expect(ogImage).toBeTruthy();
    const image = await request.get(new URL(ogImage!).pathname);
    expect(image.status()).toBe(200);
    expect(image.headers()["content-type"]).toContain("image/png");
    await expect(page.locator('meta[property="og:title"]')).toHaveAttribute("content", /liste de/);
  });
});
