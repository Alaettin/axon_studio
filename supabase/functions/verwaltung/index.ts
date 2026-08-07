import { createClient } from "jsr:@supabase/supabase-js@2";

/**
 * Die Verwaltungsvorgaenge, die den `service_role`-Schluessel brauchen.
 *
 * Drei Handlungen in einer Funktion statt drei Funktionen: die Pruefung, ob der Aufrufer
 * Administrator ist, ist der eigentliche Sicherheitspunkt, und sie soll an genau einer
 * Stelle stehen. Drei Kopien davon waeren drei Gelegenheiten, eine zu vergessen.
 *
 *   liste     Nutzer samt Rolle, Freischaltungen und letzter Anmeldung.
 *             `last_sign_in_at` steht in `auth.users` und ist ueber die Tabelle nicht
 *             lesbar, nur hier.
 *   einladen  Einladung verschicken, Rolle und Freischaltungen vormerken.
 *   status    Sperren und entsperren. Setzt `banned_until` **und** `profiles.status`:
 *             das eine haelt die Anmeldung an, das andere ist die Angabe, die die
 *             Oberflaeche zeigt.
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
    case "einladen":
      return await einladen(dienst, auftrag, nutzer.user.id);
    case "status":
      return await status(dienst, auftrag);
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

async function einladen(
  dienst: Dienst,
  auftrag: Record<string, unknown>,
  von: string,
): Promise<Response> {
  const email = String(auftrag["email"] ?? "").trim().toLowerCase();
  const rolle = auftrag["rolle"] === "admin" ? "admin" : "user";
  const apps = Array.isArray(auftrag["apps"]) ? (auftrag["apps"] as string[]) : [];
  const ziel = typeof auftrag["ziel"] === "string" ? auftrag["ziel"] : undefined;

  if (!email.includes("@")) return antwort({ fehler: "Das ist keine E-Mail-Adresse." }, 400);

  /*
   * `generateLink` statt `inviteUserByEmail`: es legt den Nutzer genauso an, verschickt
   * aber **keine** Mail, sondern gibt den Link zurueck. Der Admin schickt ihn selbst.
   *
   * Grund (Entscheidung 07.08.2026): der eingebaute Versand von Supabase ist nicht fuer den
   * Betrieb gedacht, und ein eigener SMTP-Dienst braucht Absender und DNS-Eintraege, die es
   * beide noch nicht gibt. Bei einer Handvoll interner Nutzer ist der Link ehrlicher als
   * eine Mail-Einrichtung, und er ist sofort pruefbar: der Einladeweg war bisher der
   * einzige Pfad, den niemand durchlaufen konnte.
   */
  const { data: eingeladen, error: einladeFehler } = await dienst.auth.admin.generateLink({
    type: "invite",
    email,
    options: ziel ? { redirectTo: ziel } : undefined,
  });
  if (einladeFehler) {
    // Der haeufigste Fall ist "gibt es schon", und das ist kein Serverfehler.
    const schon = /already|registered|exists/i.test(einladeFehler.message);
    return antwort(
      {
        fehler: schon
          ? "Zu dieser Adresse gibt es bereits ein Konto."
          : einladeFehler.message,
      },
      400,
    );
  }

  const neueKennung = eingeladen.user.id;
  const link = eingeladen.properties.action_link;

  /*
   * Die Zeile in `profiles` legt der Trigger `handle_new_user` an, und zwar immer mit der
   * Rolle `user`. Die gewuenschte Rolle wird deshalb hier nachgezogen, nicht vorher.
   */
  if (rolle === "admin") {
    const { error } = await dienst.from("profiles").update({ role: "admin" }).eq("id", neueKennung);
    if (error) return antwort({ fehler: error.message }, 500);
  }

  if (apps.length > 0) {
    const { error } = await dienst
      .from("user_tool_access")
      .upsert(apps.map((tool_id) => ({ user_id: neueKennung, tool_id })));
    if (error) return antwort({ fehler: error.message }, 500);
  }

  // Historie. Ein Konflikt hier darf die Einladung nicht scheitern lassen, der Nutzer ist
  // schon angelegt: der eindeutige Index deckt nur offene Einladungen je Adresse ab.
  await dienst
    .from("hub_invitations")
    .insert({ email, rolle, apps, eingeladen_von: von });

  // Der Link ist das Ergebnis, nicht ein Nebenprodukt: ohne ihn kommt der Eingeladene
  // nicht herein, und es gibt keinen zweiten Weg, ihn zu bekommen.
  return antwort({ kennung: neueKennung, email, link });
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
