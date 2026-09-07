import { createClient } from "jsr:@supabase/supabase-js@2";

/**
 * Was ein Angemeldeter an seinem eigenen Konto aendern darf. Zurzeit genau eines:
 *
 *   passwort-wechseln  Neues Passwort setzen und die Marke `passwortwechsel_faellig`
 *                      loeschen.
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

  if (auftrag.handlung !== "passwort-wechseln") {
    return antwort({ fehler: `Unbekannte Handlung: ${String(auftrag.handlung)}` }, 400);
  }

  const passwort = typeof auftrag["passwort"] === "string" ? auftrag["passwort"] : "";
  if (passwort.length < MINDESTLAENGE) {
    return antwort(
      { fehler: `Das Passwort braucht mindestens ${String(MINDESTLAENGE)} Zeichen.` },
      400,
    );
  }

  const dienst = createClient(url, geheim, { auth: { persistSession: false } });

  const { error: authFehler } = await dienst.auth.admin.updateUserById(nutzer.user.id, {
    password: passwort,
  });
  if (authFehler) return antwort({ fehler: authFehler.message }, 400);

  const { error } = await dienst
    .from("profiles")
    .update({ passwortwechsel_faellig: false })
    .eq("id", nutzer.user.id);
  if (error) return antwort({ fehler: error.message }, 500);

  // Die Historie schliessen, damit `angenommen_am` etwas aussagt statt leer zu bleiben.
  // Ein Fehler hier darf den Wechsel nicht kippen, das Passwort steht schon.
  const email = (nutzer.user.email ?? "").toLowerCase();
  if (email) {
    await dienst
      .from("hub_invitations")
      .update({ angenommen_am: new Date().toISOString() })
      .eq("email", email)
      .is("angenommen_am", null);
  }

  return antwort({ kennung: nutzer.user.id });
});
