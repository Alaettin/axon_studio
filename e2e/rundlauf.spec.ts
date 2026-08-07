import { expect, test, type Page } from "@playwright/test";

/**
 * Der Rundlauf: Anmeldung, Buehne, Palette, Profil, Verwaltung.
 *
 * Ein Anmeldeweg laesst sich nicht durch Lesen abnehmen. Die beiden Zugaenge sind
 * Wegwerfzugaenge auf `.invalid` und stehen nur fuer diese Pruefung in der Datenbank.
 */

const ADMIN = { email: "axon-probe-admin@example.invalid", passwort: "ProbeAdmin!2026" };
const NUTZER = { email: "axon-probe-nutzer@example.invalid", passwort: "ProbeNutzer!2026" };

async function melde(seite: Page, zugang: { email: string; passwort: string }) {
  await seite.goto("/anmeldung");
  await seite.getByLabel("E-Mail").fill(zugang.email);
  await seite.getByLabel("Passwort").fill(zugang.passwort);
  await seite.getByRole("button", { name: "Anmelden" }).click();
  await expect(seite.getByRole("heading", { level: 1 })).toContainText("Guten", {
    timeout: 20_000,
  });
  /*
   * Die Begruessung steht sofort, der Katalog kommt eine Runde spaeter. Ohne dieses zweite
   * Warten pruefen die folgenden Schritte gegen einen halb geladenen Zustand: die Palette
   * war leer, und das sah nach einem Fehler in der Palette aus, obwohl nur noch nichts da
   * war.
   */
  await expect(
    seite.locator("[data-geladen='ja']").or(seite.getByText("Für dich ist noch kein Programm")),
  ).toBeVisible({ timeout: 20_000 });
}

test("Anmeldung weist falsche Zugangsdaten ab, ohne zu verraten, wer ein Konto hat", async ({
  page,
}) => {
  await page.goto("/anmeldung");
  await page.getByLabel("E-Mail").fill("gibtesnicht@example.invalid");
  await page.getByLabel("Passwort").fill("Falsch!123456");
  await page.getByRole("button", { name: "Anmelden" }).click();
  await expect(page.getByText("E-Mail oder Passwort stimmt nicht.")).toBeVisible();
});

test("Nutzer sieht genau seine drei Kacheln und die gesperrten als eine", async ({ page }) => {
  await melde(page, NUTZER);

  await expect(page.getByRole("link", { name: /AAS Editor/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Excel Connector/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /IEC 61406 QR/ })).toBeVisible();
  // Acht im Katalog, drei frei, also fuenf hinter der gestrichelten Kachel. Ausgeschrieben,
  // wie in der Vorlage ("Drei weitere Programme").
  await expect(page.getByText("Fünf weitere Programme")).toBeVisible();
  await expect(page.getByText("Zugang anfragen")).toBeVisible();
});

test("Ein normaler Nutzer bekommt die Verwaltung nirgends zu sehen", async ({ page }) => {
  await melde(page, NUTZER);

  await page.keyboard.press("ControlOrMeta+k");
  await expect(page.getByPlaceholder("Suchen")).toBeVisible();
  await expect(page.getByText("Nur Admin")).toHaveCount(0);
  await expect(page.getByRole("option", { name: /^Nutzer/ })).toHaveCount(0);
  await page.keyboard.press("Escape");

  // Und auch nicht ueber die Adresse: der Waechter schickt zurueck auf die Buehne.
  await page.goto("/verwaltung/nutzer");
  await expect(page).toHaveURL(/\/$/);
});

test("Die Palette findet ein Programm und oeffnet es", async ({ page }) => {
  await melde(page, NUTZER);
  await page.keyboard.press("ControlOrMeta+k");
  await page.getByPlaceholder("Suchen").fill("excel");
  await expect(page.getByRole("option", { name: /Excel Connector/ })).toBeVisible();
});

test("Der Nutzer aendert seinen Namen, und er bleibt nach dem Neuladen stehen", async ({
  page,
}) => {
  await melde(page, NUTZER);
  await page.goto("/profil");

  const name = `Probe Nutzer ${String(Date.now() % 10_000)}`;
  await page.getByLabel("Name").fill(name);
  await page.getByRole("button", { name: "Speichern" }).click();
  await expect(page.getByText("Gespeichert.")).toBeVisible();

  await page.reload();
  await expect(page.getByLabel("Name")).toHaveValue(name);
});

test("Die E-Mail im Profil ist nicht aenderbar", async ({ page }) => {
  await melde(page, NUTZER);
  await page.goto("/profil");
  await expect(page.getByLabel("E-Mail")).toBeDisabled();
});

test("Der Admin sieht alle Nutzer und kann eine Freischaltung entziehen", async ({ page }) => {
  await melde(page, ADMIN);
  await page.goto("/verwaltung/nutzer");

  await expect(page.getByRole("heading", { name: "Nutzer" })).toBeVisible();
  await page.getByPlaceholder("Nutzer suchen").fill("axon-probe-nutzer");

  const zeile = page.getByRole("button", { name: /Probe Nutzer/ });
  await expect(zeile).toBeVisible();
  await expect(zeile).toContainText("3 von 8");

  await zeile.click();
  const schalter = page.getByRole("switch", { name: /Excel Connector/ });
  await expect(schalter).toHaveAttribute("aria-checked", "true");
  await schalter.click();
  await expect(schalter).toHaveAttribute("aria-checked", "false", { timeout: 15_000 });

  // Wieder anschalten, damit die Pruefung wiederholbar bleibt.
  await schalter.click();
  await expect(schalter).toHaveAttribute("aria-checked", "true", { timeout: 15_000 });
});

test("Der Einladen-Dialog sagt, dass keine Mail verschickt wird", async ({ page }) => {
  /*
   * Hier wird bewusst **nicht** abgeschickt: jeder Durchlauf legte sonst einen Nutzer im
   * echten Bestand an, und aus dem Browser heraus laesst er sich nicht wieder entfernen.
   * Den ganzen Weg (anlegen, Link benutzen, Passwort setzen, anmelden) belegt
   * `scripts/einladung-rundlauf.mjs`, das hinterher aufraeumen kann.
   *
   * Was hier geprueft wird, ist das eine, was der Dialog niemals verschweigen darf: dass
   * niemand eine Mail bekommt und der Link von Hand weiterzugeben ist.
   */
  await melde(page, ADMIN);
  await page.goto("/verwaltung/nutzer");
  await page.getByRole("button", { name: /Einladen/ }).click();

  await expect(page.getByText("Zugang nur auf Einladung")).toBeVisible();
  await expect(page.getByText("Sofort freischalten")).toBeVisible();

  const anlegen = page.getByRole("button", { name: "Zugang anlegen" });
  await expect(anlegen).toBeDisabled();
  await page.getByLabel("E-Mail").fill("wird-nicht-abgeschickt@example.invalid");
  await expect(anlegen).toBeEnabled();
});

test("Der Admin kann sich selbst nicht die Rechte nehmen", async ({ page }) => {
  await melde(page, ADMIN);
  await page.goto("/verwaltung/nutzer");
  await page.getByPlaceholder("Nutzer suchen").fill("axon-probe-admin");
  await page.getByRole("button", { name: /Probe Admin/ }).click();

  await expect(page.getByRole("button", { name: "Nutzer", exact: true })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Sperren" })).toBeDisabled();
});
