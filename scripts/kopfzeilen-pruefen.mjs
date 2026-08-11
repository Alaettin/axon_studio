/**
 * Misst die Sicherheitskopfzeilen der Auslieferung.
 *
 *   node scripts/kopfzeilen-pruefen.mjs http://localhost:8081
 *   node scripts/kopfzeilen-pruefen.mjs https://axon-studio.sliplane.app
 *
 * **Warum ein eigenes Skript und keine Playwright-Pruefung:** `pnpm e2e` laeuft gegen den
 * Vite-Dev-Server, und der ist nicht nginx. Die Koepfe entstehen erst im Container, also
 * misst sie nur etwas, das gegen den Container laeuft.
 *
 * **Warum mehrere Wege und nicht einer:** `add_header` in einem `location` loescht alle
 * Koepfe der aeusseren Ebene. Der Fehler traete also nicht ueberall auf, sondern genau an
 * den Wegen mit eigenem add_header. Ein einzelner Aufruf gegen `/` haette ihn nie gesehen.
 */

const ERWARTET = {
  "content-security-policy": "frame-ancestors 'none'",
  "x-frame-options": "DENY",
  "x-content-type-options": "nosniff",
  "referrer-policy": "strict-origin-when-cross-origin",
  "permissions-policy": "camera=(), microphone=(), geolocation=()",
  "strict-transport-security": "max-age=31536000",
};

const basis = (process.argv[2] ?? "http://localhost:8081").replace(/\/+$/u, "");

/** Ein gebuendelter Dateiname aus der ausgelieferten index.html, fuer den /assets/-Weg. */
async function findeAsset() {
  const antwort = await fetch(`${basis}/`, { redirect: "manual" });
  const html = await antwort.text();
  return /\/assets\/[A-Za-z0-9._-]+\.js/u.exec(html)?.[0] ?? null;
}

const asset = await findeAsset();

const wege = [
  ["Wurzel", "/"],
  ["Zustimmungsseite", "/zustimmung?authorization_id=probe"],
  ["index.html unmittelbar", "/index.html"],
  ["Gesundheitspfad", "/healthz"],
  // Beide /assets/-Faelle: der vorhandene und der fehlende. Der zweite laeuft ueber
  // `try_files … =404`, und ohne `always` haetten die Koepfe genau dort gefehlt.
  ...(asset ? [["Gebuendelte Datei", asset]] : []),
  ["Fehlende gebuendelte Datei", "/assets/gibt-es-nicht-4711.js"],
];

let maengel = 0;

for (const [name, weg] of wege) {
  const antwort = await fetch(basis + weg, { redirect: "manual" });
  const fehlend = [];
  const falsch = [];
  for (const [kopf, wert] of Object.entries(ERWARTET)) {
    const ist = antwort.headers.get(kopf);
    if (ist === null) fehlend.push(kopf);
    else if (ist !== wert) falsch.push(`${kopf}: ${ist}`);
  }
  const gut = fehlend.length === 0 && falsch.length === 0;
  if (!gut) maengel += 1;
  console.log(
    `${gut ? "ok  " : "FEHL"} ${String(antwort.status)} ${name} (${weg})` +
      (fehlend.length > 0 ? `\n       fehlt: ${fehlend.join(", ")}` : "") +
      (falsch.length > 0 ? `\n       anders: ${falsch.join(" | ")}` : ""),
  );
}

if (asset === null) {
  console.log("Hinweis: in der index.html stand kein /assets/-Pfad, der Weg blieb ungeprueft.");
}

console.log(
  maengel === 0
    ? `\nAlle ${String(wege.length)} Wege tragen alle ${String(Object.keys(ERWARTET).length)} Koepfe.`
    : `\n${String(maengel)} von ${String(wege.length)} Wegen unvollstaendig.`,
);
// `process.exitCode` und nicht `process.exit`: das sofortige Beenden reisst unter Windows
// die noch offenen Verbindungen von `fetch` mit und endet in einer libuv-Assertion, die
// wie ein Fehler der Pruefung aussieht, obwohl sie durchgelaufen ist.
process.exitCode = maengel === 0 ? 0 : 1;
