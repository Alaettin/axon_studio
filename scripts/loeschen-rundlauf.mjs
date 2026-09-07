/**
 * Belegt das Loeschen: Zugang anlegen, Vorschau holen, falsch bestaetigen, richtig bestaetigen,
 * danach nachsehen, dass wirklich nichts stehen blieb.
 *
 * Der Probezugang ist zugleich das Ziel, das Skript raeumt sich also selbst weg. Die Gegenprobe
 * zur Selbstloeschung laeuft mit dem Probe-Admin und muss abgewiesen werden.
 */
const URL = 'https://acbkhrfzeyixxdbcbnah.supabase.co';
const KEY = 'sb_publishable_O5t63aRmEYmsFQWsC2-8Xw_U_tgVW_3';
const ZIEL = 'axon-probe-weg@example.invalid';

const anmelden = async (mail, pw) => {
  const r = await fetch(`${URL}/auth/v1/token?grant_type=password`, {
    method: 'POST', headers: { apikey: KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: mail, password: pw }),
  });
  return { status: r.status, body: await r.json() };
};

const funktion = async (token, rumpf) => {
  const r = await fetch(`${URL}/functions/v1/verwaltung`, {
    method: 'POST',
    headers: { apikey: KEY, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(rumpf),
  });
  return { status: r.status, body: await r.json() };
};

const admin = await anmelden('axon-probe-admin@example.invalid', 'ProbeAdmin!2026');
if (!admin.body.access_token) { console.log('Admin-Anmeldung fehlgeschlagen:', admin.status); process.exit(1); }
const t = admin.body.access_token;

const angelegt = await funktion(t, { handlung: 'anlegen', email: ZIEL, rolle: 'user', apps: ['aas-editor'] });
console.log('1 Zugang anlegen        :', angelegt.status, angelegt.body.fehler ?? 'ok');
if (!angelegt.body.kennung) process.exit(1);
const kennung = angelegt.body.kennung;

const vorschau = await funktion(t, { handlung: 'loeschvorschau', kennung });
const zeigt = (liste, tabelle) => (liste ?? []).find((p) => p.tabelle === tabelle)?.anzahl ?? 0;
console.log('2 Vorschau              :', vorschau.status,
  JSON.stringify(vorschau.body.faellt_weg), 'blockiert:', JSON.stringify(vorschau.body.blockiert));
console.log('   profiles 1           :', zeigt(vorschau.body.faellt_weg, 'profiles') === 1 ? 'ja' : 'NEIN');
console.log('   Freischaltung 1      :', zeigt(vorschau.body.faellt_weg, 'user_tool_access') === 1 ? 'ja' : 'NEIN');
console.log('   nichts aus auth      :', (vorschau.body.faellt_weg ?? []).every((p) => !p.tabelle.startsWith('auth')) ? 'ja' : 'NEIN');

const falsch = await funktion(t, { handlung: 'loeschen', kennung, bestaetigung: 'jemand@anders.invalid' });
console.log('3 Falsche Bestaetigung  :', falsch.status, falsch.status === 400 ? 'abgewiesen, richtig' : 'DURCHGELASSEN');

const selbst = await funktion(t, { handlung: 'loeschen', kennung: admin.body.user.id, bestaetigung: 'axon-probe-admin@example.invalid' });
console.log('4 Sich selbst loeschen  :', selbst.status, selbst.status === 400 ? 'abgewiesen, richtig' : 'DURCHGELASSEN');

const weg = await funktion(t, { handlung: 'loeschen', kennung, bestaetigung: ZIEL });
console.log('5 Loeschen              :', weg.status, weg.body.fehler ?? 'ok', JSON.stringify(weg.body.entfernt ?? []));

const liste = await funktion(t, { handlung: 'liste' });
const nochDa = (liste.body.nutzer ?? []).some((n) => n.email === ZIEL);
console.log('6 Steht noch in Liste   :', nochDa ? 'JA' : 'nein, richtig');

const nochmal = await funktion(t, { handlung: 'loeschvorschau', kennung });
console.log('7 Vorschau danach       :', nochmal.status, nochmal.status === 404 ? 'gibt es nicht mehr, richtig' : JSON.stringify(nochmal.body).slice(0, 120));

const anmeldung = await anmelden(ZIEL, angelegt.body.startpasswort);
console.log('8 Anmeldung danach      :', anmeldung.status, anmeldung.status === 400 ? 'geht nicht mehr, richtig' : 'GEHT NOCH');

console.log('\nDie Historienzeile in hub_invitations bleibt stehen und traegt geloescht_am.');
