import { rufe } from "@/lib/funktion";
import { mitFrist, supabase } from "@/lib/supabase";
import type { Mitgliedschaft, Mitgliedsrolle } from "@/lib/typen";

/**
 * Das eigene Passwort wechseln.
 *
 * Ueber die Edge Function `konto` und nicht ueber `supabase.auth.updateUser`: das Passwort
 * und die Marke `passwortwechsel_faellig` gehoeren zusammen. Die Marke darf der Nutzer
 * nicht selbst loeschen (Trigger in der Datenbank), sonst waere der Zwang zum Wechsel eine
 * Bitte.
 */
export function wechslePasswort(passwort: string): Promise<{ kennung: string }> {
  return rufe("konto", "passwort-wechseln", { passwort });
}

/**
 * Die eigenen Organisationen, für das Profil.
 *
 * Über die Tabelle: RLS gibt jedem seine eigenen Zeilen frei, und der Hub ist selbst angemeldet.
 * Die Edge Function `konto` beantwortet dieselbe Frage, sie ist für die **Unterprogramme** da,
 * die keinen Zugriff auf die Tabellen haben.
 */
export async function ladeMeineOrganisationen(): Promise<Mitgliedschaft[]> {
  const { data, error } = await mitFrist(
    supabase
      .from("hub_organisation_mitglieder")
      .select("rolle, hub_organisationen(id, name)"),
  );
  if (error) throw new Error(error.message);

  return (data ?? [])
    .map((zeile) => {
      const { rolle, hub_organisationen: verknuepft } = zeile as unknown as {
        rolle: Mitgliedsrolle;
        /*
         * PostgREST liefert bei einer Beziehung nach oben ein Objekt, die erzeugten Typen von
         * supabase-js sagen ein Feld. Beides zulassen und hier einmal geradeziehen, statt sich
         * auf eine der beiden Aussagen zu verlassen.
         */
        hub_organisationen: { id: string; name: string } | { id: string; name: string }[] | null;
      };
      const org = Array.isArray(verknuepft) ? verknuepft[0] : verknuepft;
      return org ? { id: org.id, name: org.name, rolle } : null;
    })
    .filter((o): o is Mitgliedschaft => o !== null)
    .sort((a, b) => a.name.localeCompare(b.name, "de"));
}
