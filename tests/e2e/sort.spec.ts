import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { hashPassword } from "../../src/server/auth/password";
import { db, isDesktop, skipWithoutDb, unlock } from "./helpers";

// Tri rapide : 5 articles à trier, 4 catégories, 4 tags (comme la maquette TriV4).

skipWithoutDb();

async function createSortList(name: string) {
  const slug = `test-e2e-tri-${name}-${Date.now()}`;
  const { data: list } = await db
    .from("lists")
    .insert({ slug, title: `Test e2e édition tri ${name}`, owner_name: "Tess" })
    .select("id")
    .single();
  const listId = list!.id;
  await db.from("list_secrets").insert({
    list_id: listId,
    password_hash: await hashPassword("bouleau"),
    edit_key: `TRI${Date.now()}${Math.floor(Math.random() * 1000)}`,
  });
  const { data: cats } = await db
    .from("categories")
    .insert(
      ["Maison & déco", "Lecture & carnets", "Musique", "Sport"].map((n, i) => ({
        list_id: listId,
        name: n,
        position: `a${i}`,
      })),
    )
    .select("id, name");
  const cat = (n: string) => cats!.find((c) => c.name === n)!.id;
  const { data: tags } = await db
    .from("tags")
    .insert(
      (
        [
          ["Priorité", "rouille"],
          ["Petit prix", "miel"],
          ["Envie folle", "prune"],
          ["Seconde main OK", "olive"],
        ] as const
      ).map(([n, color], i) => ({ list_id: listId, name: n, color, position: `a${i}` })),
    )
    .select("id, name");
  const base = Date.now() - 60 * 60 * 1000;
  const titles = ["Lampe champignon", "Carnet ligné", "Vinyle", "Tapis de yoga", "Carnet de croquis"];
  await db.from("items").insert(
    titles.map((title, i) => ({
      list_id: listId,
      title,
      position: `Z${i}`,
      created_at: new Date(base + i * 60_000).toISOString(),
      // Mêmes colonnes sur chaque ligne (une colonne absente d'une ligne vaudrait null).
      suggested_category_id: i === 0 ? cat("Maison & déco") : null,
      meta: i === 0 ? { breadcrumb: ["Accueil", "Maison", "Luminaires"] } : {},
      price_cents: i === 0 ? 8900 : null,
      currency: i === 0 ? "EUR" : null,
    })),
  );
  // Un article déjà rangé : il n'entre pas dans le tri.
  await db.from("items").insert({
    list_id: listId,
    title: "Déjà rangé",
    position: "a0",
    category_id: cat("Sport"),
    sorted_at: new Date().toISOString(),
  });
  return { slug, listId, cat, tag: (n: string) => tags!.find((t) => t.name === n)!.id };
}

async function row(listId: string, title: string) {
  const { data } = await db
    .from("items")
    .select("id, title, category_id, sorted_at, is_favorite, item_tags(tag_id)")
    .eq("list_id", listId)
    .eq("title", title)
    .maybeSingle();
  return data;
}

/** Sans disposition réelle du clavier : la légende suit la langue du navigateur. */
async function withoutLayoutMap(page: Page) {
  await page.addInitScript(() => {
    Object.defineProperty(Navigator.prototype, "keyboard", { get: () => undefined });
  });
}

const card = (page: Page) => page.getByRole("article").first();

