import { rufe } from "@/lib/funktion";

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
