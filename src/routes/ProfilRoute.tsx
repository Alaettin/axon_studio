import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router";

import { Brotkrume, Glasflaeche, Seitentitel, Unterlinienfeld } from "@/components/Bausteine";
import { Flaeche } from "@/components/Flaeche";
import { Kopfzeile } from "@/components/Kopfzeile";
import { Palette } from "@/components/Palette";
import { supabase } from "@/lib/supabase";
import { initialen } from "@/lib/typen";
import { useKatalogteile, useSitzung } from "@/store/sitzung";

/**
 * Bildschirm 06 der Vorlage: das eigene Profil.
 *
 * Die E-Mail steht hier, aber sie ist nicht aenderbar: sie ist zugleich die Kennung fuer
 * die Anmeldung, und ein Wechsel braucht eine Bestaetigung ueber beide Adressen. Das ist
 * ein eigener Vorgang und nicht ein Feld in einem Formular.
 */

export function ProfilRoute() {
  const profil = useSitzung((z) => z.profil);
  const aktualisiere = useSitzung((z) => z.aktualisiere);
  const { offen: programme } = useKatalogteile();
  const [paletteOffen, setzePaletteOffen] = useState(false);

  const [name, setzeName] = useState("");
  const [laeuft, setzeLaeuft] = useState(false);
  const [meldung, setzeMeldung] = useState<string | null>(null);
  const [fehler, setzeFehler] = useState<string | null>(null);

  /*
   * Das Feld wird **einmal je Nutzer** vorbelegt, nicht bei jedem neuen Profilobjekt.
   *
   * Der Unterschied ist kein Feinschliff. `aktualisiere()` laeuft bei jedem Auftauchen des
   * Fensters und liefert ein frisches Profilobjekt; ein Effekt an `[profil]` haette dann
   * getippten, ungespeicherten Text ueberschrieben, sobald jemand kurz in ein anderes
   * Fenster wechselt. Aufgefallen ist es beim Browsertest: dort kam das Profil erst nach
   * dem Tippen an, der Name sprang zurueck, und "Speichern" blieb fuer immer grau, weil
   * sich aus Sicht des Formulars nichts geaendert hatte.
   */
  const vorbelegtFuer = useRef<string | null>(null);
  useEffect(() => {
    if (!profil || vorbelegtFuer.current === profil.id) return;
    vorbelegtFuer.current = profil.id;
    setzeName(profil.display_name ?? "");
  }, [profil]);

  const speichern = async () => {
    if (!profil) return;
    setzeLaeuft(true);
    setzeMeldung(null);
    setzeFehler(null);

    const { error } = await supabase
      .from("profiles")
      .update({ display_name: name.trim() || null })
      .eq("id", profil.id);

    if (error) setzeFehler(error.message);
    else {
      setzeMeldung("Gespeichert.");
      await aktualisiere();
    }
    setzeLaeuft(false);
  };

  const geaendert = profil ? name.trim() !== (profil.display_name ?? "") : false;

  return (
    <Flaeche schleier={paletteOffen ? "dicht" : "sammlung"} className="px-14 pt-[30px] pb-9">
      <Kopfzeile oeffnePalette={() => setzePaletteOffen(true)} gedaempft={paletteOffen} />

      <div className="flex min-h-0 flex-1 flex-col items-center pt-9">
        <div className="flex w-[1000px] max-w-full flex-col gap-6">
          <div className="flex flex-col gap-[9px]">
            <Brotkrume>
              <Link to="/" className="text-axon-schrift-leise hover:text-axon-fokus">
                ← Studio
              </Link>
              <span className="text-axon-trenner">/</span>
              <span>Konto</span>
            </Brotkrume>
            <Seitentitel>Profil</Seitentitel>
          </div>

          <div className="flex items-center gap-[18px]">
            <span
              aria-hidden
              className="flex size-[60px] items-center justify-center rounded-full border border-axon-avatar-rand bg-axon-avatar font-sans text-lg text-axon-schrift"
            >
              {profil ? initialen(profil) : "?"}
            </span>
            <div className="flex flex-col gap-1">
              <span className="font-display text-2xl font-light text-axon-schrift">
                {profil?.display_name ?? "Ohne Namen"}
              </span>
              <span className="font-mono text-xs tracking-fein uppercase text-axon-schrift-still">
                {profil?.role === "admin" ? "Administrator" : "Nutzer"}
                {profil?.status === "gesperrt" && " · gesperrt"}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-start gap-[26px]">
            <Glasflaeche titel="Angaben" className="min-w-[420px] flex-1">
              {/*
                Erst wenn das Profil da ist. Ein Formular, das leer erscheint und sich dann
                selbst fuellt, ueberschreibt genau das, was jemand in der Zwischenzeit
                getippt hat, und danach bleibt "Speichern" grau, weil sich aus seiner Sicht
                nichts geaendert hat. Genau so ist es im Browsertest passiert.
              */}
              {!profil ? (
                <p className="px-[22px] py-6 font-mono text-2xs tracking-etikett uppercase text-axon-schrift-still">
                  Profil wird geladen
                </p>
              ) : (
              <div className="flex flex-col gap-[22px] p-[22px]">
                <Unterlinienfeld
                  beschriftung="Name"
                  wert={name}
                  setze={setzeName}
                  autoComplete="name"
                />
                <Unterlinienfeld
                  beschriftung="E-Mail"
                  wert={profil?.email ?? ""}
                  gesperrt
                  hinweis="Die E-Mail ist auch die Kennung für die Anmeldung."
                />

                <p aria-live="polite" className="min-h-4 font-sans text-sm text-axon-fehler">
                  {fehler ?? meldung ?? ""}
                </p>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => void speichern()}
                    disabled={!geaendert || laeuft}
                    className="h-(--h-knopf) cursor-pointer bg-axon-aktion px-5 font-sans text-sm tracking-[0.14em] uppercase text-axon-aktion-schrift transition-colors duration-calm hover:bg-axon-aktion-hover disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    Speichern
                  </button>
                  {/*
                    Ein Link auf das Formular, keine Mail. Der Knopf rief bisher
                    `resetPasswordForEmail` und meldete "die Mail ist unterwegs"; verschickt
                    wurde nie eine, es gibt keinen SMTP-Dienst. Ein Knopf, der stumm endet,
                    ist schlimmer als keiner.
                  */}
                  <Link
                    to="/passwort-setzen"
                    className="flex h-(--h-knopf) cursor-pointer items-center border border-axon-linie px-5 font-sans text-sm tracking-[0.14em] uppercase text-axon-schrift-leise transition-colors duration-calm hover:border-axon-fokus hover:text-axon-schrift"
                  >
                    Passwort ändern
                  </Link>
                </div>
              </div>
              )}
            </Glasflaeche>

            <Glasflaeche titel="Meine Freischaltungen" className="w-[330px]">
              <ul className="flex flex-col">
                {programme.length === 0 && (
                  <li className="px-[22px] py-4 font-sans text-base text-axon-schrift-fein">
                    Noch keine.
                  </li>
                )}
                {programme.map((programm) => (
                  <li
                    key={programm.id}
                    className="flex items-center gap-3 border-b border-axon-zeile-linie px-[22px] py-[13px] last:border-b-0"
                  >
                    <span
                      aria-hidden
                      style={{ backgroundColor: programm.akzent }}
                      className="size-[6px] rounded-full"
                    />
                    <span className="font-sans text-md text-axon-schrift">{programm.name}</span>
                    <span className="ml-auto font-mono text-2xs uppercase text-axon-schrift-fein">
                      {programm.kuerzel}
                    </span>
                  </li>
                ))}
              </ul>
            </Glasflaeche>
          </div>

          <Freigaben />
        </div>
      </div>

      <Palette offen={paletteOffen} setzeOffen={setzePaletteOffen} />
    </Flaeche>
  );
}

