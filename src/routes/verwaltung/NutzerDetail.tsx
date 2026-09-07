import { useState } from "react";

import { Etikett } from "@/components/Bausteine";
import { Modal } from "@/components/Modal";
import { initialen, type Nutzerzeile, type Rolle } from "@/lib/typen";
import {
  setzeFreischaltung,
  setzePasswortZurueck,
  setzeRolle,
  setzeStatus,
} from "@/lib/verwaltung";
import { useSitzung } from "@/store/sitzung";

/**
 * Bildschirm 08 der Vorlage: Rolle und Freischaltungen eines Nutzers.
 *
 * Jede Aenderung geht sofort an den Server, es gibt kein "Speichern". Ein Formular mit
 * Sammelspeicherung waere hier die schlechtere Wahl: die Zeilen sind unabhaengig
 * voneinander, und ein halb gespeicherter Rechtesatz ist schlimmer als gar keiner.
 */

interface Props {
  readonly nutzer: Nutzerzeile;
  readonly schliesse: () => void;
  readonly neuLaden: () => Promise<void>;
}

export function NutzerDetail({ nutzer, schliesse, neuLaden }: Props) {
  const katalog = useSitzung((z) => z.katalog);
  const ich = useSitzung((z) => z.profil);
  const [laeuft, setzeLaeuft] = useState<string | null>(null);
  const [fehler, setzeFehler] = useState<string | null>(null);
  // Das neue Startpasswort steht nur hier, solange der Dialog offen ist. Ein zweites Mal
  // gibt es nicht, also gehoert es sichtbar dagestanden und nicht in eine Meldung.
  const [neuesPasswort, setzeNeuesPasswort] = useState<string | null>(null);
  const [kopiert, setzeKopiert] = useState(false);

  // Sich selbst die Rechte zu nehmen ist der eine Weg, sich auszusperren. Der Trigger in
  // der Datenbank verhindert das nicht: als Admin darf man es. Also hier.
  const binIchSelbst = ich?.id === nutzer.id;

  const tue = async (marke: string, handlung: () => Promise<unknown>) => {
    setzeLaeuft(marke);
    setzeFehler(null);
    try {
      await handlung();
      await neuLaden();
    } catch (ursache) {
      setzeFehler(ursache instanceof Error ? ursache.message : "Unbekannter Fehler.");
    }
    setzeLaeuft(null);
  };

  return (
    <Modal breite="var(--w-dialog)" schliesse={schliesse} titel={nutzer.display_name ?? "Nutzer"}>
      <header className="flex items-center gap-[14px] border-b border-axon-linie px-[26px] pt-6 pb-5">
        <span
          aria-hidden
          className="flex size-11 items-center justify-center rounded-full border border-axon-avatar-rand bg-axon-avatar font-sans text-md text-axon-schrift"
        >
          {initialen(nutzer)}
        </span>
        <div className="flex min-w-0 flex-col gap-[3px]">
          <span className="truncate font-display text-2xl font-light text-axon-schrift">
            {nutzer.display_name ?? "Ohne Namen"}
          </span>
          <span className="truncate font-mono text-xs text-axon-schrift-still">
            {nutzer.email}
          </span>
        </div>
        <button
          type="button"
          onClick={schliesse}
          aria-label="Schließen"
          className="ml-auto cursor-pointer text-xl text-axon-schrift-still transition-colors duration-quick hover:text-axon-schrift"
        >
          ✕
        </button>
      </header>

      <div className="flex flex-col gap-6 overflow-y-auto px-[26px] py-6">
        <section className="flex flex-col gap-3">
          <Etikett>Rolle</Etikett>
          <div className="flex gap-0">
            {(["user", "admin"] as const).map((rolle) => (
              <button
                key={rolle}
                type="button"
                disabled={binIchSelbst || laeuft !== null}
                onClick={() => void tue("rolle", () => setzeRolle(nutzer.id, rolle as Rolle))}
                aria-pressed={nutzer.role === rolle}
                className="cursor-pointer border border-axon-linie px-[14px] py-[9px] font-mono text-2xs tracking-[0.16em] uppercase text-axon-schrift-leise transition-colors duration-quick not-first:border-l-0 hover:text-axon-schrift aria-pressed:border-axon-wahl-rand aria-pressed:bg-axon-wahl-flaeche aria-pressed:text-axon-schrift disabled:cursor-not-allowed disabled:opacity-45"
              >
                {rolle === "admin" ? "Administrator" : "Nutzer"}
              </button>
            ))}
          </div>
          {binIchSelbst && (
            <p className="font-sans text-sm text-axon-schrift-fein">
              Die eigene Rolle und den eigenen Zugang kannst du hier nicht ändern. Sonst
              sperrst du dich mit einem Klick selbst aus.
            </p>
          )}
        </section>

        <section className="flex flex-col gap-3">
          <Etikett>Freischaltungen</Etikett>
          <ul className="flex flex-col border border-axon-linie-fein">
            {katalog.map((programm) => {
              const frei = nutzer.programme.includes(programm.id);
              return (
                <li
                  key={programm.id}
                  className="flex items-center gap-3 border-b border-axon-zeile-linie px-4 py-3 last:border-b-0"
                >
                  <span
                    aria-hidden
                    style={{ backgroundColor: programm.akzent }}
                    className="size-[6px] shrink-0 rounded-full"
                  />
                  <span className="font-sans text-md text-axon-schrift">{programm.name}</span>
                  <span className="font-mono text-2xs uppercase text-axon-schrift-fein">
                    {programm.kuerzel}
                  </span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={frei}
                    aria-label={`${programm.name} für ${nutzer.display_name ?? nutzer.email ?? "diesen Nutzer"} freischalten`}
                    disabled={laeuft !== null}
                    onClick={() =>
                      void tue(programm.id, () =>
                        setzeFreischaltung(nutzer.id, programm.id, !frei),
                      )
                    }
                    className="ml-auto h-5 w-9 shrink-0 cursor-pointer border border-axon-linie bg-transparent transition-colors duration-quick aria-checked:border-axon-aktion aria-checked:bg-axon-schalter-an disabled:cursor-wait"
                  >
                    <span
                      aria-hidden
                      className={
                        frei
                          ? "block size-3 translate-x-[18px] bg-axon-aktion transition-transform duration-quick"
                          : "block size-3 translate-x-[2px] bg-axon-schalter-aus transition-transform duration-quick"
                      }
                    />
                  </button>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="flex flex-col gap-3">
          <Etikett>Passwort</Etikett>
          {neuesPasswort ? (
            <>
              <p className="font-sans text-base text-axon-schrift-fein">
                Neues Startpasswort. Es steht{" "}
                <strong className="text-axon-schrift">nur hier</strong>, ist nach dem
                Schließen weg, und alle Sitzungen dieses Zugangs sind beendet.
              </p>
              <input
                readOnly
                value={neuesPasswort}
                aria-label="Neues Startpasswort"
                onFocus={(e) => e.currentTarget.select()}
                className="border border-axon-linie bg-axon-flaeche p-3 font-mono text-md tracking-fein break-all text-axon-schrift outline-none focus:border-axon-fokus"
              />
              <div>
                <button
                  type="button"
                  onClick={() => {
                    void navigator.clipboard.writeText(neuesPasswort).then(() => {
                      setzeKopiert(true);
                    });
                  }}
                  className="h-(--h-knopf) cursor-pointer border border-axon-linie px-5 font-sans text-sm tracking-[0.14em] uppercase text-axon-schrift-leise transition-colors duration-calm hover:border-axon-fokus hover:text-axon-schrift"
                >
                  {kopiert ? "Kopiert" : "Passwort kopieren"}
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="font-sans text-base text-axon-schrift-fein">
                {nutzer.passwortwechsel_faellig
                  ? "Dieser Zugang trägt noch sein Startpasswort und muss es bei der nächsten Anmeldung wechseln."
                  : "Ein eigenes Passwort ist gesetzt."}{" "}
                Zurücksetzen vergibt ein neues Startpasswort und beendet alle Sitzungen.
              </p>
              <div>
                <button
                  type="button"
                  disabled={binIchSelbst || laeuft !== null}
                  onClick={() =>
                    void tue("passwort", async () => {
                      const { startpasswort } = await setzePasswortZurueck(nutzer.id);
                      setzeNeuesPasswort(startpasswort);
                      setzeKopiert(false);
                    })
                  }
                  className="h-(--h-knopf) cursor-pointer border border-axon-linie px-5 font-sans text-sm tracking-[0.14em] uppercase text-axon-schrift-leise transition-colors duration-calm hover:border-axon-fokus hover:text-axon-schrift disabled:cursor-not-allowed disabled:opacity-45"
                >
                  {laeuft === "passwort" ? "Einen Moment" : "Passwort zurücksetzen"}
                </button>
              </div>
            </>
          )}
        </section>

        <p aria-live="polite" className="min-h-4 font-sans text-sm text-axon-fehler">
          {fehler ?? ""}
        </p>
      </div>

      <footer className="flex items-center gap-3 border-t border-axon-linie px-[26px] py-5">
        <span className="font-mono text-2xs tracking-fein uppercase text-axon-schrift-fein">
          Zugang {nutzer.status === "gesperrt" ? "gesperrt" : "aktiv"}
        </span>
        <button
          type="button"
          disabled={binIchSelbst || laeuft !== null}
          onClick={() =>
            void tue("status", () => setzeStatus(nutzer.id, nutzer.status !== "gesperrt"))
          }
          className="ml-auto h-(--h-knopf) cursor-pointer border border-axon-linie px-5 font-sans text-sm tracking-[0.14em] uppercase text-axon-schrift-leise transition-colors duration-calm hover:border-axon-fehler-kraeftig hover:text-axon-schrift disabled:cursor-not-allowed disabled:opacity-45"
        >
          {nutzer.status === "gesperrt" ? "Entsperren" : "Sperren"}
        </button>
      </footer>
    </Modal>
  );
}
