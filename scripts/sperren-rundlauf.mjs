const URL = 'https://acbkhrfzeyixxdbcbnah.supabase.co';
const KEY = 'sb_publishable_O5t63aRmEYmsFQWsC2-8Xw_U_tgVW_3';
const NUTZER = '9fe4c0d3-086c-4efd-bda1-e22b7d6686d1';

const anmelden = async (mail, pw) => {
  const r = await fetch(`${URL}/auth/v1/token?grant_type=password`, {
    method: 'POST', headers: { apikey: KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: mail, password: pw }),
  });
  return { status: r.status, body: await r.json() };
};
const verwaltung = async (token, rumpf) => {
  const r = await fetch(`${URL}/functions/v1/verwaltung`, {
    method: 'POST',
    headers: { apikey: KEY, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(rumpf),
  });
  return { status: r.status, body: await r.json() };
};

const admin = await anmelden('axon-probe-admin@example.invalid', 'ProbeAdmin!2026');
const nutzer = await anmelden('axon-probe-nutzer@example.invalid', 'ProbeNutzer!2026');
console.log('1 Nutzer meldet sich an (soll gehen)        :', nutzer.status);

console.log('2 Nutzer ruft die Verwaltung (soll 403)     :',
  JSON.stringify(await verwaltung(nutzer.body.access_token, { handlung: 'liste' })).slice(0, 120));

const gesperrt = await verwaltung(admin.body.access_token, { handlung: 'status', kennung: NUTZER, gesperrt: true });
console.log('3 Admin sperrt                              :', gesperrt.status, JSON.stringify(gesperrt.body).slice(0,90));

const nachSperre = await anmelden('axon-probe-nutzer@example.invalid', 'ProbeNutzer!2026');
console.log('4 Nutzer meldet sich an (soll scheitern)    :', nachSperre.status, JSON.stringify(nachSperre.body).slice(0,90));

const frei = await verwaltung(admin.body.access_token, { handlung: 'status', kennung: NUTZER, gesperrt: false });
console.log('5 Admin entsperrt                           :', frei.status);

const wieder = await anmelden('axon-probe-nutzer@example.invalid', 'ProbeNutzer!2026');
console.log('6 Nutzer meldet sich wieder an (soll gehen) :', wieder.status);