/**
 * Erteilte Freigaben, und der Weg zurueck.
 *
 * Die Zustimmungsseite verspricht seit Runde 1 "laesst sich spaeter zuruecknehmen", und
 * bis hierher gab es dafuer keinen Ort. `revokeGrant` nimmt die Zustimmung zurueck, beendet
 * die Sitzungen dieses Clients und entwertet seine Refresh-Token.
 *
 * Das Programm steht mit Namen da, wenn es im Katalog liegt: `listGrants` liefert nur die
 * Client-Kennung, und "Ein Programm" waere hier die unbrauchbarste aller Angaben.
 */
function Freigaben() {
  const [grants, setzeGrants] = useState<
    readonly { clientId: string; scopes: readonly string[]; seit: string; name: string | null }[]
  >([]);
  const [laedt, setzeLaedt] = useState(true);
  const [fehler, setzeFehler] = useState<string | null>(null);

  const laden = useCallback(async () => {
    setzeLaedt(true);
    setzeFehler(null);
    const { data, error } = await supabase.auth.oauth.listGrants();
    if (error) {
      setzeFehler(error.message);
      setzeLaedt(false);
      return;
    }
    const kennungen = (data ?? []).map((g) => g.client.id);
    const namen = new Map<string, string>();
    if (kennungen.length > 0) {
      const { data: treffer } = await supabase
        .from("hub_app_clients")
        .select("oauth_client_id, hub_apps(name)")
        .in("oauth_client_id", kennungen);
      for (const t of (treffer ?? []) as unknown as {
        oauth_client_id: string;
        hub_apps?: { name: string } | null;
      }[]) {
        if (t.hub_apps) namen.set(t.oauth_client_id, t.hub_apps.name);
      }
    }
    setzeGrants(
      (data ?? []).map((g) => ({
        clientId: g.client.id,
        scopes: g.scopes,
        seit: g.granted_at,
        name: namen.get(g.client.id) ?? null,
      })),
    );
    setzeLaedt(false);
  }, []);

  useEffect(() => {
    void laden();
  }, [laden]);

  async function widerrufen(clientId: string) {
    setzeFehler(null);
    const { error } = await supabase.auth.oauth.revokeGrant({ clientId });
    if (error) setzeFehler(error.message);
    await laden();
  }

  return (
    <Glasflaeche titel="Erteilte Freigaben">
      {fehler && (
        <p role="alert" className="px-[22px] py-4 font-sans text-base text-axon-fehler">
          {fehler}
        </p>
      )}
      {laedt && (
        <p className="px-[22px] py-4 font-mono text-2xs tracking-etikett uppercase text-axon-schrift-still">
          Wird geladen
        </p>
      )}
      {!laedt && grants.length === 0 && !fehler && (
        <p className="px-[22px] py-4 font-sans text-base text-axon-schrift-fein">
          Du hast noch keinem Programm Zugriff auf dein Konto erteilt.
        </p>
      )}
      <ul className="flex flex-col">
        {grants.map((g) => (
          <li
            key={g.clientId}
            className="flex items-center gap-4 border-b border-axon-zeile-linie px-[22px] py-[13px] last:border-b-0"
          >
            <span className="flex min-w-0 flex-col gap-[3px]">
              <span className="truncate font-sans text-md text-axon-schrift">
                {g.name ?? "Nicht im Katalog"}
              </span>
              <span className="truncate font-mono text-2xs text-axon-schrift-fein">
                {g.scopes.join(" ")} · seit{" "}
                {new Date(g.seit).toLocaleDateString("de-DE")}
              </span>
            </span>
            <button
              type="button"
              onClick={() => void widerrufen(g.clientId)}
              className="ml-auto shrink-0 cursor-pointer border border-axon-linie px-3 py-[6px] font-mono text-2xs tracking-fein uppercase text-axon-schrift-leise transition-colors duration-quick hover:border-axon-fehler-kraeftig hover:text-axon-schrift"
            >
              Zurücknehmen
            </button>
          </li>
        ))}
      </ul>
    </Glasflaeche>
  );
}
