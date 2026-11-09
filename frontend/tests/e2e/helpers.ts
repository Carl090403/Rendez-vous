import { expect, type Page } from "@playwright/test";

export const ADMIN = {
  email: process.env.E2E_ADMIN_EMAIL ?? "admin@exemple.com",
  password: process.env.E2E_ADMIN_PASSWORD ?? "Admin-Demo-2026",
};

export const PASSWORD = "Parcours-E2E-2026";

export function uniqueEmail(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@exemple.com`;
}

/** Date AAAA-MM-JJ à Toronto, décalée de `days` jours. */
export function torontoDate(days = 0): string {
  const date = new Date(Date.now() + days * 86_400_000);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Toronto" }).format(date);
}

export async function register(page: Page, email: string, firstName = "Alex"): Promise<void> {
  await page.goto("/inscription");
  await page.getByLabel("Prénom").fill(firstName);
  await page.getByLabel("Nom", { exact: true }).fill("Tremblay");
  await page.getByLabel("Courriel").fill(email);
  await page.getByLabel("Mot de passe", { exact: true }).fill(PASSWORD);
  await page.getByLabel("Confirmer le mot de passe").fill(PASSWORD);
  await page.getByRole("button", { name: "Créer mon compte" }).click();
  await expect(page).toHaveURL(/\/reserver/);
}

export async function login(page: Page, email: string, password: string): Promise<void> {
  await page.goto("/connexion");
  await page.getByLabel("Courriel").fill(email);
  await page.getByLabel("Mot de passe").fill(password);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page).not.toHaveURL(/\/connexion/);
}

/**
 * Parcours /reserver : choisit le premier service (ou celui nommé), puis la première date
 * disponible à partir de `minDate`, et retourne la date choisie.
 */
export async function pickServiceAndDate(
  page: Page,
  { serviceName, minDate = torontoDate() }: { serviceName?: string; minDate?: string } = {},
): Promise<string> {
  await page.goto("/reserver");
  const serviceButtons = page.locator("main ul button[aria-pressed]");
  await expect(serviceButtons.first()).toBeVisible();
  if (serviceName) await serviceButtons.filter({ hasText: serviceName }).first().click();
  else await serviceButtons.first().click();

  // On attend que le calendrier ait chargé les disponibilités, en changeant de mois au besoin.
  for (let attempt = 0; attempt < 3; attempt++) {
    const grid = page.getByRole("grid", { name: "Choisir une date" });
    await expect(grid).toBeVisible();
    await expect(grid.locator(".animate-pulse")).toHaveCount(0, { timeout: 20_000 });
    const dates = await grid
      .locator("button[data-date]:enabled")
      .evaluateAll((els) => els.map((el) => el.getAttribute("data-date") ?? ""));
    const chosen = dates.find((d) => d >= minDate);
    if (chosen) {
      await grid.locator(`button[data-date="${chosen}"]`).click();
      return chosen;
    }
    await page.getByRole("button", { name: "Mois suivant" }).click();
  }
  throw new Error(`Aucune date disponible à partir du ${minDate}`);
}

export function slotButtons(page: Page) {
  return page.getByRole("list", { name: "Créneaux disponibles" }).getByRole("button");
}

export async function confirmBooking(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Confirmer la réservation" }).click();
}
