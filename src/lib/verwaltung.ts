import { rufe as rufeFunktion } from "@/lib/funktion";
import { mitFrist, supabase } from "@/lib/supabase";
import type {
  Abnahmepunkt,
  Nutzerzeile,
  Programm,
  Programmclient,
  Programmstatus,
  Rolle,
  Umgebung,
} from "@/lib/typen";

/**
 * Der Zugang zur Edge Function `verwaltung`.
 *
 * Alles hier braucht den `service_role`-Schluessel und laeuft deshalb serverseitig. Die
 * Funktion prueft selbst, dass der Aufrufer Administrator ist; die Waechter im Browser
 * sind nur Bequemlichkeit.
 */

function rufe<T>(handlung: string, rest: Record<string, unknown> = {}): Promise<T> {
  return rufeFunktion<T>("verwaltung", handlung, rest);
}

export function ladeNutzer(): Promise<{ nutzer: Nutzerzeile[] }> {
  return rufe<{ nutzer: Nutzerzeile[] }>("liste");
}

/**
 * Legt den Zugang an und gibt das Startpasswort zurueck. Es wird **keine Mail verschickt**:
 * der Admin gibt das Passwort selbst weiter (Entscheidung 07.09.2026). Beim ersten
 * Anmelden muss der Neue es wechseln.
 */
export function legeZugangAn(
  email: string,
  rolle: Rolle,
  apps: readonly string[],
): Promise<{ kennung: string; email: string; startpasswort: string }> {
  return rufe("anlegen", { email, rolle, apps });
}

/**
 * Neues Startpasswort fuer einen bestehenden Zugang. Der einzige Weg zurueck, wenn jemand
 * sein Passwort vergisst: eine Mail zum Zuruecksetzen kann niemand verschicken.
 */
export function setzePasswortZurueck(
  kennung: string,
): Promise<{ kennung: string; startpasswort: string }> {
  return rufe("passwort-zuruecksetzen", { kennung });
}

export function setzeStatus(kennung: string, gesperrt: boolean): Promise<unknown> {
  return rufe("status", { kennung, gesperrt });
}

/** Rolle und Freischaltungen gehen ueber die Tabelle: RLS laesst Admins dort schreiben. */
export async function setzeRolle(kennung: string, rolle: Rolle): Promise<void> {
  const { error } = await supabase.from("profiles").update({ role: rolle }).eq("id", kennung);
  if (error) throw new Error(error.message);
}

export async function setzeFreischaltung(
  kennung: string,
  programm: string,
  frei: boolean,
): Promise<void> {
  const { error } = frei
    ? await supabase.from("user_tool_access").upsert({ user_id: kennung, tool_id: programm })
    : await supabase
        .from("user_tool_access")
        .delete()
        .eq("user_id", kennung)
        .eq("tool_id", programm);
  if (error) throw new Error(error.message);
}

/* --- Programme -------------------------------------------------------------------- */

/**
 * Katalog samt Umgebungen. Beides über RLS lesbar, also ohne Umweg über die Edge
 * Function: sie wird nur gebraucht, wo der `service_role`-Schlüssel nötig ist.
 */
export async function ladeKatalog(): Promise<{
  programme: Programm[];
  clients: Programmclient[];
  /** Je Programm die Zahl der Nutzer, die es sehen. */
  freigeschaltet: Record<string, number>;
}> {
  const [programme, clients, zugriffe] = await Promise.all([
    mitFrist(supabase.from("hub_apps").select("*").order("sortierung", { ascending: true })),
    mitFrist(supabase.from("hub_app_clients").select("*")),
    // Ein Admin sieht hier alle Zeilen, ein normaler Nutzer nur die eigenen. Der Katalog
    // ist eine Verwaltungsseite, also stimmt die Zahl fuer den, der sie sieht.
    mitFrist(supabase.from("user_tool_access").select("tool_id")),
  ]);
  const fehler = programme.error ?? clients.error ?? zugriffe.error;
  if (fehler) throw new Error(fehler.message);

  const freigeschaltet: Record<string, number> = {};
  for (const z of (zugriffe.data ?? []) as { tool_id: string }[]) {
    freigeschaltet[z.tool_id] = (freigeschaltet[z.tool_id] ?? 0) + 1;
  }

  return {
    programme: (programme.data ?? []) as Programm[],
    clients: (clients.data ?? []) as Programmclient[],
    freigeschaltet,
  };
}

