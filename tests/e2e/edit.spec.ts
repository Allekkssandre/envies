import AxeBuilder from "@axe-core/playwright";
import { createClient } from "@supabase/supabase-js";
import { expect, test, type Page } from "@playwright/test";
import { existsSync } from "node:fs";
import sharp from "sharp";
import { hashPassword } from "../../src/server/auth/password";
import type { Database } from "../../src/types/database";

// Mode édition sur une liste créée pour chaque test (les données de démo ne sont pas touchées).

if (existsSync(".env.local")) process.loadEnvFile(".env.local");
const SUPABASE_URL = process.env.SUPABASE_URL ?? "";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const db = createClient<Database>(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

test.skip(!SUPABASE_URL || !SERVICE_KEY, "base locale requise");

const isDesktop = (page: Page) => (page.viewportSize()?.width ?? 1440) >= 1024;

async function createTestList(name: string) {
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

async function unlock(page: Page, slug: string) {
  await page.goto(`/l/${slug}/edition`);
  const dialog = page.getByRole("dialog", { name: /^Modifier Test e2e/ });
  await dialog.getByLabel("Mot de passe pour modifier").fill("bouleau");
  await dialog.getByRole("button", { name: "Déverrouiller" }).click();
  // Déverrouillage + rendu de l'édition : ~2 s sur la base locale, davantage quand 4 workers tournent.
  await expect(page.getByText("Mode édition")).toBeVisible({ timeout: 15_000 });
}

const section = (page: Page, name: string) => page.getByRole("region", { name });
const cardTitles = (page: Page, name: string) => section(page, name).getByRole("heading", { level: 3 });
const inbox = (page: Page) => page.getByRole("region", { name: "À trier" });

/** Attend la fin des enregistrements (zone d'édition `aria-busy`) avant de recharger. */
async function reloadWhenSaved(page: Page) {
  await expect(page.locator('main[aria-busy="true"]')).toHaveCount(0, { timeout: 20_000 });
  await page.reload();
}

/** Ajoute des lignes : barre d'ajout (desktop) ou feuille « Ajouter » (mobile). */
async function addLines(page: Page, lines: string[]) {
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

test.describe("édition", () => {
  test("déverrouiller → ajouter un nom → photo → modifier → coup de cœur → supprimer → annuler", async ({
    page,
  }, info) => {
    test.setTimeout(90_000);
    const slug = await createTestList(info.project.name);
    await unlock(page, slug);

    // Ajouter un nom : « À trier » et « Non classé »
    await addLines(page, ["Un bon pour un massage"]);
    await expect(inbox(page)).toContainText("Un bon pour un massage");
    await expect(cardTitles(page, "Non classé")).toHaveText(["Un bon pour un massage"]);

    // Ajouter une photo
    // Photo de ~2 Mo (bruit, peu compressible) : dépasse la limite par défaut des actions (1 Mo).
    const noise = Buffer.alloc(1600 * 1200 * 3);
    for (let i = 0; i < noise.length; i++) noise[i] = (i * 2654435761) % 251;
    const png = await sharp(noise, { raw: { width: 1600, height: 1200, channels: 3 } })
      .jpeg({ quality: 95 })
      .toBuffer();
    expect(png.length).toBeGreaterThan(1_200_000);
    const fileInput = page.locator('input[type="file"][accept="image/*"]:not([capture])').first();
    await fileInput.setInputFiles({ name: "cadeau.jpg", mimeType: "image/jpeg", buffer: png });
    await expect(page.locator('img[src*="/item-images/"]').first()).toBeVisible({ timeout: 15_000 });

    // Modifier : prix et catégorie
    await page.getByRole("link", { name: "Modifier : Un bon pour un massage" }).last().click();
    const editor = page.getByRole("dialog", { name: /Modifier l'article/ });
    await expect(editor).toBeVisible();
    await editor.getByLabel("Prix").fill("12,5");
    if (isDesktop(page)) {
      await editor.getByLabel("Prix").blur();
      await expect(editor.getByText("Enregistré")).toBeVisible();
      await editor.getByRole("button", { name: "Maison & déco" }).click();
      await expect(editor.getByRole("button", { name: "Maison & déco" })).toHaveAttribute(
        "aria-pressed",
        "true",
      );
      await expect(editor.getByText("Enregistré")).toBeVisible();
      await editor.getByRole("button", { name: "Fermer" }).click();
    } else {
      await editor.getByRole("button", { name: "Maison & déco" }).click();
      await editor.getByRole("button", { name: "Enregistrer" }).click();
    }
    await expect(editor).toBeHidden();
    const maison = section(page, "Maison & déco");
    await expect(maison.getByRole("article").filter({ hasText: "Un bon pour un massage" })).toContainText(
      "12,50 €",
    );
    // Une catégorie donnée sort l'article de « À trier ».
    await expect(inbox(page)).not.toContainText("Un bon pour un massage");

    // Coup de cœur
    const card = maison.getByRole("article").filter({ hasText: "Un bon pour un massage" });
    await card.getByRole("button", { name: "Ajouter aux coups de cœur" }).click();
    await expect(card.getByRole("button", { name: "Retirer des coups de cœur" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    // Supprimer puis « Annuler » : même place
    const before = await cardTitles(page, "Maison & déco").allTextContents();
    if (isDesktop(page)) {
      await card.hover();
      await card.getByRole("button", { name: "Supprimer" }).click();
    } else {
      await card.getByRole("button", { name: "Actions" }).click();
      await page.getByRole("menuitem", { name: "Supprimer" }).click();
    }
    await expect(cardTitles(page, "Maison & déco")).not.toContainText(["Un bon pour un massage"]);
    await page.getByRole("button", { name: "Annuler" }).click();
    await expect(cardTitles(page, "Maison & déco")).toHaveText(before);

    // Tout persiste après rechargement
    await reloadWhenSaved(page);
    await expect(cardTitles(page, "Maison & déco")).toHaveText(before);
    const reloaded = section(page, "Maison & déco")
      .getByRole("article")
      .filter({ hasText: "Un bon pour un massage" });
    await expect(reloaded.getByRole("button", { name: "Retirer des coups de cœur" })).toBeVisible();
    await expect(reloaded).toContainText("12,50 €");
  });

  test("coller 5 liens : 5 cartes tout de suite, dans l'ordre après rechargement ; doublon signalé", async ({
    page,
  }, info) => {
    const slug = await createTestList(`${info.project.name}-liens`);
    await unlock(page, slug);
    const links = [1, 2, 3, 4, 5].map((n) => `https://www.etsy.com/fr/listing/${n}0000/objet-${n}`);

    if (isDesktop(page)) {
      // Collage réel dans le champ : on mesure le temps jusqu'aux 5 cartes affichées.
      const elapsed = await page.evaluate(async (text) => {
        const field = document.getElementById("add-field") as HTMLTextAreaElement;
        field.focus();
        const count = () => document.querySelectorAll('[aria-labelledby="inbox-title"] li').length;
        const start = performance.now();
        const data = new DataTransfer();
        data.setData("text/plain", text);
        field.dispatchEvent(
          new ClipboardEvent("paste", { clipboardData: data, bubbles: true, cancelable: true }),
        );
        while (count() < 5) await new Promise((r) => requestAnimationFrame(r));
        return performance.now() - start;
      }, links.join("\n"));
      expect(elapsed).toBeLessThan(300);
    } else {
      await addLines(page, links);
    }
    await expect(page.getByText("5 articles ajoutés")).toBeVisible();
    await expect(inbox(page).getByText("Récupération…")).toHaveCount(5);

    await reloadWhenSaved(page);
    const domains = await cardTitles(page, "Non classé").allTextContents();
    expect(domains).toHaveLength(5);
    const { data } = await db
      .from("items")
      .select("url")
      .eq("list_id", (await db.from("lists").select("id").eq("slug", slug).single()).data!.id)
      .not("url", "is", null)
      .order("position");
    expect(data!.map((r) => r.url)).toEqual(links);

    // Doublon : « Déjà dans la liste »
    await addLines(page, [links[2]!.replace("https://www.", "")]);
    await expect(page.getByText("Déjà dans la liste")).toBeVisible();
  });

  test("déplacer de « Maison & déco » vers « Lecture & carnets »", async ({ page }, info) => {
    const slug = await createTestList(`${info.project.name}-deplacer`);
    await unlock(page, slug);
    const card = section(page, "Maison & déco").getByRole("article").filter({ hasText: "Lampe champignon" });
    if (isDesktop(page)) {
      await card.hover();
      await card.getByRole("button", { name: "Déplacer", exact: true }).click();
      const panel = page.getByRole("dialog", { name: "Déplacer" });
      await panel.getByRole("radio", { name: "Lecture & carnets" }).click();
      await panel.getByRole("button", { name: "En premier" }).click();
    } else {
      await card.getByRole("button", { name: "Actions" }).click();
      await page.getByRole("menuitem", { name: "Déplacer" }).click();
      const sheet = page.getByRole("dialog", { name: "Déplacer" });
      await sheet.getByRole("radio", { name: "Lecture & carnets" }).click();
      await sheet.getByRole("button", { name: "En premier" }).click();
    }
    await expect(cardTitles(page, "Lecture & carnets")).toHaveText([
      "Lampe champignon",
      "Coffret BD",
      "Liseuse",
    ]);
    await expect(cardTitles(page, "Maison & déco")).toHaveText(["Fauteuil en rotin"]);
    await reloadWhenSaved(page);
    await expect(cardTitles(page, "Lecture & carnets")).toHaveText([
      "Lampe champignon",
      "Coffret BD",
      "Liseuse",
    ]);
  });

  test("glisser-déposer au clavier et sélection multiple", async ({ page }, info) => {
    test.skip(!isDesktop(page), "poignée et barre de sélection : desktop");
    const slug = await createTestList(`${info.project.name}-dnd`);
    await unlock(page, slug);

    // Clavier (dnd-kit) : Espace pour saisir, flèche, Espace pour déposer.
    const handle = page.getByRole("button", { name: "Déplacer : Lampe champignon" });
    // Tant que la page n'est pas interactive, Espace ne saisit rien : on attend l'annonce.
    await expect(async () => {
      await handle.focus();
      await page.keyboard.press("Space");
      await expect(page.getByText(/^Lampe champignon (saisi|au-dessus de)/)).toBeAttached({ timeout: 1000 });
    }).toPass({ timeout: 15_000 });
    await expect(async () => {
      await page.keyboard.press("ArrowRight");
      await expect(page.getByText("Lampe champignon au-dessus de Fauteuil en rotin.")).toBeAttached({
        timeout: 1000,
      });
    }).toPass({ timeout: 15_000 });
    await page.keyboard.press("Space");
    await expect(cardTitles(page, "Maison & déco")).toHaveText(["Fauteuil en rotin", "Lampe champignon"]);

    // Sélection de 2 cartes, coup de cœur groupé
    await page.getByRole("checkbox", { name: "Sélectionner : Coffret BD" }).click();
    await page.getByRole("checkbox", { name: "Sélectionner : Liseuse" }).click();
    const bar = page.getByRole("toolbar", { name: "Sélection" });
    await expect(bar).toContainText("2 sélectionnés");
    await bar.getByRole("button", { name: "Coup de cœur" }).click();
    const lecture = section(page, "Lecture & carnets");
    await expect(lecture.getByRole("button", { name: "Retirer des coups de cœur" })).toHaveCount(2);
    await page.keyboard.press("Escape");
    await expect(bar).toBeHidden();
  });

  test("aucune violation axe : édition, panneau, ajout", async ({ page }, info) => {
    const slug = await createTestList(`${info.project.name}-axe`);
    await unlock(page, slug);
    await addLines(page, ["Un carnet", "https://www.fnac.com/a1/objet"]);
    await expect(inbox(page)).toContainText("Un carnet");
    const check = async (where: string) => {
      const { violations } = await new AxeBuilder({ page }).analyze();
      expect(violations.map((v) => `${where} · ${v.id}: ${v.help} (${v.nodes.length})`)).toEqual([]);
    };
    await check("édition");
    await page.getByRole("link", { name: "Modifier : Lampe champignon" }).click();
    await expect(page.getByRole("dialog", { name: /Modifier l'article/ })).toBeVisible();
    await page.waitForTimeout(400);
    await check("panneau");
    if (!isDesktop(page)) {
      await page.getByRole("button", { name: "Annuler" }).click();
      await expect(page.getByRole("dialog", { name: /Modifier l'article/ })).toBeHidden();
      await page.getByRole("button", { name: "Ajouter", exact: true }).click();
      await expect(page.getByRole("dialog", { name: "Ajouter" })).toBeVisible();
      await page.waitForTimeout(400);
      await check("feuille d'ajout");
    }
  });
});
