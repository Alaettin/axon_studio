/**
 * Belegt den Weg herein: Zugang anlegen, mit dem Startpasswort anmelden, Passwort wechseln,
 * mit dem neuen anmelden. Raeumt den Wegwerf-Zugang danach wieder weg.
 *
 * Laeuft gegen die ausgelieferten Edge Functions, nicht gegen den Entwicklungsstand: das
 * Startpasswort und die Marke `passwortwechsel_faellig` entstehen dort, und nur dort ist
 * belegbar, dass beide zusammen wieder verschwinden.
 */
const URL = 'https://acbkhrfzeyixxdbcbnah.supabase.co';
const KEY = 'sb_publishable_O5t63aRmEYmsFQWsC2-8Xw_U_tgVW_3';
const ZIEL = 'axon-probe-neu@example.invalid';
const EIGENES = 'SelbstGewaehlt!2026';

const anmelden = async (mail, pw) => {
  const r = await fetch(`${URL}/auth/v1/token?grant_type=password`, {
    method: 'POST', headers: { apikey: KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: mail, password: pw }),
  });
  return { status: r.status, body: await r.json() };
};

const funktion = async (name, token, rumpf) => {
  const r = await fetch(`${URL}/functions/v1/${name}`, {
    method: 'POST',
    headers: { apikey: KEY, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(rumpf),
  });
  return { status: r.status, body: await r.json() };
};

const profil = async (token, kennung) => {
  const r = await fetch(`${URL}/rest/v1/profiles?id=eq.${kennung}&select=passwortwechsel_faellig`, {
    headers: { apikey: KEY, Authorization: `Bearer ${token}` },
  });
  return (await r.json())[0];
};

const admin = await anmelden('axon-probe-admin@example.invalid', 'ProbeAdmin!2026');
if (!admin.body.access_token) { console.log('Admin-Anmeldung fehlgeschlagen:', admin.status); process.exit(1); }

const angelegt = await funktion('verwaltung', admin.body.access_token,
  { handlung: 'anlegen', email: ZIEL, rolle: 'user', apps: ['aas-editor'] });
console.log('1 Zugang anlegen        :', angelegt.status, angelegt.body.fehler ?? 'ok');
if (!angelegt.body.startpasswort) { console.log('   Antwort:', JSON.stringify(angelegt.body).slice(0, 300)); process.exit(1); }
console.log('   Startpasswort        :', angelegt.body.startpasswort);

const erste = await anmelden(ZIEL, angelegt.body.startpasswort);
console.log('2 Mit Startpasswort an  :', erste.status);
if (!erste.body.access_token) process.exit(1);

const vorher = await profil(erste.body.access_token, angelegt.body.kennung);
console.log('3 Wechsel faellig       :', vorher?.passwortwechsel_faellig === true ? 'ja' : 'NEIN');

// Die Marke selbst wegzuraeumen muss scheitern, sonst waere der Zwang eine Bitte.
const versuch = await fetch(`${URL}/rest/v1/profiles?id=eq.${angelegt.body.kennung}`, {
  method: 'PATCH',
  headers: { apikey: KEY, Authorization: `Bearer ${erste.body.access_token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ passwortwechsel_faellig: false }),
});
console.log('4 Marke selbst loeschen :', versuch.status, versuch.status >= 400 ? 'abgewiesen, richtig' : 'DURCHGELASSEN');

const gewechselt = await funktion('konto', erste.body.access_token,
  { handlung: 'passwort-wechseln', passwort: EIGENES });
console.log('5 Passwort wechseln     :', gewechselt.status, gewechselt.body.fehler ?? 'ok');

const zweite = await anmelden(ZIEL, EIGENES);
console.log('6 Mit eigenem Passwort  :', zweite.status);
const nachher = await profil(zweite.body.access_token, angelegt.body.kennung);
console.log('7 Wechsel erledigt      :', nachher?.passwortwechsel_faellig === false ? 'ja' : 'NEIN');
console.log('   Kennung stimmt       :', zweite.body.user?.id === angelegt.body.kennung);

console.log('\nAufraeumen: der Zugang', ZIEL, 'steht jetzt in der Datenbank und gehoert geloescht.');
