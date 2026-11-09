import { expect, test } from "@playwright/test";

import {
  ADMIN,
  confirmBooking,
  login,
  PASSWORD,
  pickServiceAndDate,
  register,
  slotButtons,
  torontoDate,
  uniqueEmail,
} from "./helpers";

test("1. un visiteur s'inscrit, se connecte, réserve et voit son rendez-vous", async ({ page }) => {
  const email = uniqueEmail("parcours1");
  await register(page, email);

  // Déconnexion puis reconnexion, comme un vrai visiteur qui revient.
  await page.getByRole("button", { name: /Ouvrir le menu/ }).click();
  await page.getByRole("button", { name: "Déconnexion" }).click();
  await login(page, email, PASSWORD);

  await pickServiceAndDate(page);
  const slot = slotButtons(page).first();
  const time = (await slot.textContent())!.trim();
  await slot.click();
  await expect(page.getByRole("heading", { name: "4. Vérifiez et confirmez" })).toBeVisible();
  await confirmBooking(page);

  await expect(page.getByRole("heading", { name: "Votre rendez-vous est confirmé" })).toBeVisible();
  await page.getByRole("link", { name: "Voir mes rendez-vous" }).click();
  await expect(page).toHaveURL(/\/mes-rendez-vous/);
  const card = page.locator("article").first();
  await expect(card).toContainText("Confirmé");
  await expect(card).toContainText(time);
});

test("2. un client annule un rendez-vous et le créneau redevient disponible", async ({ page }) => {
  await register(page, uniqueEmail("parcours2"));
  // Plus de 24 h à l'avance, sinon l'annulation est refusée (règle des 24 h).
  const date = await pickServiceAndDate(page, { minDate: torontoDate(3) });
  const slot = slotButtons(page).first();
  const time = (await slot.textContent())!.trim();
  await slot.click();
  await confirmBooking(page);
  await expect(page.getByRole("heading", { name: "Votre rendez-vous est confirmé" })).toBeVisible();

  // Le créneau n'est plus proposé.
  await page.getByRole("button", { name: "Réserver autre chose" }).click();
  await pickServiceAndDate(page, { minDate: date });
  await expect(slotButtons(page).filter({ hasText: new RegExp(`^${time}$`) })).toHaveCount(0);

  await page.goto("/mes-rendez-vous");
  await page.locator("article").first().getByRole("button", { name: "Annuler" }).click();
  await page.getByRole("button", { name: "Oui, annuler" }).click();
  await expect(page.getByText(/Rendez-vous annulé/)).toBeVisible();

  // De retour dans le parcours, le créneau est de nouveau libre.
  await pickServiceAndDate(page, { minDate: date });
  await expect(slotButtons(page).filter({ hasText: new RegExp(`^${time}$`) })).toHaveCount(1);
});

test("3. deux navigateurs visent le même créneau : le second voit l'erreur", async ({
  browser,
}) => {
  const alice = await (await browser.newContext()).newPage();
  const bob = await (await browser.newContext()).newPage();
  await register(alice, uniqueEmail("alice"), "Alice");
  await register(bob, uniqueEmail("bob"), "Bob");

  const date = await pickServiceAndDate(alice, { minDate: torontoDate(2) });
  await pickServiceAndDate(bob, { minDate: date });
  const time = (await slotButtons(alice).first().textContent())!.trim();
  await slotButtons(alice).first().click();
  await slotButtons(bob)
    .filter({ hasText: new RegExp(`^${time}$`) })
    .click();

  await confirmBooking(alice);
  await expect(
    alice.getByRole("heading", { name: "Votre rendez-vous est confirmé" }),
  ).toBeVisible();

  await confirmBooking(bob);
  await expect(
    bob.getByText("Ce créneau vient d'être pris. Choisissez-en un autre."),
  ).toBeVisible();
  // Bob revient à l'étape des créneaux avec ses choix conservés, et en prend un autre.
  await expect(bob.getByRole("heading", { name: "3. Choisissez un créneau" })).toBeVisible();
  await expect(slotButtons(bob).filter({ hasText: new RegExp(`^${time}$`) })).toHaveCount(0);
  await slotButtons(bob).first().click();
  await confirmBooking(bob);
  await expect(bob.getByRole("heading", { name: "Votre rendez-vous est confirmé" })).toBeVisible();
});

test("4. l'administrateur crée un service, définit ses heures et annule une réservation", async ({
  browser,
}) => {
  const serviceName = `Service E2E ${Date.now()}`;
  const adminPage = await (await browser.newContext()).newPage();
  await login(adminPage, ADMIN.email, ADMIN.password);
  await expect(adminPage).toHaveURL(/\/admin/);

  // Création d'un service.
  await adminPage.goto("/admin/services");
  await adminPage.getByRole("button", { name: "Nouveau service" }).click();
  const dialog = adminPage.getByRole("dialog");
  await dialog.getByLabel("Nom").fill(serviceName);
  await dialog.getByLabel("Durée (minutes)").fill("30");
  await dialog.getByLabel("Prix ($ CAD)").fill("25");
  await dialog.getByRole("button", { name: "Enregistrer" }).click();
  await expect(adminPage.getByText(serviceName)).toBeVisible();

  // Heures d'ouverture : on ajoute une plage le samedi, puis on la retire.
  await adminPage.goto("/admin/horaires");
  const saturday = adminPage.locator("li", { hasText: "Samedi" });
  await saturday.getByRole("button", { name: "Ajouter une plage" }).click();
  await adminPage.getByRole("button", { name: "Enregistrer les heures" }).click();
  await expect(adminPage.getByText("Heures d'ouverture enregistrées.")).toBeVisible();
  await saturday.getByRole("button", { name: /Supprimer la plage/ }).click();
  await adminPage.getByRole("button", { name: "Enregistrer les heures" }).click();
  await expect(saturday.getByText("Fermé")).toBeVisible();

  // Un client réserve le nouveau service…
  const clientPage = await (await browser.newContext()).newPage();
  await register(clientPage, uniqueEmail("parcours4"));
  await pickServiceAndDate(clientPage, { serviceName });
  await slotButtons(clientPage).first().click();
  await confirmBooking(clientPage);
  await expect(
    clientPage.getByRole("heading", { name: "Votre rendez-vous est confirmé" }),
  ).toBeVisible();

  // …et l'administrateur annule cette réservation avec un motif.
  await adminPage.goto("/admin/reservations");
  const card = adminPage.locator("article", { hasText: serviceName }).first();
  await card.getByRole("button", { name: "Annuler" }).click();
  await adminPage.getByLabel(/Motif/).fill("Fermeture imprévue");
  await adminPage.getByRole("button", { name: "Annuler la réservation" }).click();
  await expect(adminPage.getByText(/Le client a été prévenu/)).toBeVisible();
  await expect(card).toContainText("Annulé par le commerce");

  // Ménage : le service de test est désactivé.
  await adminPage.goto("/admin/services");
  await adminPage
    .locator("li", { hasText: serviceName })
    .getByRole("button", { name: "Désactiver" })
    .click();
  await expect(adminPage.locator("li", { hasText: serviceName })).toContainText("Désactivé");
});
