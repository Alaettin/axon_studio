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

  /** Unter welcher Adresse der Dienst läuft, und wo er sich gesund meldet. */
  readonly basis_adresse: string | null;
  readonly gesundheitspfad: string;
  /**
   * Was das Programm anfordern darf.
   *
   * Durchgesetzt wird das auf **unserer** Zustimmungsseite: `createClient` kennt kein
   * Scope-Feld, ein Client kann technisch jeden der fünf unterstützten Scopes verlangen.
   * Der Katalog sagt, was verabredet war.
   */
  readonly scopes: readonly Scope[];
  readonly zustimmung_ueberspringen: boolean;
  readonly status: Programmstatus;
  /** Was die Abnahme zuletzt gemessen hat. */
  readonly fassung: string | null;
  readonly zuletzt_geprueft: string | null;
}

/**
 * Die wählbaren Akzente eines Programms.
 *
 * Sie stehen hier und nicht im Assistenten, weil sie **Daten** sind und keine Erscheinung:
 * sie landen in `hub_apps.akzent`, genau wie die Werte, die schon in der Datenbank stehen.
 * Im Bauteilcode hätten sie nichts zu suchen, und der Wächter in `test/erscheinung.test.ts`
 * würde sie dort auch nicht dulden.
 */
export const AKZENTE = [
  "#00A386",
  "#3F7FD0",
  "#B0873E",
  "#9A5BC4",
  "#C4585B",
  "#4FA3A8",
] as const;

/** Die fünf, die der Server kennt. Ein eigener Scope wird abgewiesen. */
export const SCOPES = ["openid", "profile", "email", "phone", "offline_access"] as const;
export type Scope = (typeof SCOPES)[number];

/**
 * `connector` ist kein Betriebszustand des Programms, sondern ein fremder Klient, der auf
 * es zeigt: claude.ai verbindet sich mit dem MCP-Zugang des Editors und braucht dafür
 * einen eigenen Client mit Rückleitung auf `claude.ai`.
 */
export type Umgebung = "produktion" | "test" | "lokal" | "connector";
export type Programmstatus = "entwurf" | "aktiv" | "pruefen";

/** `public.hub_app_clients`: je Umgebung ein eigener Client mit eigenem Geheimnis. */
export interface Programmclient {
  readonly id: string;
  readonly app_id: string;
  readonly umgebung: Umgebung;
  readonly oauth_client_id: string;
  readonly redirect_uri: string;
  readonly created_at: string;
}

/** Ein Punkt der Abnahme. `gut === null` heißt: nicht automatisch prüfbar. */
export interface Abnahmepunkt {
  readonly name: string;
  readonly gut: boolean | null;
  readonly befund: string;
}

/**
 * Was ein Scope für einen Menschen bedeutet. Dieselbe Vokabel auf der Zustimmungsseite
 * und im Assistenten, damit ein Administrator vorher sieht, was der Nutzer nachher liest.
 */
export const SCOPE_TEXT: Record<Scope, { titel: string; detail: string }> = {
  openid: {
    titel: "Wer du bist",
    detail: "Deine Kennung in AXON Studio, damit das Programm dich wiedererkennt.",
  },
  profile: {
    titel: "Dein Name",
    detail: "Anzeigename und Bild, soweit hinterlegt.",
  },
  email: {
    titel: "Deine E-Mail-Adresse",
    detail: "Lesen, nicht ändern.",
  },
  phone: {
    titel: "Deine Telefonnummer",
    detail: "Lesen, nicht ändern. Wird hier nirgends gepflegt.",
  },
  offline_access: {
    titel: "Zugang auch ohne dich",
    detail: "Das Programm darf sich später erneut anmelden, ohne dass du dabei bist.",
  },
};

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