test("desktop : trier 5 articles au clavier seul, en moins de 30 s", async ({ page }) => {
  test.skip(!isDesktop(page), "clavier : desktop");
  test.setTimeout(90_000);
  await withoutLayoutMap(page);
  const { slug, listId, cat, tag } = await createSortList("clavier");
  await unlock(page, slug);
  await page.getByRole("link", { name: "Trier maintenant" }).click();
  await expect(page).toHaveURL(new RegExp(`/l/${slug}/edition/trier$`));
  await expect(page.getByRole("heading", { name: "Tri rapide" })).toBeVisible({ timeout: 15_000 });

  // Légende AZERTY (navigateur en français, sans disposition connue).
  const legend = page.getByRole("note", { name: "Raccourcis clavier" });
  await expect(legend).toContainText("A Z E R");
  await expect(legend).toContainText("1–4");

  const start = Date.now();
  const progress = page.getByRole("progressbar", { name: "Progression du tri" });

  // 1 : catégorie proposée d'après la page, présélectionnée → Entrée.
  await expect(card(page)).toHaveAccessibleName("Lampe champignon");
  await expect(page.getByText("proposée d'après la page : Maison › Luminaires")).toBeVisible();
  await expect(page.getByRole("button", { name: /Maison & déco/ })).toHaveAttribute("aria-pressed", "true");
  // Les raccourcis attendent que la page soit interactive.
  await expect(async () => {
    await page.keyboard.press("Enter");
    await expect(progress).toHaveAttribute("aria-valuenow", "2", { timeout: 1000 });
  }).toPass({ timeout: 15_000 });

  // 2 : catégorie 2, premier tag (touche Q physique = A en AZERTY), coup de cœur, valider.
  await expect(card(page)).toHaveAccessibleName("Carnet ligné");
  await page.keyboard.press("Digit2");
  await page.keyboard.press("KeyQ");
  await page.keyboard.press("KeyC");
  await expect(page.getByRole("button", { name: /Lecture & carnets/ })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.getByRole("button", { name: /Priorité/ })).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.press("Enter");

  // 3 : passer.
  await expect(card(page)).toHaveAccessibleName("Vinyle");
  await page.keyboard.press("ArrowRight");

  // 4 : précédent, puis catégorie 3 et valider.
  await expect(card(page)).toHaveAccessibleName("Tapis de yoga");
  await page.keyboard.press("ArrowLeft");
  await expect(card(page)).toHaveAccessibleName("Vinyle");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Digit3");
  await page.keyboard.press("Enter");

  // 5 : nom modifié en ligne ; les raccourcis ne se déclenchent pas pendant la saisie.
  await expect(card(page)).toHaveAccessibleName("Carnet de croquis");
  const name = page.getByRole("textbox", { name: "Nom", exact: true });
  await name.focus();
  await page.keyboard.press("ControlOrMeta+A");
  await page.keyboard.type("Carnet A5 cuir");
  await expect(name).toHaveValue("Carnet A5 cuir");
  await expect(page.getByRole("button", { name: /Coup de cœur/ })).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByRole("button", { name: /Lecture & carnets/ })).toHaveAttribute(
    "aria-pressed",
    "false",
  );
  await page.keyboard.press("Escape");
  await page.keyboard.press("Digit2");
  await page.keyboard.press("Enter");

  // Fin : retour à l'édition, « 4 articles rangés ».
  await expect(page).toHaveURL(new RegExp(`/l/${slug}/edition$`));
  await expect(page.getByText("4 articles rangés")).toBeVisible();
  expect(Date.now() - start).toBeLessThan(30_000);

  await expect
    .poll(async () => (await row(listId, "Carnet A5 cuir"))?.sorted_at ?? null, { timeout: 10_000 })
    .not.toBeNull();
  const carnet = await row(listId, "Carnet ligné");
  expect(carnet).toMatchObject({ category_id: cat("Lecture & carnets"), is_favorite: true });
  expect(carnet!.item_tags.map((t) => t.tag_id)).toEqual([tag("Priorité")]);
  expect(await row(listId, "Lampe champignon")).toMatchObject({ category_id: cat("Maison & déco") });
  expect((await row(listId, "Vinyle"))!.sorted_at).toBeNull();
  expect(await row(listId, "Tapis de yoga")).toMatchObject({ category_id: cat("Musique") });
  expect(await row(listId, "Carnet A5 cuir")).toMatchObject({ category_id: cat("Lecture & carnets") });
});

