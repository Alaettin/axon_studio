/**
 * Der Anmeldeweg eines Unterprogramms, einmal ganz durch: Authorize, Anmeldung, Zustimmung,
 * Codetausch, und dann mit dem erhaltenen **OAuth-Zugriffstoken** gegen die Edge Functions.
 *
 * Die Frage, wegen der es dieses Skript gibt (gemessen am 07.09.2026): akzeptiert
 * `auth.getUser()` in einer Edge Function ein Token, das ein Unterprogramm beim Codetausch
 * bekommen hat? Daran haengt, ob ein Programm den Hub nach der Zugehoerigkeit seines Nutzers
 * fragen kann. Antwort: ja, das Token traegt `role: authenticated` und die Kennung des Nutzers.
 *
 * Aufruf: `node scripts/oauth-rundlauf.mjs .oauth-client-lokal.json`
 *
 * Die Datei mit den Zugangsdaten des Clients liegt **nicht** im Repo (.gitignore). Stimmt das
 * Geheimnis darin nicht mehr, antwortet der Codetausch mit `invalid client credentials`; ein
 * neues gibt es in der Verwaltung unter „Geheimnis erneuern".
 */
import { chromium } from '@playwright/test';
import { createHash, randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';

const BASIS = 'https://acbkhrfzeyixxdbcbnah.supabase.co';
const client = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const b64url = (b) => b.toString('base64url');
const verifizierer = b64url(randomBytes(32));
const challenge = b64url(createHash('sha256').update(verifizierer).digest());
const state = b64url(randomBytes(16));
const nonce = b64url(randomBytes(16));

const url = new URL(`${BASIS}/auth/v1/oauth/authorize`);
url.searchParams.set('client_id', client.client_id);
url.searchParams.set('redirect_uri', client.redirect_uris[0]);
url.searchParams.set('response_type', 'code');
url.searchParams.set('scope', 'openid email profile');
url.searchParams.set('state', state);
url.searchParams.set('nonce', nonce);
url.searchParams.set('code_challenge', challenge);
url.searchParams.set('code_challenge_method', 'S256');

const browser = await chromium.launch();
const seite = await browser.newPage();
let rueckweg = null;
const merke = (u) => { if (!rueckweg && u.startsWith(client.redirect_uris[0])) rueckweg = u; };
seite.on('framenavigated', (f) => { if (f === seite.mainFrame()) merke(f.url()); });
seite.on('request', (r) => merke(r.url()));
seite.on('requestfailed', (r) => merke(r.url()));

await seite.goto(url.toString(), { waitUntil: 'domcontentloaded' }).catch(() => {});
console.log('1 Nach dem Authorize     :', new URL(seite.url()).host + new URL(seite.url()).pathname);

const maske = seite.getByLabel('E-Mail');
if (await maske.waitFor({ timeout: 15000 }).then(() => true).catch(() => false)) {
  await maske.fill('axon-probe-admin@example.invalid');
  await seite.getByLabel('Passwort').fill('ProbeAdmin!2026');
  await seite.getByRole('button', { name: 'Anmelden' }).click();
  await seite.waitForTimeout(6000);
  console.log('2 Nach der Anmeldung     :', new URL(seite.url()).pathname + new URL(seite.url()).search.slice(0, 40));
}

const erlauben = seite.getByRole('button', { name: /Erlauben/ });
if (await erlauben.waitFor({ timeout: 10000 }).then(() => true).catch(() => false)) {
  await erlauben.click().catch(() => {});
  console.log('3 Zustimmung             : erteilt');
} else {
  console.log('3 Zustimmung             : nicht gefragt (schon erteilt oder uebersprungen)');
}
await seite.waitForTimeout(5000);
if (!rueckweg && seite.url().startsWith(client.redirect_uris[0])) rueckweg = seite.url();
await browser.close();

if (!rueckweg) { console.log('KEIN RUECKWEG, Stand:', seite.url()); process.exit(1); }
const code = new URL(rueckweg).searchParams.get('code');
console.log('4 Code im Rueckweg       :', code ? 'ja' : 'NEIN');
if (!code) process.exit(1);

const basic = Buffer.from(`${client.client_id}:${client.client_secret}`).toString('base64');
const grund = {
  grant_type: 'authorization_code', code, redirect_uri: client.redirect_uris[0],
  code_verifier: verifizierer,
};
let tausch = await fetch(`${BASIS}/auth/v1/oauth/token`, {
  method: 'POST',
  headers: { Authorization: `Basic ${basic}`, 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams(grund),
});
let token = await tausch.json();
if (!token.access_token) {
  console.log('5a Basic                 :', tausch.status, JSON.stringify(token).slice(0, 120));
  tausch = await fetch(`${BASIS}/auth/v1/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ ...grund, client_id: client.client_id, client_secret: client.client_secret }),
  });
  token = await tausch.json();
}
console.log('5 Codetausch             :', tausch.status, Object.keys(token).join(','));
if (!token.access_token) { console.log(JSON.stringify(token).slice(0, 300)); process.exit(1); }
const teil = JSON.parse(Buffer.from(token.access_token.split('.')[1], 'base64url').toString());
console.log('   Anspruecke            :', JSON.stringify({ iss: teil.iss, aud: teil.aud, role: teil.role, sub: teil.sub?.slice(0, 8) }));

for (const [name, rumpf] of [['konto', { handlung: 'probe' }], ['verwaltung', { handlung: 'liste' }]]) {
  const r = await fetch(`${BASIS}/functions/v1/${name}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token.access_token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(rumpf),
  });
  const antwort = await r.json();
  console.log(`6 ${name.padEnd(11)} mit OAuth-Token:`, r.status, JSON.stringify(antwort).slice(0, 90));
}
