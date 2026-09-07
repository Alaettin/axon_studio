/**
 * Belegt den Vertrag mit den Unterprogrammen: eine Organisation anlegen, jemanden aufnehmen,
 * und **als dieser Nutzer** beim Hub nachfragen, wozu er gehoert.
 *
 * Dazu die Gegenprobe, die den Sinn der Sache ausmacht: ein Nutzer darf sich nicht selbst in
 * eine Organisation eintragen. Ginge das, waere die Zugehoerigkeit Selbstbedienung, und der
 * gemeinsame Arbeitsbereich stuende jedem offen, der seine Kennung kennt.
 *
 * Raeumt hinter sich auf: die Organisation wird am Ende geloescht.
 */
const URL_ = 'https://acbkhrfzeyixxdbcbnah.supabase.co';
const KEY = 'sb_publishable_O5t63aRmEYmsFQWsC2-8Xw_U_tgVW_3';
const NAME = `Probe Organisation ${String(Date.now() % 100000)}`;

const anmelden = async (mail, pw) => {
  const r = await fetch(`${URL_}/auth/v1/token?grant_type=password`, {
    method: 'POST', headers: { apikey: KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: mail, password: pw }),
  });
  return await r.json();
};

const rest = async (token, pfad, init = {}) =>
  fetch(`${URL_}/rest/v1/${pfad}`, {
    ...init,
    headers: {
      apikey: KEY, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });

const funktion = async (name, token, rumpf) => {
  const r = await fetch(`${URL_}/functions/v1/${name}`, {
    method: 'POST',
    headers: { apikey: KEY, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(rumpf),
  });
  return { status: r.status, body: await r.json() };
};

const admin = await anmelden('axon-probe-admin@example.invalid', 'ProbeAdmin!2026');
const nutzer = await anmelden('axon-probe-nutzer@example.invalid', 'ProbeNutzer!2026');
if (!admin.access_token || !nutzer.access_token) { console.log('Anmeldung fehlgeschlagen'); process.exit(1); }

const angelegt = await rest(admin.access_token, 'hub_organisationen', {
  method: 'POST', headers: { Prefer: 'return=representation' },
  body: JSON.stringify({ name: NAME, angelegt_von: admin.user.id }),
});
const [organisation] = await angelegt.json();
console.log('1 Organisation anlegen   :', angelegt.status, organisation?.name ?? '');
if (!organisation) process.exit(1);

const doppelt = await rest(admin.access_token, 'hub_organisationen', {
  method: 'POST', body: JSON.stringify({ name: NAME.toUpperCase() }),
});
console.log('2 Gleicher Name nochmal  :', doppelt.status, doppelt.status === 409 ? 'abgewiesen, richtig' : 'DURCHGELASSEN');

// Die Gegenprobe: der Nutzer traegt sich selbst ein. Muss scheitern.
const selbst = await rest(nutzer.access_token, 'hub_organisation_mitglieder', {
  method: 'POST',
  body: JSON.stringify({ organisation_id: organisation.id, user_id: nutzer.user.id }),
});
console.log('3 Selbst eintragen       :', selbst.status, selbst.status >= 400 ? 'abgewiesen, richtig' : 'DURCHGELASSEN');

const vorher = await funktion('konto', nutzer.access_token, { handlung: 'organisationen' });
console.log('4 Vorher (Nutzer fragt)  :', vorher.status, JSON.stringify(vorher.body.organisationen ?? []));

const aufnehmen = await rest(admin.access_token, 'hub_organisation_mitglieder', {
  method: 'POST',
  body: JSON.stringify({ organisation_id: organisation.id, user_id: nutzer.user.id }),
});
console.log('5 Admin nimmt auf        :', aufnehmen.status);

const nachher = await funktion('konto', nutzer.access_token, { handlung: 'organisationen' });
const liste = nachher.body.organisationen ?? [];
console.log('6 Nachher (Nutzer fragt) :', nachher.status, JSON.stringify(liste));
console.log('   Genau diese eine      :', liste.length === 1 && liste[0].id === organisation.id ? 'ja' : 'NEIN');

const fremd = await funktion('konto', admin.access_token, { handlung: 'organisationen' });
const beimAdmin = (fremd.body.organisationen ?? []).some((o) => o.id === organisation.id);
console.log('7 Nichtmitglied sieht sie:', beimAdmin ? 'JA' : 'nein, richtig');

const inListe = await funktion('verwaltung', admin.access_token, { handlung: 'liste' });
const zeile = (inListe.body.nutzer ?? []).find((n) => n.id === nutzer.user.id);
console.log('8 Nutzerliste fuehrt sie :', JSON.stringify(zeile?.organisationen ?? []));

const weg = await rest(admin.access_token, `hub_organisationen?id=eq.${organisation.id}`, { method: 'DELETE' });
console.log('9 Organisation loeschen  :', weg.status);
const danach = await funktion('konto', nutzer.access_token, { handlung: 'organisationen' });
console.log('   Mitgliedschaft weg    :', (danach.body.organisationen ?? []).length === 0 ? 'ja' : 'NEIN');