test("desktop : légende QWERTY, nouvelle catégorie, supprimer et annuler, quitter", async ({
  browser,
}, info) => {
  test.skip(info.project.name !== "desktop", "clavier : desktop");
  test.setTimeout(90_000);
  const context = await browser.newContext({ locale: "en-US", viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  await withoutLayoutMap(page);
  const { slug, listId } = await createSortList("qwerty");
  await unlock(page, slug);
  await page.goto(`/l/${slug}/edition/trier`);
  const legend = page.getByRole("note", { name: "Raccourcis clavier" });
  await expect(legend).toContainText("Q W E R");

  // Nouvelle catégorie en ligne (N), créée et sélectionnée.
  await expect(async () => {
    await page.keyboard.press("KeyN");
    await expect(page.getByLabel("Nouvelle catégorie")).toBeFocused({ timeout: 1000 });
  }).toPass({ timeout: 15_000 });
  await page.keyboard.type("Luminaires");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("button", { name: /Luminaires/ })).toHaveAttribute("aria-pressed", "true", {
    timeout: 15_000,
  });

  // Suppr : supprimé, puis « Annuler » le remet dans la pile.
  await page.keyboard.press("Delete");
  await expect(card(page)).toHaveAccessibleName("Carnet ligné");
  await page.getByRole("button", { name: "Annuler" }).click();
  await expect(card(page)).toHaveAccessibleName("Lampe champignon");
  await expect.poll(async () => (await row(listId, "Lampe champignon"))?.id).toBeTruthy();

  const { violations } = await new AxeBuilder({ page }).analyze();
  expect(violations.map((v) => `${v.id}: ${v.help} (${v.nodes.length})`)).toEqual([]);

  // Échap : quitter sans rien ranger.
  await page.keyboard.press("Escape");
  await expect(page).toHaveURL(new RegExp(`/l/${slug}/edition$`));
  await context.close();
});

test("mobile : boutons, cœur, glisser pour passer ou valider", async ({ page }) => {
  test.skip(isDesktop(page), "mobile");
  test.setTimeout(90_000);
  const { slug, listId, cat } = await createSortList("mobile");
  await unlock(page, slug);
  await page.getByRole("link", { name: "Trier", exact: true }).click();
  await expect(page.getByRole("button", { name: "Valider" })).toBeVisible({ timeout: 15_000 });

  // 1 : catégorie proposée présélectionnée → Valider.
  await expect(page.getByText("proposée d'après la page : Maison › Luminaires")).toBeVisible();
  await page.getByRole("button", { name: "Valider" }).click();

  // 2 : catégorie, tag, cœur → Valider.
  await expect(card(page)).toHaveAccessibleName("Carnet ligné");
  await page.getByRole("button", { name: "Lecture & carnets" }).click();
  await page.getByRole("button", { name: "Envie folle" }).click();
  await page.getByRole("button", { name: "Coup de cœur" }).click();
  await page.getByRole("button", { name: "Valider" }).click();

  // 3 : Passer.
  await expect(card(page)).toHaveAccessibleName("Vinyle");
  await page.getByRole("button", { name: "Passer" }).click();

  // 4 : glisser à droite = valider ; 5 : glisser à gauche = passer.
  const swipe = async (dx: number) => {
    const box = (await card(page).boundingBox())!;
    const y = box.y + box.height / 2;
    const x = box.x + box.width / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    for (let i = 1; i <= 8; i++) await page.mouse.move(x + (dx * i) / 8, y);
    await page.mouse.up();
  };
  await expect(card(page)).toHaveAccessibleName("Tapis de yoga");
  await page.getByRole("button", { name: "Sport" }).click();
  await swipe(240);
  await expect(card(page)).toHaveAccessibleName("Carnet de croquis");
  await swipe(-240);

  await expect(page).toHaveURL(new RegExp(`/l/${slug}/edition$`));
  await expect(page.getByText("3 articles rangés")).toBeVisible();
  await expect.poll(async () => (await row(listId, "Tapis de yoga"))?.category_id).toBe(cat("Sport"));
  expect(await row(listId, "Carnet ligné")).toMatchObject({
    is_favorite: true,
    category_id: cat("Lecture & carnets"),
  });
  expect((await row(listId, "Carnet de croquis"))!.sorted_at).toBeNull();
});

test("?ids= trie une sélection ; « Rien à trier. » quand il n'y a rien", async ({ page }, info) => {
  test.setTimeout(60_000);
  const { slug, listId } = await createSortList(`${info.project.name}-ids`);
  await unlock(page, slug);
  const { data } = await db
    .from("items")
    .select("ref, title")
    .eq("list_id", listId)
    .in("title", ["Vinyle", "Lampe champignon"]);
  const refs = ["Vinyle", "Lampe champignon"].map((t) => data!.find((r) => r.title === t)!.ref);
  await page.goto(`/l/${slug}/edition/trier?ids=${refs.join(",")}`);
  await expect(page.getByText("1 sur 2")).toBeVisible({ timeout: 15_000 });
  await expect(card(page)).toHaveAccessibleName("Vinyle");

  await db.from("items").update({ sorted_at: new Date().toISOString() }).eq("list_id", listId);
  await page.goto(`/l/${slug}/edition/trier`);
  await expect(page.getByText("Rien à trier.")).toBeVisible({ timeout: 15_000 });
  await expect(page).toHaveURL(new RegExp(`/l/${slug}/edition$`));
});
