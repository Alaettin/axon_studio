import { createClient } from "jsr:@supabase/supabase-js@2";

import {
  abnahme,
  clientAendern,
  clientAnlegen,
  clientLoeschen,
  geheimnisErneuern,
} from "./clients.ts";

/**
 * Die Verwaltungsvorgaenge, die den `service_role`-Schluessel brauchen.
 *
 * Alle Handlungen in einer Funktion: die Pruefung, ob der Aufrufer Administrator ist, ist
 * der eigentliche Sicherheitspunkt, und sie soll an genau einer Stelle stehen. Eine Kopie
 * je Handlung waere eine Gelegenheit je Handlung, sie zu vergessen.
 *
 *   liste     Nutzer samt Rolle, Freischaltungen und letzter Anmeldung.
 *             `last_sign_in_at` steht in `auth.users` und ist ueber die Tabelle nicht
 *             lesbar, nur hier.
 *   anlegen   Zugang samt Startpasswort anlegen. Keine Mail, kein Link.
 *   passwort-zuruecksetzen
 *             Neues Startpasswort fuer einen bestehenden Zugang.
 *   status    Sperren und entsperren. Setzt `banned_until` **und** `profiles.status`:
 *             das eine haelt die Anmeldung an, das andere ist die Angabe, die die
 *             Oberflaeche zeigt.
 *
 * Alles rund um Programme liegt in `clients.ts`, damit diese Datei nicht zwei Themen
 * traegt: `client-anlegen`, `client-aendern`, `client-loeschen`, `geheimnis-erneuern`,
 * `abnahme`.
 *
 * Der Schluessel steht in den Secrets der Funktion, nie im Bundle der Anwendung.
 */

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function antwort(rumpf: unknown, status = 200): Response {
  return new Response(JSON.stringify(rumpf), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

Deno.serve(async (anfrage) => {
  if (anfrage.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const url = Deno.env.get("SUPABASE_URL");
  const geheim = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const oeffentlich = Deno.env.get("SUPABASE_ANON_KEY");
  if (!url || !geheim || !oeffentlich) {
    return antwort({ fehler: "Die Funktion ist nicht vollständig eingerichtet." }, 500);
  }

  const mitgabe = anfrage.headers.get("Authorization");
  if (!mitgabe) return antwort({ fehler: "Nicht angemeldet." }, 401);

  /*
   * Die Rechtepruefung laeuft ueber einen Client MIT dem Token des Aufrufers, nicht mit
   * dem Dienstschluessel: `is_admin()` liest `auth.uid()`, und die ist unter dem
   * Dienstschluessel leer. Ein Client mit dem Dienstschluessel wuerde die Frage also
   * immer mit "nein" beantworten und die Funktion waere fuer alle tot.
   */
  const alsAufrufer = createClient(url, oeffentlich, {
    global: { headers: { Authorization: mitgabe } },
  });

  const { data: nutzer } = await alsAufrufer.auth.getUser();
  if (!nutzer.user) return antwort({ fehler: "Nicht angemeldet." }, 401);

  const { data: istAdmin, error: pruefFehler } = await alsAufrufer.rpc("is_admin");
  if (pruefFehler) return antwort({ fehler: pruefFehler.message }, 500);
  if (istAdmin !== true) return antwort({ fehler: "Nur für Administratoren." }, 403);

  const dienst = createClient(url, geheim, { auth: { persistSession: false } });

  let auftrag: { handlung?: string; [k: string]: unknown };
  try {
    auftrag = (await anfrage.json()) as typeof auftrag;
  } catch {
    return antwort({ fehler: "Der Rumpf ist kein JSON." }, 400);
  }

  switch (auftrag.handlung) {
    case "liste":
      return await liste(dienst);
    case "anlegen":
      return await anlegen(dienst, auftrag, nutzer.user.id);
    case "passwort-zuruecksetzen":
      return await passwortZuruecksetzen(dienst, auftrag);
    case "status":
      return await status(dienst, auftrag);
    case "client-anlegen":
      return await clientAnlegen(dienst, auftrag, CORS);
    case "client-aendern":
      return await clientAendern(dienst, auftrag, CORS);
    case "client-loeschen":
      return await clientLoeschen(dienst, auftrag, CORS);
    case "geheimnis-erneuern":
      return await geheimnisErneuern(dienst, auftrag, CORS);
    case "abnahme":
      return await abnahme(dienst, auftrag, `${url}/auth/v1`, CORS);
    default:
      return antwort({ fehler: `Unbekannte Handlung: ${String(auftrag.handlung)}` }, 400);
  }
});

type Dienst = ReturnType<typeof createClient>;

async function liste(dienst: Dienst): Promise<Response> {
  const [profile, zugriffe, anmeldungen] = await Promise.all([
    dienst.from("profiles").select("*").order("created_at", { ascending: true }),
    dienst.from("user_tool_access").select("user_id, tool_id"),
    dienst.auth.admin.listUsers({ perPage: 1000 }),
  ]);

  const fehler = profile.error ?? zugriffe.error ?? anmeldungen.error;
  if (fehler) return antwort({ fehler: fehler.message }, 500);

  const zuletzt = new Map(
    anmeldungen.data.users.map((u) => [u.id, u.last_sign_in_at ?? null] as const),
  );
  const programme = new Map<string, string[]>();
  for (const zeile of zugriffe.data ?? []) {
    const bisher = programme.get(zeile.user_id as string) ?? [];
    bisher.push(zeile.tool_id as string);
    programme.set(zeile.user_id as string, bisher);
  }

  return antwort({
    nutzer: (profile.data ?? []).map((p) => ({
      ...p,
      programme: programme.get(p.id as string) ?? [],
      zuletzt_angemeldet: zuletzt.get(p.id as string) ?? null,
    })),
  });
}

/**
 * Ein Startpasswort.
 *
 * `crypto.getRandomValues` und ein Alphabet ohne verwechselbare Zeichen (kein I, l, 1, O,
 * 0): das Passwort wird abgelesen und weitergesagt, und ein Zeichen, das man falsch liest,
 * kostet genau die Anmeldung, die es ermoeglichen soll. Sechzehn Zeichen liegen deutlich
 * ueber der Mindestlaenge von zehn, die die Oberflaeche beim Wechseln verlangt.
 *
 * Der Rest ist die Zuteilung: `% ALPHABET.length` waere leicht ungleich verteilt, deshalb
 * werden Werte oberhalb des groessten Vielfachen verworfen.
 */
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";

function startpasswort(laenge = 16): string {
  const grenze = Math.floor(256 / ALPHABET.length) * ALPHABET.length;
  let wort = "";
  while (wort.length < laenge) {
    const puffer = new Uint8Array(laenge);
    crypto.getRandomValues(puffer);
    for (const wert of puffer) {
      if (wert >= grenze) continue;
      wort += ALPHABET[wert % ALPHABET.length];
      if (wort.length === laenge) break;
    }
  }
  return wort;
}

async function anlegen(
  dienst: Dienst,
  auftrag: Record<string, unknown>,
  von: string,
): Promise<Response> {
  const email = String(auftrag["email"] ?? "").trim().toLowerCase();
  const rolle = auftrag["rolle"] === "admin" ? "admin" : "user";
  const apps = Array.isArray(auftrag["apps"]) ? (auftrag["apps"] as string[]) : [];

  if (!email.includes("@")) return antwort({ fehler: "Das ist keine E-Mail-Adresse." }, 400);

  const passwort = startpasswort();

  /*
   * `createUser` statt `generateLink` (Entscheidung 07.09.2026). Der Einladungslink hing an
   * der Site URL des Projekts, und die gehoert einer fremden Anwendung; er war ausserdem
   * einmalig und lief ab, ohne dass es einen zweiten Weg herein gab. Das Konto steht jetzt
   * sofort, und der Admin gibt das Startpasswort weiter.
   *
   * `email_confirm: true` ist noetig, nicht Bequemlichkeit: sonst wartet das Konto auf eine
   * Bestaetigungsmail, und die verschickt hier niemand.
   */
  const { data: angelegt, error: anlegeFehler } = await dienst.auth.admin.createUser({
    email,
    password: passwort,
    email_confirm: true,
  });
  if (anlegeFehler) {
    // Der haeufigste Fall ist "gibt es schon", und das ist kein Serverfehler.
    const schon = /already|registered|exists/i.test(anlegeFehler.message);
    return antwort(
      {
        fehler: schon
          ? "Zu dieser Adresse gibt es bereits ein Konto."
          : anlegeFehler.message,
      },
      400,
    );
  }

  const neueKennung = angelegt.user.id;

  /*
   * Die Zeile in `profiles` legt der Trigger `handle_new_user` an, und zwar immer mit der
   * Rolle `user` und ohne die Marke fuer den Passwortwechsel. Beides wird deshalb hier
   * nachgezogen, nicht vorher.
   */
  const { error: profilFehler } = await dienst
    .from("profiles")
    .update({ passwortwechsel_faellig: true, ...(rolle === "admin" ? { role: "admin" } : {}) })
    .eq("id", neueKennung);
  if (profilFehler) return antwort({ fehler: profilFehler.message }, 500);

  if (apps.length > 0) {
    const { error } = await dienst
      .from("user_tool_access")
      .upsert(apps.map((tool_id) => ({ user_id: neueKennung, tool_id })));
    if (error) return antwort({ fehler: error.message }, 500);
  }

  /*
   * Historie. Der Fehler wird nicht mehr verschluckt: solange der Teilindex ueber offene
   * Einladungen bestand, scheiterte jede zweite Zeile je Adresse, und niemand erfuhr davon.
   * Der Index ist weg (Migration 20260907120000), also ist ein Fehler hier wieder einer.
   */
  const { error: historieFehler } = await dienst
    .from("hub_invitations")
    .insert({ email, rolle, apps, eingeladen_von: von });
  if (historieFehler) return antwort({ fehler: historieFehler.message }, 500);

  // Das Startpasswort ist das Ergebnis, nicht ein Nebenprodukt: es steht nirgends sonst,
  // und ohne es kommt der Neue nicht herein.
  return antwort({ kennung: neueKennung, email, startpasswort: passwort });
}

async function passwortZuruecksetzen(
  dienst: Dienst,
  auftrag: Record<string, unknown>,
): Promise<Response> {
  const kennung = String(auftrag["kennung"] ?? "");
  if (!kennung) return antwort({ fehler: "Es fehlt die Kennung des Nutzers." }, 400);

  const passwort = startpasswort();

  const { error: authFehler } = await dienst.auth.admin.updateUserById(kennung, {
    password: passwort,
  });
  if (authFehler) return antwort({ fehler: authFehler.message }, 500);

  const { error } = await dienst
    .from("profiles")
    .update({ passwortwechsel_faellig: true })
    .eq("id", kennung);
  if (error) return antwort({ fehler: error.message }, 500);

  /*
   * Dieselbe Ueberlegung wie beim Sperren: ein ausgegebenes Token ueberlebt die Aenderung
   * des Passworts. Wer zuruecksetzt, will die alte Sitzung beenden, nicht nur das Passwort
   * tauschen.
   */
  await dienst.auth.admin.signOut(kennung, "global");

  return antwort({ kennung, startpasswort: passwort });
}

async function status(dienst: Dienst, auftrag: Record<string, unknown>): Promise<Response> {
  const kennung = String(auftrag["kennung"] ?? "");
  const gesperrt = auftrag["gesperrt"] === true;
  if (!kennung) return antwort({ fehler: "Es fehlt die Kennung des Nutzers." }, 400);

  /*
   * Zwei Griffe, und beide sind noetig. `banned_until` haelt die Anmeldung an, wirkt aber
   * erst beim naechsten Versuch: ein bereits ausgegebenes Token bleibt bis zum Ablauf
   * gueltig. Deshalb zusaetzlich die Sitzungen beenden.
   */
  const { error: authFehler } = await dienst.auth.admin.updateUserById(kennung, {
    ban_duration: gesperrt ? "876000h" : "none",
  });
  if (authFehler) return antwort({ fehler: authFehler.message }, 500);

  if (gesperrt) await dienst.auth.admin.signOut(kennung, "global");

  const { error } = await dienst
    .from("profiles")
    .update({ status: gesperrt ? "gesperrt" : "aktiv" })
    .eq("id", kennung);
  if (error) return antwort({ fehler: error.message }, 500);

  return antwort({ kennung, gesperrt });
}
