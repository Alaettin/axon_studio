import { createClient } from "jsr:@supabase/supabase-js@2";

/**
 * Was ein Angemeldeter ueber sein eigenes Konto darf:
 *
 *   passwort-wechseln  Neues Passwort setzen und die Marke `passwortwechsel_faellig`
 *                      loeschen.
 *   organisationen     Zu welchen Organisationen er gehoert. **Der Vertrag mit den
 *                      Unterprogrammen**: sie fragen das einmal nach dem Codetausch, mit dem
 *                      Zugriffstoken, das sie dabei bekommen haben.
 *
 * **Warum eine zweite Funktion und nicht eine Handlung in `verwaltung`.** Dort steht die
 * Pruefung auf Administrator bewusst *vor* dem `switch`, damit es keine Handlung ohne sie
 * geben kann. Eine Ausnahme davor waere genau die Luecke, die diese Anordnung verhindern
 * soll.
 *
 * **Warum ueberhaupt serverseitig.** `supabase.auth.updateUser({ password })` im Browser
 * wuerde das Passwort setzen, aber die Marke nicht loeschen; und darf der Nutzer die Marke
 * selbst loeschen, ist der Zwang zum Wechsel eine Bitte. Der Trigger
 * `schuetze_rolle_und_status` laesst sie deshalb nur den Dienst anfassen, und der Dienst
 * ist hier. Passwort und Marke aendern sich damit in einem Aufruf, oder gar nicht.
 */

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

/** Dieselbe Untergrenze wie in der Oberflaeche. Sie steht hier, weil sie hier gilt. */
const MINDESTLAENGE = 10;

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

  // Wer ruft, sagt das Token, nicht der Rumpf: eine Kennung aus dem Rumpf waere die
  // Erlaubnis, fremde Passwoerter zu setzen.
  const alsAufrufer = createClient(url, oeffentlich, {
    global: { headers: { Authorization: mitgabe } },
  });
  const { data: nutzer } = await alsAufrufer.auth.getUser();
  if (!nutzer.user) return antwort({ fehler: "Nicht angemeldet." }, 401);

  let auftrag: { handlung?: string; [k: string]: unknown };
  try {
    auftrag = (await anfrage.json()) as typeof auftrag;
  } catch {
    return antwort({ fehler: "Der Rumpf ist kein JSON." }, 400);
  }

  const dienst = createClient(url, geheim, { auth: { persistSession: false } });

  switch (auftrag.handlung) {
    case "passwort-wechseln":
      return await passwortWechseln(dienst, auftrag, nutzer.user.id, nutzer.user.email ?? "");
    case "organisationen":
      return await organisationen(dienst, nutzer.user.id);
    default:
      return antwort({ fehler: `Unbekannte Handlung: ${String(auftrag.handlung)}` }, 400);
  }
});

// deno-lint-ignore no-explicit-any
type Dienst = any;

async function passwortWechseln(
  dienst: Dienst,
  auftrag: Record<string, unknown>,
  kennung: string,
  adresse: string,
): Promise<Response> {
  const passwort = typeof auftrag["passwort"] === "string" ? auftrag["passwort"] : "";
  if (passwort.length < MINDESTLAENGE) {
    return antwort(
      { fehler: `Das Passwort braucht mindestens ${String(MINDESTLAENGE)} Zeichen.` },
      400,
    );
  }

  const { error: authFehler } = await dienst.auth.admin.updateUserById(kennung, {
    password: passwort,
  });
  if (authFehler) return antwort({ fehler: authFehler.message }, 400);

  const { error } = await dienst
    .from("profiles")
    .update({ passwortwechsel_faellig: false })
    .eq("id", kennung);
  if (error) return antwort({ fehler: error.message }, 500);

  // Die Historie schliessen, damit `angenommen_am` etwas aussagt statt leer zu bleiben.
  // Ein Fehler hier darf den Wechsel nicht kippen, das Passwort steht schon.
  const email = adresse.toLowerCase();
  if (email) {
    await dienst
      .from("hub_invitations")
      .update({ angenommen_am: new Date().toISOString() })
      .eq("email", email)
      .is("angenommen_am", null);
  }

  return antwort({ kennung });
}

/**
 * Wozu gehoert der Aufrufer?
 *
 * **Das ist der Vertrag mit den Unterprogrammen.** Ein Programm ruft das einmal nach dem
 * Codetausch, mit dem Zugriffstoken, das es dabei bekommen hat, und legt die Antwort in seine
 * eigene Sitzung. Gemessen am 07.09.2026: ein solches Token traegt `role: authenticated` und die
 * Kennung des Nutzers, `auth.getUser()` oben nimmt es also an (`scripts/oauth-rundlauf.mjs`).
 *
 * Warum nicht als Anspruch im Token: der Hook dafuer laeuft bei **jeder** Tokenausstellung des
 * geteilten Projekts, also auch fuer die AAS Tools Platform, und ein Anspruch ist eine
 * Momentaufnahme. Hier steht der Stand von jetzt.
 *
 * Sortiert nach Namen, damit ein Programm, das nur einen Arbeitsbereich kennt, immer denselben
 * ersten Eintrag bekommt und nicht bei jeder Anmeldung einen anderen.
 */
async function organisationen(dienst: Dienst, kennung: string): Promise<Response> {
  const { data, error } = await dienst
    .from("hub_organisation_mitglieder")
    .select("rolle, seit, hub_organisationen(id, name)")
    .eq("user_id", kennung);
  if (error) return antwort({ fehler: error.message }, 500);

  /*
   * PostgREST liefert bei einer Beziehung nach oben ein Objekt. Trotzdem beides zulassen: die
   * erzeugten Typen von supabase-js sagen ein Feld, und wer sich hier auf eine der beiden
   * Aussagen verlaesst, bekommt im Zweifel eine leere Liste statt eines Fehlers.
   */
  const liste = (data ?? [])
    .map((zeile: Record<string, unknown>) => {
      const roh = zeile["hub_organisationen"];
      const org = (Array.isArray(roh) ? roh[0] : roh) as { id: string; name: string } | null;
      return org ? { id: org.id, name: org.name, rolle: zeile["rolle"], seit: zeile["seit"] } : null;
    })
    .filter((o: unknown): o is { id: string; name: string } => o !== null)
    .sort((a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name, "de"));

  return antwort({ kennung, organisationen: liste });
}
