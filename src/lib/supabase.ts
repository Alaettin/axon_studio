import { createClient } from "@supabase/supabase-js";

/**
 * Der eine Supabase-Client.
 *
 * Der Hub sattelt auf dem Projekt der AAS Tools Platform auf (Entscheidung 07.08.2026:
 * der Free-Plan gewaehrt nur zwei Projekte, und beide sind belegt). Eigene Tabellen tragen
 * das Praefix `hub_`, Nutzer und Freischaltungen stehen in `profiles` und
 * `user_tool_access` und werden geteilt.
 *
 * Hier steht ausschliesslich der **oeffentliche** Schluessel. Der `service_role`-Schluessel
 * lebt in den Secrets der Edge Functions; kaeme er in eine `VITE_`-Variable, buendelte Vite
 * ihn in die Anwendung und jeder Besucher haette ihn.
 */

const url = import.meta.env["VITE_SUPABASE_URL"];
const schluessel = import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"];

if (!url || !schluessel) {
  // Frueh und laut: eine Anmeldung, die still nicht funktioniert, kostet mehr Zeit als
  // ein Abbruch beim Start.
  throw new Error(
    "VITE_SUPABASE_URL und VITE_SUPABASE_PUBLISHABLE_KEY fehlen. Siehe .env.example.",
  );
}

export const supabase = createClient(url, schluessel, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    // PKCE, nicht der implizite Fluss: das Token steht dann nicht im Adressfeld und
    // landet nicht im Verlauf des Browsers.
    flowType: "pkce",
  },
});

/**
 * Nach dem Aufwachen aus dem Ruhezustand haelt der Client mitunter eine tote Verbindung
 * und jede Abfrage haengt, ohne zu scheitern. Der Anstoss von aussen bringt ihn zurueck.
 */
export function beobachteSichtbarkeit(): () => void {
  const bei = () => {
    if (document.visibilityState === "visible") void supabase.auth.startAutoRefresh();
    else void supabase.auth.stopAutoRefresh();
  };
  document.addEventListener("visibilitychange", bei);
  bei();
  return () => {
    document.removeEventListener("visibilitychange", bei);
  };
}

/**
 * Eine Zusage mit Frist.
 *
 * Ohne sie bleibt die Oberflaeche bei einer toten Verbindung fuer immer im Ladezustand,
 * und das ist der Fehler, den niemand meldet, weil er wie Langsamkeit aussieht.
 */
export async function mitFrist<T>(zusage: PromiseLike<T>, ms = 12_000): Promise<T> {
  let uhr: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      zusage,
      new Promise<never>((_, ab) => {
        uhr = setTimeout(() => {
          ab(new Error("Die Antwort kam nicht innerhalb von " + String(ms / 1000) + " Sekunden."));
        }, ms);
      }),
    ]);
  } finally {
    if (uhr) clearTimeout(uhr);
  }
}
