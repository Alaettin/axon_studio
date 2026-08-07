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

test("Der Katalog enthaelt nur echte Clients des Hubs", async ({ page }) => {
  /*
   * Im Katalog steht genau ein Programm: der AXON Editor. Die acht Werkzeuge der
   * AAS Tools Platform standen dort am 07.08.2026 kurzzeitig, weil `user_tool_access`
   * bereits Freischaltungen auf ihre Kennungen trug. Das war ein Fehlschluss: vorhandene
   * Freischaltungen sind kein Auftrag, die Werkzeuge aufzunehmen. Sie sind keine Clients
   * des Hubs, ihre Kacheln fuehrten zu einer zweiten Anmeldung, und die Akte sieht ihren
   * Umzug ausdruecklich fuer **spaeter** vor.
   *
   * Diese Pruefung haelt das fest: taucht hier wieder ein fremdes Werkzeug auf, ist es
   * eine Entscheidung und kein Versehen.
   */
  await melde(page, NUTZER);

  const kacheln = page.locator('a[href]:has-text("ÖFFNEN")');
  await expect(kacheln).toHaveCount(1);
  await expect(page.getByRole("link", { name: /AXON Editor/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /AXON Editor/ })).toHaveAttribute(
    "href",
    "https://axon-editor.sliplane.app",
  );

  // Nichts Gesperrtes: was nicht im Katalog steht, geht den Hub nichts an.
  await expect(page.getByText("Zugang anfragen")).toHaveCount(0);
  await expect(page.getByText("Excel Connector")).toHaveCount(0);
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

test("Die Palette findet ein Programm", async ({ page }) => {
  await melde(page, NUTZER);
  await page.keyboard.press("ControlOrMeta+k");
  await page.getByPlaceholder("Suchen").fill("editor");
  await expect(page.getByRole("option", { name: /AXON Editor/ })).toBeVisible();
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
  /*
   * Laengere Frist als die Vorgabe von fuenf Sekunden: die Liste kommt aus der Edge
   * Function `verwaltung`, und deren Kaltstart hat diese Zusage in einem Lauf schon
   * gerissen. Drei Laeufe danach waren gruen, was den Verdacht bestaetigt: es war die
   * Wartezeit, nicht die Sache.
   */
  await expect(zeile).toBeVisible({ timeout: 20_000 });
  /*
   * Gezaehlt wird nur, was im Katalog steht. Der Probenutzer hat drei Freischaltungen in
   * `user_tool_access`, aber zwei davon gehoeren Werkzeugen der Tools-Plattform, die keine
   * Programme des Hubs sind. Ohne den Filter stuende hier "3 von 1".
   */
  await expect(zeile).toContainText("1 von 1");

  await zeile.click();
  const schalter = page.getByRole("switch", { name: /AXON Editor/ });
  await expect(schalter).toHaveAttribute("aria-checked", "true");
  await schalter.click();
  await expect(schalter).toHaveAttribute("aria-checked", "false", { timeout: 15_000 });

  // Wieder anschalten, damit die Pruefung wiederholbar bleibt.
  await schalter.click();
  await expect(schalter).toHaveAttribute("aria-checked", "true", { timeout: 15_000 });
});

test("Die Zustimmungsseite ohne Kennung sagt, was fehlt", async ({ page }) => {
  /*
   * Der Rest der Seite laesst sich erst pruefen, wenn der OAuth-2.1-Server eingeschaltet
   * ist; heute antwortet er mit `OAuth server is disabled`. Was schon jetzt gilt und nie
   * brechen darf: ohne `authorization_id` steht dort ein Satz und keine leere Karte.
   */
  await melde(page, NUTZER);
  await page.goto("/zustimmung");
  await expect(page.getByText("In der Adresse fehlt die Kennung der Anfrage.")).toBeVisible();
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
