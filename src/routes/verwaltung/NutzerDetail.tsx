import { useEffect, useState } from "react";

import { Etikett } from "@/components/Bausteine";
import { Modal } from "@/components/Modal";
import {
  initialen,
  type Loeschvorschau,
  type Nutzerzeile,
  type Organisation,
  type Rolle,
} from "@/lib/typen";
import {
  ladeLoeschvorschau,
  ladeOrganisationen,
  loescheNutzer,
  setzeFreischaltung,
  setzeMitgliedschaft,
  setzePasswortZurueck,
  setzeRolle,
  setzeStatus,
} from "@/lib/verwaltung";
import { useSitzung } from "@/store/sitzung";

/**
 * Tabellennamen in Klartext.
 *
 * Nur fuer die Anzeige: was hier fehlt, steht mit seinem eigenen Namen da. Das Supabase-Projekt
 * ist mit der AAS Tools Platform geteilt, ihre Tabellen wachsen ohne unser Zutun, und eine
 * Zuordnung, die dann nichts findet, darf nichts verschweigen.
 */
const KLARTEXT: Record<string, string> = {
  profiles: "Profil im Hub",
  user_tool_access: "Freischaltungen",
  user_doc_access: "Zugriffe auf Handbücher",
  doc_manuals: "Handbücher",
  aas_projects: "Projekte im AXON Editor",
  aas_mcp_servers: "MCP-Server",
  dti_connectors: "DTI-Connectors",
  excel_connectors: "Excel-Connectors",
  global_connectors: "Globale Connectors",
  connector_proxies: "Connector-Proxys",
  iec_qr_codes: "IEC-QR-Codes",
  ucc_sources: "UCC-Quellen",
  ucc_use_cases: "UCC-Anwendungsfälle",
  ucc_evaluations: "UCC-Bewertungen",
};

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
  // `undefined` heisst: der Loeschzweig ist zu. `null` heisst: die Vorschau ist unterwegs.
  const [vorschau, setzeVorschau] = useState<Loeschvorschau | null | undefined>(undefined);
  const [abgetippt, setzeAbgetippt] = useState("");
  /*
   * Der Katalog der Organisationen, einmal beim Oeffnen. Nicht im Sitzungsspeicher: den
   * braucht nur dieser Dialog, und ein Feld dort waere ein zweiter Zeitpunkt, an dem es
   * falsch sein kann. Welche davon der Nutzer traegt, steht in `nutzer.organisationen` und
   * kommt mit der Liste, die nach jeder Aenderung ohnehin neu geholt wird.
   */
  const [organisationen, setzeOrganisationen] = useState<readonly Organisation[]>([]);
  useEffect(() => {
    void ladeOrganisationen().then(setzeOrganisationen).catch(() => setzeOrganisationen([]));
  }, []);

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

      {vorschau !== undefined ? (
        <Loeschzweig
          nutzer={nutzer}
          vorschau={vorschau}
          abgetippt={abgetippt}
          setzeAbgetippt={setzeAbgetippt}
          laeuft={laeuft === "loeschen"}
          fehler={fehler}
          zurueck={() => {
            setzeVorschau(undefined);
            setzeAbgetippt("");
            setzeFehler(null);
          }}
          loesche={() =>
            void tue("loeschen", async () => {
              await loescheNutzer(nutzer.id, abgetippt);
              schliesse();
            })
          }
        />
      ) : (
        <>
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

          {/*
            Organisationen stehen hier und nicht auf der Organisationsseite: alles andere, was
            einen Nutzer betrifft, steht auch hier, und zwei Orte fuer dieselbe Zuordnung waeren
            zwei Orte, an denen sie fehlen kann.
          */}
          <section className="flex flex-col gap-3">
            <Etikett>Organisationen</Etikett>
            {organisationen.length === 0 ? (
              <p className="font-sans text-sm text-axon-schrift-fein">
                Es gibt noch keine Organisation. Angelegt werden sie unter Verwaltung,
                Organisationen.
              </p>
            ) : (
              <ul className="flex flex-col border border-axon-linie-fein">
                {organisationen.map((organisation) => {
                  const drin = nutzer.organisationen.find((o) => o.id === organisation.id);
                  return (
                    <li
                      key={organisation.id}
                      className="flex items-center gap-3 border-b border-axon-zeile-linie px-4 py-3 last:border-b-0"
                    >
                      <span className="truncate font-sans text-md text-axon-schrift">
                        {organisation.name}
                      </span>
                      {drin && (
                        <button
                          type="button"
                          disabled={laeuft !== null}
                          onClick={() =>
                            void tue(`rolle-${organisation.id}`, () =>
                              setzeMitgliedschaft(
                                organisation.id,
                                nutzer.id,
                                drin.rolle === "verwalter" ? "mitglied" : "verwalter",
                              ),
                            )
                          }
                          className="cursor-pointer border border-axon-linie px-[10px] py-1 font-mono text-2xs tracking-fein uppercase text-axon-schrift-leise transition-colors duration-quick hover:text-axon-schrift disabled:cursor-wait"
                        >
                          {drin.rolle === "verwalter" ? "Verwalter" : "Mitglied"}
                        </button>
                      )}
                      <button
                        type="button"
                        role="switch"
                        aria-checked={drin !== undefined}
                        aria-label={`${nutzer.display_name ?? nutzer.email ?? "Diesen Nutzer"} zu ${organisation.name} zuordnen`}
                        disabled={laeuft !== null}
                        onClick={() =>
                          void tue(organisation.id, () =>
                            setzeMitgliedschaft(organisation.id, nutzer.id, drin ? null : "mitglied"),
                          )
                        }
                        className="ml-auto h-5 w-9 shrink-0 cursor-pointer border border-axon-linie bg-transparent transition-colors duration-quick aria-checked:border-axon-aktion aria-checked:bg-axon-schalter-an disabled:cursor-wait"
                      >
                        <span
                          aria-hidden
                          className={
                            drin
                              ? "block size-3 translate-x-[18px] bg-axon-aktion transition-transform duration-quick"
                              : "block size-3 translate-x-[2px] bg-axon-schalter-aus transition-transform duration-quick"
                          }
                        />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
            <p className="font-sans text-sm text-axon-schrift-fein">
              Wer zusammen in einer Organisation ist, teilt sich in den Unterprogrammen den
              Arbeitsbereich. Rechte vergibt sie keine.
            </p>
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
          {/*
            Der Weg ins Loeschen fuehrt ueber die Vorschau, nie unmittelbar: was an einem Zugang
            haengt, weiss nur die Datenbank, und der Administrator soll es sehen, bevor er
            entscheidet.
          */}
          <button
            type="button"
            disabled={binIchSelbst || laeuft !== null}
            onClick={() =>
              void tue("vorschau", async () => {
                setzeVorschau(null);
                setzeVorschau(await ladeLoeschvorschau(nutzer.id));
              })
            }
            className="h-(--h-knopf) cursor-pointer border border-axon-fehler-kraeftig px-5 font-sans text-sm tracking-[0.14em] uppercase text-axon-fehler transition-colors duration-calm hover:text-axon-schrift disabled:cursor-not-allowed disabled:opacity-45"
          >
            {laeuft === "vorschau" ? "Einen Moment" : "Löschen"}
          </button>
        </footer>
        </>
      )}
    </Modal>
  );
}

/**
 * Der Loeschzweig: derselbe Dialog, anderer Inhalt.
 *
 * Kein zweites Modal ueber dem ersten. Zwei uebereinanderliegende Fenster verdecken genau die
 * Angaben, wegen derer man das zweite geoeffnet hat.
 */
function Loeschzweig({
  nutzer,
  vorschau,
  abgetippt,
  setzeAbgetippt,
  laeuft,
  fehler,
  zurueck,
  loesche,
}: {
  readonly nutzer: Nutzerzeile;
  readonly vorschau: Loeschvorschau | null;
  readonly abgetippt: string;
  readonly setzeAbgetippt: (wert: string) => void;
  readonly laeuft: boolean;
  readonly fehler: string | null;
  readonly zurueck: () => void;
  readonly loesche: () => void;
}) {
  const adresse = (nutzer.email ?? "").toLowerCase();
  const stimmt = abgetippt.trim().toLowerCase() === adresse && adresse !== "";
  const gesperrt = (vorschau?.blockiert.length ?? 0) > 0;

  return (
    <>
      <div className="flex flex-col gap-5 overflow-y-auto px-[26px] py-6">
        {vorschau === null ? (
          <p className="font-mono text-2xs tracking-etikett uppercase text-axon-schrift-still">
            Wird nachgesehen
          </p>
        ) : (
          <>
            <p className="font-sans text-lg text-axon-schrift">
              Diesen Zugang endgültig löschen?
            </p>

            {gesperrt ? (
              <>
                <p className="font-sans text-base text-axon-schrift-fein">
                  Das geht nicht. An diesem Zugang hängen Einträge, die die Datenbank nicht
                  freigibt. Sie gehören der AAS Tools Platform und werden hier nicht angefasst.
                  <strong className="text-axon-schrift"> Sperren</strong> geht stattdessen.
                </p>
                <Posten liste={vorschau.blockiert} />
              </>
            ) : (
              <>
                <p className="font-sans text-base text-axon-schrift-fein">
                  Damit verschwindet auch alles, was daran hängt, und zwar{" "}
                  <strong className="text-axon-schrift">ohne Weg zurück</strong>. Ein Teil davon
                  sind Daten in der AAS Tools Platform, die dasselbe Konto benutzt.
                </p>
                {vorschau.faellt_weg.length > 0 ? (
                  <Posten liste={vorschau.faellt_weg} />
                ) : (
                  <p className="font-sans text-base text-axon-schrift-fein">
                    Außer dem Konto selbst hängt nichts daran.
                  </p>
                )}

                <label className="flex flex-col gap-[9px]">
                  <Etikett>Zum Bestätigen die Adresse eintippen</Etikett>
                  <input
                    value={abgetippt}
                    onChange={(e) => setzeAbgetippt(e.target.value)}
                    autoComplete="off"
                    placeholder={adresse}
                    className="h-8 border-0 border-b border-axon-feld-rand bg-transparent p-0 font-mono text-md text-axon-schrift transition-colors duration-feld outline-none placeholder:text-axon-platzhalter focus:border-axon-fokus"
                  />
                </label>
              </>
            )}
          </>
        )}

        <p aria-live="polite" className="min-h-4 font-sans text-sm text-axon-fehler">
          {fehler ?? ""}
        </p>
      </div>

      <footer className="flex items-center gap-3 border-t border-axon-linie px-[26px] py-5">
        <button
          type="button"
          onClick={zurueck}
          disabled={laeuft}
          className="h-(--h-knopf) cursor-pointer border border-axon-linie px-5 font-sans text-sm tracking-[0.14em] uppercase text-axon-schrift-leise transition-colors duration-calm hover:border-axon-fokus hover:text-axon-schrift disabled:cursor-not-allowed disabled:opacity-45"
        >
          Zurück
        </button>
        {!gesperrt && vorschau !== null && (
          <button
            type="button"
            onClick={loesche}
            disabled={!stimmt || laeuft}
            className="ml-auto h-(--h-knopf) cursor-pointer border border-axon-fehler-kraeftig px-5 font-sans text-sm tracking-[0.14em] uppercase text-axon-fehler transition-colors duration-calm hover:text-axon-schrift disabled:cursor-not-allowed disabled:opacity-45"
          >
            {laeuft ? "Wird gelöscht" : "Endgültig löschen"}
          </button>
        )}
      </footer>
    </>
  );
}

/** Die Vorschau als Liste. Unbekannte Tabellen stehen mit ihrem eigenen Namen da. */
function Posten({ liste }: { readonly liste: readonly { tabelle: string; anzahl: number }[] }) {
  return (
    <ul className="flex flex-col border border-axon-linie-fein">
      {liste.map((posten) => (
        <li
          key={posten.tabelle}
          className="flex items-center gap-3 border-b border-axon-zeile-linie px-4 py-[10px] last:border-b-0"
        >
          <span className="font-sans text-md text-axon-schrift">
            {KLARTEXT[posten.tabelle] ?? posten.tabelle}
          </span>
          <span className="ml-auto font-mono text-xs text-axon-schrift-leise" data-numeric>
            {posten.anzahl}
          </span>
        </li>
      ))}
    </ul>
  );
}
