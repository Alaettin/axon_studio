import { chromium } from '@playwright/test';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
const shot = (n) => p.screenshot({ path: `test-results/bild-${n}.png` });

await p.goto('http://localhost:5274/anmeldung');
await p.waitForTimeout(2500);
await shot('01-anmeldung');

await p.getByLabel('E-Mail').fill('axon-probe-nutzer@example.invalid');
await p.getByLabel('Passwort').fill('ProbeNutzer!2026');
await p.getByRole('button', { name: 'Anmelden' }).click();
await p.waitForTimeout(3000);
await shot('02-buehne');

await p.keyboard.press('ControlOrMeta+k');
await p.waitForTimeout(900);
await shot('03-palette');
await p.keyboard.press('Escape');

await p.goto('http://localhost:5274/profil');
await p.waitForTimeout(2500);
await shot('06-profil');

// Kontomenue
await p.getByRole('button', { name: 'Konto und Verwaltung' }).click();
await p.waitForTimeout(700);
await shot('05-kontomenue');
await p.keyboard.press('Escape');

// Als Admin
await p.goto('http://localhost:5274/anmeldung');
await p.evaluate(() => localStorage.clear());
await p.goto('http://localhost:5274/anmeldung');
await p.getByLabel('E-Mail').fill('axon-probe-admin@example.invalid');
await p.getByLabel('Passwort').fill('ProbeAdmin!2026');
await p.getByRole('button', { name: 'Anmelden' }).click();
await p.waitForTimeout(3000);
await p.goto('http://localhost:5274/verwaltung/nutzer');
await p.waitForTimeout(3500);
await shot('07-nutzer');

await p.getByRole('button', { name: /Probe Nutzer/ }).first().click();
await p.waitForTimeout(900);
await shot('08-nutzerdetail');
await p.keyboard.press('Escape');
await p.waitForTimeout(500);

await p.getByRole('button', { name: /Einladen/ }).click();
await p.waitForTimeout(900);
await shot('09-einladen');
await b.close();
console.log('fertig');
