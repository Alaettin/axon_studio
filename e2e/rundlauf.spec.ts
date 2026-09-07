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

test("Nach der Anmeldung fuehrt kein weiter= aus dem Programm heraus", async ({ page }) => {
  /*
   * Befund 6 des Sicherheitsaudits vom 10.08.2026. `?weiter=` sagt der Anmeldung, wohin es
   * danach geht, und der Wert kommt aus der Adresszeile. Zwei fuehrende Schraegstriche
   * ergeben einen protokollrelativen Pfad: der Browser liest `//example.com` als fremde
   * Adresse, und nach erfolgreicher Anmeldung landete man auf einer Seite, die dieselbe
   * Maske nachbauen kann.
   */
  await page.goto("/anmeldung?weiter=%2F%2Fexample.com%2Fboese");
  // Der eigene Ursprung, abgelesen statt fest hingeschrieben: die Pruefung soll auch dann
  // stimmen, wenn der Dev-Server auf einem anderen Port laeuft.
  const eigener = new URL(page.url()).origin;

  await page.getByLabel("E-Mail").fill(NUTZER.email);
  await page.getByLabel("Passwort").fill(NUTZER.passwort);
  await page.getByRole("button", { name: "Anmelden" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Guten", {
    timeout: 20_000,
  });

  // Der eigentliche Nachweis: der Ursprung ist noch unserer.
  expect(new URL(page.url()).origin).toBe(eigener);
  expect(page.url()).not.toContain("example.com");
});

