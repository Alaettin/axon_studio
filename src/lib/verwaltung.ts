import { mitFrist, supabase } from "@/lib/supabase";
import type { Nutzerzeile, Rolle } from "@/lib/typen";

/**
 * Der Zugang zur Edge Function `verwaltung`.
 *
 * Alles hier braucht den `service_role`-Schluessel und laeuft deshalb serverseitig. Die
 * Funktion prueft selbst, dass der Aufrufer Administrator ist; die Waechter im Browser
 * sind nur Bequemlichkeit.
 */

async function rufe<T>(handlung: string, rest: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await mitFrist(
    supabase.functions.invoke<T & { fehler?: string }>("verwaltung", {
      body: { handlung, ...rest },
    }),
  );

  if (error) {
    // FunctionsHttpError verschweigt den Rumpf. Ohne dieses Auspacken steht in der
    // Oberflaeche "Edge Function returned a non-2xx status code" und niemand weiss, warum.
    const rumpf = await ausFehler(error);
    throw new Error(rumpf ?? error.message);
  }
  if (data && "fehler" in data && data.fehler) throw new Error(data.fehler);
  return data as T;
}

async function ausFehler(fehler: unknown): Promise<string | null> {
  if (
    typeof fehler === "object" &&
    fehler !== null &&
    "context" in fehler &&
    fehler.context instanceof Response
  ) {
    try {
      const rumpf = (await fehler.context.json()) as { fehler?: string };
      return rumpf.fehler ?? null;
    } catch {
      return null;
    }
  }
  return null;
}

export function ladeNutzer(): Promise<{ nutzer: Nutzerzeile[] }> {
  return rufe<{ nutzer: Nutzerzeile[] }>("liste");
}

/**
 * Legt den Nutzer an und gibt den Einladungslink zurueck. Es wird **keine Mail
 * verschickt**: der Admin gibt den Link selbst weiter (Entscheidung 07.08.2026).
 */
export function ladeEinladung(
  email: string,
  rolle: Rolle,
  apps: readonly string[],
): Promise<{ kennung: string; email: string; link: string }> {
  return rufe("einladen", {
    email,
    rolle,
    apps,
    // Wohin der Link aus der Mail fuehrt. Muss in den Redirect-URLs des Projekts stehen,
    // sonst landet der Eingeladene auf der Site URL und wundert sich.
    ziel: `${window.location.origin}/passwort-setzen`,
  });
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
