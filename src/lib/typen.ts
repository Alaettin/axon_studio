/**
 * Die Ausschnitte des Schemas, die der Hub anfasst.
 *
 * Bewusst von Hand und klein gehalten statt `generate_typescript_types`: das Projekt hat
 * 28 Tabellen, davon gehen den Hub vier etwas an. Eine erzeugte Datei mit allen 28 waere
 * zu 85 Prozent Rauschen und bei jeder Aenderung der Tools-Plattform ein Diff.
 */

export type Rolle = "user" | "admin";
export type Status = "aktiv" | "gesperrt";

/** `public.profiles`, geteilt mit der AAS Tools Platform. */
export interface Profil {
  readonly id: string;
  readonly email: string | null;
  readonly display_name: string | null;
  readonly avatar_url: string | null;
  readonly role: Rolle;
  readonly status: Status;
  readonly created_at: string;
  readonly updated_at: string | null;
}

/** `public.hub_apps`, der Katalog der Unterprogramme. */
export interface Programm {
  readonly id: string;
  readonly name: string;
  readonly kuerzel: string;
  readonly kurz: string;
  readonly akzent: string;
  readonly url: string | null;
  readonly sortierung: number;
  readonly aktiv: boolean;
}

/** `public.hub_invitations`. */
export interface Einladung {
  readonly id: string;
  readonly email: string;
  readonly rolle: Rolle;
  readonly apps: readonly string[];
  readonly eingeladen_von: string | null;
  readonly eingeladen_am: string;
  readonly angenommen_am: string | null;
}

/**
 * Eine Zeile der Nutzerliste: Profil plus abgeleitete Angaben, die nicht in `profiles`
 * stehen. `zuletzt_angemeldet` kommt aus `auth.users` und damit nur ueber die Edge
 * Function, nicht ueber die Tabelle.
 */
export interface Nutzerzeile extends Profil {
  readonly programme: readonly string[];
  readonly zuletzt_angemeldet: string | null;
}

/** Die Initialen fuer den Kreis oben rechts und die Tabelle. */
export function initialen(profil: Pick<Profil, "display_name" | "email">): string {
  const quelle = profil.display_name?.trim() || profil.email?.split("@")[0] || "?";
  const teile = quelle.split(/[\s._-]+/u).filter(Boolean);
  const erste = teile[0]?.[0] ?? "?";
  const zweite = teile.length > 1 ? (teile[teile.length - 1]?.[0] ?? "") : "";
  return (erste + zweite).toUpperCase();
}

/** Der Vorname fuer die Begruessung. Ohne ihn gruesst der Hub die Adresse, das ist kalt. */
export function anrede(profil: Pick<Profil, "display_name" | "email">): string {
  const name = profil.display_name?.trim();
  if (name) return name.split(/\s+/u)[0] ?? name;
  return profil.email?.split("@")[0] ?? "";
}