test("Der Katalog enthaelt nur echte Clients des Hubs", async ({ page }) => {
  /*
   * Im Katalog stehen zwei Programme: der AXON Editor und, seit dem 12.08.2026, der AXON
   * Connector. Die acht Werkzeuge der
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

  /*
   * Seit dem 12.08.2026 steht ein zweites echtes Programm im Katalog, der AXON Connector.
   * Dieser Nutzer ist dafuer nicht freigeschaltet, also sieht er dort "Zugang anfragen",
   * und genau das ist richtig. Gemessen wird deshalb nicht "nichts Gesperrtes", sondern
   * die eine Aussage, um die es geht: **kein fremdes Werkzeug**.
   */
  await expect(page.getByText("Excel Connector")).toHaveCount(0);
  await expect(page.getByText("IEC 61406")).toHaveCount(0);
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
   * Programme des Hubs sind. Ohne den Filter stuende hier "3 von 2".
   */
  await expect(zeile).toContainText("1 von 2");

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

test("Der Anlegen-Dialog sagt, dass keine Mail verschickt wird", async ({ page }) => {
  /*
   * Hier wird bewusst **nicht** abgeschickt: jeder Durchlauf legte sonst einen Nutzer im
   * echten Bestand an, und aus dem Browser heraus laesst er sich nicht wieder entfernen.
   * Den ganzen Weg (anlegen, mit dem Startpasswort anmelden, wechseln) belegt
   * `scripts/zugang-rundlauf.mjs`, das hinterher aufraeumen kann.
   *
   * Was hier geprueft wird, ist das eine, was der Dialog niemals verschweigen darf: dass
   * niemand eine Mail bekommt und das Startpasswort von Hand weiterzugeben ist.
   */
  await melde(page, ADMIN);
  await page.goto("/verwaltung/nutzer");
  await page.getByRole("button", { name: "Neuer Zugang" }).click();

  await expect(page.getByText("Zugang nur über die Verwaltung")).toBeVisible();
  await expect(page.getByText("Sofort freischalten")).toBeVisible();

  const anlegen = page.getByRole("button", { name: "Zugang anlegen", exact: true });
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
  // Sich selbst zu loeschen ist der eine Weg, den Hub ohne Administrator zurueckzulassen.
  // Die Edge Function weist es ebenfalls ab, hier steht nur der Knopf zur Probe.
  await expect(page.getByRole("button", { name: "Löschen", exact: true })).toBeDisabled();
});

test("Löschen fragt erst, was am Zugang hängt", async ({ page }) => {
  /*
   * Wieder ohne Abschicken: ein Durchlauf loeschte sonst einen echten Zugang, und den bringt
   * niemand zurueck. `scripts/loeschen-rundlauf.mjs` geht den ganzen Weg an einem eigens
   * angelegten Zugang.
   *
   * Geprueft wird das, was der Dialog niemals ueberspringen darf: die Vorschau und die
   * abgetippte Adresse. Solange dort etwas anderes steht, bleibt der Knopf gesperrt.
   */
  await melde(page, ADMIN);
  await page.goto("/verwaltung/nutzer");
  await page.getByPlaceholder("Nutzer suchen").fill("axon-probe-nutzer");
  await page.getByRole("button", { name: /Probe Nutzer/ }).click();
  await page.getByRole("button", { name: "Löschen", exact: true }).click();

  await expect(page.getByText("Diesen Zugang endgültig löschen?")).toBeVisible();
  await expect(page.getByText("Profil im Hub")).toBeVisible();

  const endgueltig = page.getByRole("button", { name: "Endgültig löschen" });
  await expect(endgueltig).toBeDisabled();
  await page.getByLabel("Zum Bestätigen die Adresse eintippen").fill("falsch@example.invalid");
  await expect(endgueltig).toBeDisabled();
  await page.getByLabel("Zum Bestätigen die Adresse eintippen").fill(NUTZER.email);
  await expect(endgueltig).toBeEnabled();

  // Und wieder zurueck, ohne etwas anzufassen.
  await page.getByRole("button", { name: "Zurück" }).click();
  await expect(page.getByText("Freischaltungen")).toBeVisible();
});

test("Organisationen stehen nur Administratoren offen", async ({ page }) => {
  await melde(page, NUTZER);
  await page.goto("/verwaltung/organisationen");
  await expect(page).toHaveURL(/\/$/);
});

test("Die Organisationsseite zeigt den Bestand und fragt nach einem Namen", async ({ page }) => {
  /*
   * Angelegt wird hier nichts: eine Organisation im echten Bestand bleibt sonst nach jedem
   * Durchlauf stehen. Den ganzen Weg samt Zuordnung und der Frage, was ein Unterprogramm
   * davon erfaehrt, belegt `scripts/organisationen-rundlauf.mjs`.
   */
  await melde(page, ADMIN);
  await page.goto("/verwaltung/organisationen");

  await expect(page.getByRole("heading", { name: "Organisationen" })).toBeVisible();
  await page.getByRole("button", { name: "Neue Organisation" }).click();

  const anlegen = page.getByRole("button", { name: "Anlegen", exact: true });
  await expect(anlegen).toBeDisabled();
  await page.getByLabel("Name").fill("Wird nicht abgeschickt");
  await expect(anlegen).toBeEnabled();
  await page.getByRole("button", { name: "Abbrechen" }).click();
});

test("Der Nutzerdialog fuehrt die Organisationen", async ({ page }) => {
  await melde(page, ADMIN);
  await page.goto("/verwaltung/nutzer");
  await page.getByPlaceholder("Nutzer suchen").fill("axon-probe-nutzer");
  await page.getByRole("button", { name: /Probe Nutzer/ }).click();

  // Der Abschnitt steht auch dann da, wenn es noch keine Organisation gibt: dann sagt er das.
  await expect(page.getByText("Organisationen", { exact: true })).toBeVisible();
  await expect(
    page.getByText("teilt sich in den Unterprogrammen den Arbeitsbereich", { exact: false }),
  ).toBeVisible();
});

test("Der Programmkatalog steht nur Administratoren offen", async ({ page }) => {
  await melde(page, NUTZER);
  await page.goto("/verwaltung/katalog");
  // Der Waechter schickt zurueck auf die Buehne, nicht auf eine leere Verwaltungsseite.
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Guten");
});

test("Der Katalog zeigt den Editor mit Umgebungen und Status", async ({ page }) => {
  await melde(page, ADMIN);
  await page.goto("/verwaltung/katalog");

  await expect(page.getByRole("heading", { name: "Katalog" })).toBeVisible();
  const zeile = page.getByRole("button", { name: /AXON Editor/ });
  await expect(zeile).toBeVisible({ timeout: 20_000 });
  // Drei Umgebungen: produktion, lokal und seit dem 11.08.2026 connector. Die beiden
  // hinteren stehen als "+2" hinter dem Host.
  await expect(zeile).toContainText("axon-editor.sliplane.app");
  await expect(zeile).toContainText("+2");
});

test("Der Assistent laesst nicht vorspringen", async ({ page }) => {
  /*
   * Der wichtigste Punkt am Assistenten, und der einzige, der sich ohne echte Clients
   * pruefen laesst: Schritt 4 legt Registrierungen beim Aussteller an, und dorthin darf
   * niemand springen, bevor Adresse und Zugriff stehen. Angelegt wird hier nichts.
   */
  await melde(page, ADMIN);
  await page.goto("/verwaltung/katalog/aufnehmen");

  await expect(page.getByRole("heading", { name: "Programm aufnehmen" })).toBeVisible();
  await expect(page.getByRole("button", { name: /4 Schlüssel/ })).toBeDisabled();
  await expect(page.getByRole("button", { name: /2 Adresse/ })).toBeDisabled();

  // Ohne Name, Kuerzel und Satz geht es nicht weiter.
  const weiter = page.getByRole("button", { name: /Weiter/ });
  await expect(weiter).toBeDisabled();

  await page.getByLabel("Name").fill("Probe Programm");
  await page.getByLabel("Kürzel").fill("PRB");
  // Die Kennung leitet sich aus dem Namen ab, ohne dass jemand sie tippt.
  await expect(page.getByLabel("Kennung")).toHaveValue("probe-programm");
  await page.getByPlaceholder("Verwaltungsschalen bauen").fill("Nur eine Vorschau.");

  // Die Kachel daneben lebt mit.
  await expect(page.getByText("Probe Programm")).toBeVisible();
  await expect(weiter).toBeEnabled();
});

test("Das Profil zeigt die erteilten Freigaben und den Weg zurueck", async ({ page }) => {
  /*
   * Die Zustimmungsseite verspricht seit Runde 1, die Freigabe lasse sich zuruecknehmen.
   * Bis Runde 3 gab es dafuer keinen Ort. Hier steht er.
   */
  await melde(page, NUTZER);
  await page.goto("/profil");
  await expect(page.getByText("Erteilte Freigaben")).toBeVisible();
  await expect(
    page
      .getByText("Du hast noch keinem Programm Zugriff auf dein Konto erteilt.")
      .or(page.getByRole("button", { name: "Zurücknehmen" }).first()),
  ).toBeVisible({ timeout: 20_000 });
});

test("Hinter dem Nutzerdialog bleibt die Tabelle stehen", async ({ page }) => {
  /*
   * Der Sprung wird gemessen, nicht angesehen. Jede Aenderung im Dialog laedt die Liste
   * nach; lief das laut, schob die Zeile "Nutzer werden geladen" die ganze Tabelle um ihre
   * eigene Hoehe nach unten und wieder zurueck. Ein Pixel Unterschied hier heisst, dass
   * das Nachladen wieder laut geworden ist.
   */
  await melde(page, ADMIN);
  await page.goto("/verwaltung/nutzer");
  await page.getByPlaceholder("Nutzer suchen").fill("axon-probe-nutzer");

  /*
   * Gemessen wird ueber `data-tabelle`, nicht ueber die Rolle: sobald der Dialog steht,
   * setzt Radix den Hintergrund auf `aria-hidden`, und ein Rollenselektor findet die Zeile
   * nicht mehr.
   */
  const zeile = page.locator("[data-tabelle] > button").first();
  await expect(zeile).toBeVisible({ timeout: 20_000 });
  const vorher = await zeile.boundingBox();

  await zeile.click();
  const schalter = page.getByRole("switch", { name: /AXON Editor/ });
  await expect(schalter).toBeVisible();
  // Vom vorgefundenen Stand ausgehen und ihn am Ende wiederherstellen: die Pruefung teilt
  // sich den Zugang mit den uebrigen und darf ihn nicht umgelegt hinterlassen.
  const anfangs = await schalter.getAttribute("aria-checked");
  const umgelegt = anfangs === "true" ? "false" : "true";

  /*
   * Waehrend des Umlegens **durchgehend** messen, nicht davor und danach.
   *
   * Ein Vergleich zweier Momentaufnahmen sieht den Sprung nicht: er dauert so lange wie das
   * Nachladen, und danach steht alles wieder an seinem Platz. Gegengeprueft, indem das
   * stille Nachladen versuchsweise wieder laut gestellt wurde: mit zwei Momentaufnahmen
   * blieb die Pruefung gruen, mit diesem Mitschnitt wird sie rot.
   */
  await page.evaluate(() => {
    const w = window as unknown as { __proben: number[]; __id: number };
    const flaeche = document.querySelector("[data-tabelle]");
    w.__proben = [];
    const takt = () => {
      // Die erste Zeile, nicht das erste Kind: der Ladehinweis schiebt sich als Absatz
      // **davor** und waere selbst wieder das erste Kind an derselben Stelle.
      const erste = flaeche?.querySelector("button");
      if (erste) w.__proben.push(Math.round(erste.getBoundingClientRect().y));
      w.__id = requestAnimationFrame(takt);
    };
    takt();
  });

  await schalter.click();
  await expect(schalter).toHaveAttribute("aria-checked", umgelegt, { timeout: 15_000 });
  await schalter.click();
  await expect(schalter).toHaveAttribute("aria-checked", anfangs ?? "true", { timeout: 15_000 });

  const stellen = await page.evaluate(() => {
    const w = window as unknown as { __proben: number[]; __id: number };
    cancelAnimationFrame(w.__id);
    return [...new Set(w.__proben)];
  });
  expect(stellen).toEqual([Math.round(vorher?.y ?? -1)]);
});