/**
 * Legt die Zeile an. Nur Schritt 1 des Assistenten ruft das, mit allen Pflichtfeldern.
 *
 * Getrennt von `aendereProgramm`, und zwar nicht aus Ordnungsliebe: ein `upsert` mit
 * wenigen Spalten ist trotzdem ein INSERT, und der scheitert an `name NOT NULL`, bevor
 * Postgres ueberhaupt zum Konflikt kommt. Genau so brach Schritt 2 im Browsertest ab
 * ("null value in column name violates not-null constraint"), obwohl die Zeile laengst
 * stand.
 */
export async function legeProgrammAn(
  felder: Partial<Programm> & { id: string; name: string },
): Promise<void> {
  const { error } = await supabase.from("hub_apps").upsert(felder);
  if (error) throw new Error(error.message);
}

/**
 * Ändert eine vorhandene Zeile. Der Assistent speichert **schrittweise**: in Schritt 4
 * entstehen echte OAuth-Clients, und bräche jemand danach ab, ohne dass etwas gespeichert
 * wäre, blieben Clients ohne Programm zurück, die niemand mehr findet.
 */
export async function aendereProgramm(id: string, felder: Partial<Programm>): Promise<void> {
  if (Object.keys(felder).length === 0) return;
  const { error } = await supabase.from("hub_apps").update(felder).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function loescheProgramm(id: string): Promise<void> {
  // Die Clients beim Aussteller zuerst, sonst bleiben sie dort stehen: der Fremdschlüssel
  // räumt nur unsere Zeilen weg, nicht die Registrierungen bei Supabase.
  const { data } = await supabase.from("hub_app_clients").select("oauth_client_id").eq("app_id", id);
  for (const c of (data ?? []) as { oauth_client_id: string }[]) {
    await loescheClient(c.oauth_client_id).catch(() => undefined);
  }
  const { error } = await supabase.from("hub_apps").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

/** Legt den OAuth-Client an. Das Geheimnis kommt **einmal** zurück und nie wieder. */
export function legeClientAn(
  appId: string,
  name: string,
  umgebung: Umgebung,
  redirectUri: string,
): Promise<{ client_id: string; client_secret: string; umgebung: Umgebung }> {
  return rufe("client-anlegen", { app_id: appId, name, umgebung, redirect_uri: redirectUri });
}

/**
 * Nur den Rückweg ändern, ohne neues Geheimnis. Ein Tippfehler in der Adresse soll kein
 * Deployment des Unterprogramms kosten.
 */
export function aendereRueckweg(
  oauthClientId: string,
  redirectUri: string,
): Promise<{ client_id: string; redirect_uri: string }> {
  return rufe("client-aendern", { oauth_client_id: oauthClientId, redirect_uri: redirectUri });
}

export function loescheClient(oauthClientId: string): Promise<unknown> {
  return rufe("client-loeschen", { oauth_client_id: oauthClientId });
}

export function erneuereGeheimnis(
  oauthClientId: string,
): Promise<{ client_id: string; client_secret: string }> {
  return rufe("geheimnis-erneuern", { oauth_client_id: oauthClientId });
}

/**
 * Die Abnahme läuft serverseitig: CORS ließe den Browser die fremde Adresse nicht lesen,
 * und der Abgleich der Redirect-URIs braucht den Dienstschlüssel.
 */
export function pruefeProgramm(
  appId: string,
): Promise<{ punkte: Abnahmepunkt[]; status: Programmstatus; fassung: string | null }> {
  return rufe("abnahme", { app_id: appId });
}

/** Wer die Kachel sieht. Schreibt `user_tool_access`, die mit der Tools-Plattform geteilte Tabelle. */
export async function setzeFreischaltungen(
  appId: string,
  nutzerIds: readonly string[],
): Promise<void> {
  const { error: weg } = await supabase.from("user_tool_access").delete().eq("tool_id", appId);
  if (weg) throw new Error(weg.message);
  if (nutzerIds.length === 0) return;
  const { error } = await supabase
    .from("user_tool_access")
    .upsert(nutzerIds.map((user_id) => ({ user_id, tool_id: appId })));
  if (error) throw new Error(error.message);
}
