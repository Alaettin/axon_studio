/**
 * Belegt den Einladeweg: Zugang anlegen, Link holen, Link benutzen, Passwort setzen,
 * anmelden. Raeumt den Wegwerf-Zugang danach nicht auf, das macht der Aufrufer.
 */
const URL = 'https://acbkhrfzeyixxdbcbnah.supabase.co';
const KEY = 'sb_publishable_O5t63aRmEYmsFQWsC2-8Xw_U_tgVW_3';
const ZIEL = 'axon-probe-neu@example.invalid';
const PASSWORT = 'FrischGesetzt!2026';

const anmelden = async (mail, pw) => {
  const r = await fetch(`${URL}/auth/v1/token?grant_type=password`, {
    method: 'POST', headers: { apikey: KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: mail, password: pw }),
  });
  return { status: r.status, body: await r.json() };
};

const admin = await anmelden('axon-probe-admin@example.invalid', 'ProbeAdmin!2026');

const r = await fetch(`${URL}/functions/v1/verwaltung`, {
  method: 'POST',
  headers: { apikey: KEY, Authorization: `Bearer ${admin.body.access_token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ handlung: 'einladen', email: ZIEL, rolle: 'user',
                         apps: ['aas-editor'], ziel: 'http://localhost:5274/passwort-setzen' }),
});
const einladung = await r.json();
console.log('1 Zugang anlegen        :', r.status, einladung.fehler ?? 'ok');
if (!einladung.link) { console.log('   Antwort:', JSON.stringify(einladung).slice(0,300)); process.exit(1); }
console.log('   Link:', einladung.link.slice(0, 120) + '...');

// 2. Den Link benutzen. Er ist eine Weiterleitung auf /verify, die ein Token setzt.
const folge = await fetch(einladung.link, { redirect: 'manual' });
const wohin = folge.headers.get('location') ?? '';
console.log('2 Link aufrufen         :', folge.status, wohin.slice(0, 110) + (wohin.length > 110 ? '...' : ''));

// 3. Aus dem Fragment das Zugriffstoken ziehen und damit das Passwort setzen.
const fragment = wohin.split('#')[1] ?? '';
const token = new URLSearchParams(fragment).get('access_token');
console.log('3 Zugriffstoken im Link :', token ? 'ja' : 'NEIN');
if (!token) process.exit(1);

const gesetzt = await fetch(`${URL}/auth/v1/user`, {
  method: 'PUT',
  headers: { apikey: KEY, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ password: PASSWORT }),
});
console.log('4 Passwort setzen       :', gesetzt.status);

const neu = await anmelden(ZIEL, PASSWORT);
console.log('5 Mit neuem Passwort an :', neu.status);
console.log('   Kennung stimmt       :', neu.body.user?.id === einladung.kennung);
