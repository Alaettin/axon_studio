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
 *   loeschvorschau
 *             Was haengt an diesem Zugang, und was sperrt sein Loeschen.
 *   loeschen  Zugang endgueltig entfernen. Erst nach abgetippter Adresse.
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
    case "loeschvorschau":
      return await loeschvorschau(dienst, auftrag);
    case "loeschen":
      return await loeschen(dienst, auftrag, nutzer.user.id);
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

/** Eine Zeile der Vorschau: eine Tabelle und die Zahl der Zeilen, die daran haengen. */
interface Posten {
  readonly tabelle: string;
  readonly anzahl: number;
}
interface Vorschau {
  readonly faellt_weg: Posten[];
  readonly blockiert: Posten[];
}

/**
 * Was haengt an diesem Zugang?
 *
 * Die Zaehlung steht in der Datenbank (`hub_loeschvorschau`) und leitet sich aus den
 * Fremdschluesseln ab. Hier eine Liste zu fuehren hiesse, sie zweimal zu fuehren, und die
 * zweite waere die falsche.
 */
async function vorschauFuer(dienst: Dienst, kennung: string): Promise<Vorschau> {
  const { data, error } = await dienst.rpc("hub_loeschvorschau", { kennung });
  if (error) throw new Error(error.message);
  return data as Vorschau;
}

async function loeschvorschau(
  dienst: Dienst,
  auftrag: Record<string, unknown>,
): Promise<Response> {
  const kennung = String(auftrag["kennung"] ?? "");
  if (!kennung) return antwort({ fehler: "Es fehlt die Kennung des Nutzers." }, 400);

  const { data: profil, error: leseFehler } = await dienst
    .from("profiles")
    .select("email, display_name")
    .eq("id", kennung)
    .maybeSingle();
  if (leseFehler) return antwort({ fehler: leseFehler.message }, 500);
  if (!profil) return antwort({ fehler: "Diesen Zugang gibt es nicht." }, 404);

  try {
    const vorschau = await vorschauFuer(dienst, kennung);
    return antwort({ kennung, email: profil.email, ...vorschau });
  } catch (ursache) {
    return antwort({ fehler: ursache instanceof Error ? ursache.message : "Unbekannt." }, 500);
  }
}

async function loeschen(
  dienst: Dienst,
  auftrag: Record<string, unknown>,
  aufrufer: string,
): Promise<Response> {
  const kennung = String(auftrag["kennung"] ?? "");
  const bestaetigung = String(auftrag["bestaetigung"] ?? "").trim().toLowerCase();
  if (!kennung) return antwort({ fehler: "Es fehlt die Kennung des Nutzers." }, 400);

  // Sich selbst zu loeschen ist der eine Weg, den Hub ohne Administrator zurueckzulassen. Die
  // Oberflaeche sperrt den Knopf schon, aber sie ist Bequemlichkeit und keine Sicherheit.
  if (kennung === aufrufer) {
    return antwort({ fehler: "Den eigenen Zugang kannst du nicht löschen." }, 400);
  }

  const { data: profil, error: leseFehler } = await dienst
    .from("profiles")
    .select("email, role, created_at")
    .eq("id", kennung)
    .maybeSingle();
  if (leseFehler) return antwort({ fehler: leseFehler.message }, 500);
  if (!profil) return antwort({ fehler: "Diesen Zugang gibt es nicht." }, 404);

  const email = String(profil.email ?? "").toLowerCase();

  // Die abgetippte Adresse wird **hier** geprueft. Eine Bestaetigung, die nur der Browser
  // prueft, ist Zierrat: der Aufruf geht auch ohne ihn.
  if (bestaetigung !== email) {
    return antwort({ fehler: "Die eingetippte Adresse stimmt nicht mit dem Zugang überein." }, 400);
  }

  let vorschau: Vorschau;
  try {
    vorschau = await vorschauFuer(dienst, kennung);
  } catch (ursache) {
    return antwort({ fehler: ursache instanceof Error ? ursache.message : "Unbekannt." }, 500);
  }

  /*
   * Sperrt etwas, sagen wir das im Klartext. Sonst antwortet GoTrue mit einem
   * Datenbankfehler, dem niemand ansieht, dass ein Handbuch in einer fremden Anwendung
   * im Weg steht.
   */
  if (vorschau.blockiert.length > 0) {
    const liste = vorschau.blockiert
      .map((p) => `${p.tabelle} (${String(p.anzahl)})`)
      .join(", ");
    return antwort(
      {
        fehler:
          `Dieser Zugang lässt sich nicht löschen, es hängen Einträge daran, die das ` +
          `verhindern: ${liste}. Sie gehören der AAS Tools Platform und werden hier nicht ` +
          `angefasst. Sperren geht.`,
        blockiert: vorschau.blockiert,
      },
      409,
    );
  }

  /*
   * Die Historie entsteht **vor** dem Loeschen: danach sind Rolle und Freischaltungen weg,
   * `user_tool_access` haengt am selben Cascade. Gibt es zu dieser Adresse noch keine Zeile
   * (jeder Zugang von vor dem 07.09.2026), wird eine angelegt, damit die Spur nicht davon
   * abhaengt, wann jemand angelegt wurde.
   */
  const jetzt = new Date().toISOString();
  const { data: offen } = await dienst
    .from("hub_invitations")
    .select("id")
    .eq("email", email)
    .is("geloescht_am", null)
    .order("eingeladen_am", { ascending: false })
    .limit(1);

  const vorhandene = (offen ?? [])[0]?.id as string | undefined;
  let historie: string | undefined;

  if (vorhandene) {
    const { error } = await dienst
      .from("hub_invitations")
      .update({ geloescht_am: jetzt, geloescht_von: aufrufer })
      .eq("id", vorhandene);
    if (error) return antwort({ fehler: error.message }, 500);
    historie = vorhandene;
  } else {
    const { data: zugriffe } = await dienst
      .from("user_tool_access")
      .select("tool_id")
      .eq("user_id", kennung);
    const { data: neue, error } = await dienst
      .from("hub_invitations")
      .insert({
        email,
        rolle: profil.role,
        apps: (zugriffe ?? []).map((z: { tool_id: string }) => z.tool_id),
        eingeladen_am: profil.created_at,
        geloescht_am: jetzt,
        geloescht_von: aufrufer,
      })
      .select("id")
      .single();
    if (error) return antwort({ fehler: error.message }, 500);
    historie = neue.id as string;
  }

  const { error: loeschFehler } = await dienst.auth.admin.deleteUser(kennung);
  if (loeschFehler) {
    // Die Spur zuruecknehmen: sonst steht dort eine Loeschung, die nicht stattgefunden hat.
    if (vorhandene) {
      await dienst
        .from("hub_invitations")
        .update({ geloescht_am: null, geloescht_von: null })
        .eq("id", historie);
    } else {
      await dienst.from("hub_invitations").delete().eq("id", historie);
    }
    return antwort({ fehler: loeschFehler.message }, 500);
  }

  return antwort({ kennung, email, entfernt: vorschau.faellt_weg });
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
