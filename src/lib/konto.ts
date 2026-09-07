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
 * Über die Tabelle, aber **mit** Filter auf die eigene Kennung. Sich auf RLS zu verlassen wäre
 * hier falsch: die Policy lässt einen Administrator *alle* Mitgliedschaften lesen, und ohne den
 * Filter stand im Profil jede Zeile jeder Organisation. Bei zwei Mitgliedern in „Neoception"
 * hieß das zweimal „Neoception", und zwar nur für Administratoren, also für niemanden, der es
 * gemeldet hätte (gefunden am 07.09.2026, im Bild eines Nutzers).
 *
 * Die Edge Function `konto` beantwortet dieselbe Frage für die **Unterprogramme**, die keinen
 * Zugriff auf die Tabellen haben; sie filtert von jeher selbst.
 */
export async function ladeMeineOrganisationen(kennung: string): Promise<Mitgliedschaft[]> {
  const { data, error } = await mitFrist(
    supabase
      .from("hub_organisation_mitglieder")
      .select("rolle, hub_organisationen(id, name)")
      .eq("user_id", kennung),
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
