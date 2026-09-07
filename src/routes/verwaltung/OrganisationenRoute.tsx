import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router";

import { Aktion, Brotkrume, Etikett, Glasflaeche, Nebenaktion, Seitentitel, Unterlinienfeld } from "@/components/Bausteine";
import { Flaeche } from "@/components/Flaeche";
import { Kopfzeile } from "@/components/Kopfzeile";
import { Modal } from "@/components/Modal";
import { Palette } from "@/components/Palette";
import type { Organisation } from "@/lib/typen";
import {
  benenneOrganisation,
  ladeOrganisationen,
  legeOrganisationAn,
  loescheOrganisation,
} from "@/lib/verwaltung";

/**
 * Die Organisationen.
 *
 * Eine Organisation sagt, **wer zusammengehört**, und mehr nicht: sie vergibt keine Rechte und
 * schaltet nichts frei. Die Unterprogramme fragen sie über die Edge Function `konto` ab und
 * entscheiden selbst, was sie damit tun; im AXON Connector wird daraus der gemeinsame
 * Arbeitsbereich, in dem ein Konnektor mehreren gehört.
 *
 * Zugeordnet wird im Nutzerdialog, nicht hier: dort steht schon alles andere, was einen Nutzer
 * betrifft, und zwei Orte für dieselbe Zuordnung wären zwei Orte, an denen sie fehlen kann.
 */

const SPALTEN = "2.6fr 1fr 1.2fr";

type Zeile = Organisation & { mitglieder: number };

export function OrganisationenRoute() {
  const [paletteOffen, setzePaletteOffen] = useState(false);
  const [organisationen, setzeOrganisationen] = useState<readonly Zeile[]>([]);
  const [laedt, setzeLaedt] = useState(true);
  const [fehler, setzeFehler] = useState<string | null>(null);
  const [neuOffen, setzeNeuOffen] = useState(false);
  const [gewaehlt, setzeGewaehlt] = useState<Zeile | null>(null);

  const neuLaden = useCallback(async (still = false) => {
    if (!still) setzeLaedt(true);
    setzeFehler(null);
    try {
      setzeOrganisationen(await ladeOrganisationen());
    } catch (ursache) {
      setzeFehler(ursache instanceof Error ? ursache.message : "Unbekannter Fehler.");
    }
    if (!still) setzeLaedt(false);
  }, []);

  useEffect(() => {
    void neuLaden();
  }, [neuLaden]);

  return (
    <Flaeche
      schleier={paletteOffen || neuOffen || gewaehlt ? "dicht" : "sammlung"}
      className="px-14 pt-[30px] pb-9"
    >
      <Kopfzeile oeffnePalette={() => setzePaletteOffen(true)} gedaempft={paletteOffen} />

      <div className="flex min-h-0 flex-1 flex-col items-center pt-9">
        <div className="flex min-h-0 w-(--w-tabelle) max-w-full flex-col gap-[22px]">
          <div className="flex items-end gap-5">
            <div className="flex flex-col gap-[9px]">
              <Brotkrume>
                <Link to="/" className="text-axon-schrift-leise hover:text-axon-fokus">
                  ← Studio
                </Link>
                <span className="text-axon-trenner">/</span>
                <span>Verwaltung</span>
              </Brotkrume>
              <Seitentitel>Organisationen</Seitentitel>
            </div>

            <div className="ml-auto">
              <Aktion onClick={() => setzeNeuOffen(true)}>
                Neue Organisation <span aria-hidden className="text-lg">+</span>
              </Aktion>
            </div>
          </div>

          <Glasflaeche className="flex-1">
            <div
              style={{ gridTemplateColumns: SPALTEN }}
              className="grid gap-3 border-b border-axon-linie-fein px-6 py-[15px] font-mono text-etikett tracking-brotkrume uppercase text-axon-schrift-leise"
            >
              <span>Organisation</span>
              <span>Mitglieder</span>
              <span>Angelegt</span>
            </div>

            <div data-tabelle className="min-h-0 flex-1 overflow-y-auto">
              {laedt && (
                <p className="px-6 py-5 font-mono text-2xs tracking-etikett uppercase text-axon-schrift-still">
                  Organisationen werden geladen
                </p>
              )}
              {fehler && (
                <p role="alert" className="px-6 py-5 font-sans text-base text-axon-fehler">
                  {fehler}
                </p>
              )}
              {!laedt && !fehler && organisationen.length === 0 && (
                <p className="px-6 py-5 font-sans text-base text-axon-schrift-fein">
                  Noch keine Organisation. Ohne eine gehört jeder Nutzer nur sich selbst.
                </p>
              )}

              {organisationen.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => setzeGewaehlt(o)}
                  style={{ gridTemplateColumns: SPALTEN }}
                  className="grid w-full cursor-pointer items-center gap-3 border-b border-axon-zeile-linie px-6 py-[15px] text-left transition-colors duration-quick hover:bg-axon-zeile-hover"
                >
                  <span className="truncate font-sans text-md text-axon-schrift">{o.name}</span>
                  <span className="font-mono text-xs text-axon-schrift-leise" data-numeric>
                    {o.mitglieder}
                  </span>
                  <span className="font-mono text-xs text-axon-schrift-leise" data-numeric>
                    {new Date(o.angelegt_am).toLocaleDateString("de-DE", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                    })}
                  </span>
                </button>
              ))}
            </div>
          </Glasflaeche>
        </div>
      </div>

      {neuOffen && (
        <NeueOrganisation
          schliesse={() => setzeNeuOffen(false)}
          neuLaden={() => neuLaden(true)}
        />
      )}
      {gewaehlt && (
        <OrganisationDetail
          organisation={gewaehlt}
          schliesse={() => setzeGewaehlt(null)}
          neuLaden={() => neuLaden(true)}
        />
      )}
      <Palette offen={paletteOffen} setzeOffen={setzePaletteOffen} />
    </Flaeche>
  );
}

function NeueOrganisation({
  schliesse,
  neuLaden,
}: {
  readonly schliesse: () => void;
  readonly neuLaden: () => Promise<void>;
}) {
  const [name, setzeName] = useState("");
  const [laeuft, setzeLaeuft] = useState(false);
  const [fehler, setzeFehler] = useState<string | null>(null);

  const senden = async (ereignis: FormEvent) => {
    ereignis.preventDefault();
    setzeLaeuft(true);
    setzeFehler(null);
    try {
      await legeOrganisationAn(name);
      await neuLaden();
      schliesse();
    } catch (ursache) {
      setzeFehler(ursache instanceof Error ? ursache.message : "Unbekannter Fehler.");
      setzeLaeuft(false);
    }
  };

  return (
    <Modal titel="Neue Organisation" breite="480px" schliesse={schliesse}>
      <header className="flex flex-col gap-2 border-b border-axon-linie px-[26px] pt-6 pb-5">
        <Etikett>Wer gehört zusammen</Etikett>
        <h2 className="font-display text-2xl font-light text-axon-schrift">Neue Organisation</h2>
      </header>

      <form onSubmit={(e) => void senden(e)} className="flex flex-col gap-6 px-[26px] py-6">
        <Unterlinienfeld
          beschriftung="Name"
          typ="text"
          wert={name}
          setze={setzeName}
          platzhalter="Neoception"
          autoComplete="off"
        />
        <p className="font-sans text-sm text-axon-schrift-fein">
          Der Name steht auch in den Unterprogrammen, dort heißt er je nach Programm anders
          (im AXON Connector: der Arbeitsbereich).
        </p>

        <p aria-live="polite" className="min-h-4 font-sans text-sm text-axon-fehler">
          {fehler ?? ""}
        </p>

        <div className="flex items-center gap-3">
          <Aktion typ="submit" disabled={laeuft || name.trim().length === 0}>
            {laeuft ? "Wird angelegt" : "Anlegen"}
          </Aktion>
          <Nebenaktion onClick={schliesse} disabled={laeuft}>
            Abbrechen
          </Nebenaktion>
        </div>
      </form>
    </Modal>
  );
}

function OrganisationDetail({
  organisation,
  schliesse,
  neuLaden,
}: {
  readonly organisation: Zeile;
  readonly schliesse: () => void;
  readonly neuLaden: () => Promise<void>;
}) {
  const [name, setzeName] = useState(organisation.name);
  const [laeuft, setzeLaeuft] = useState<string | null>(null);
  const [fehler, setzeFehler] = useState<string | null>(null);
  const [loeschen, setzeLoeschen] = useState(false);

  const geaendert = name.trim() !== organisation.name && name.trim().length > 0;

  const tue = async (marke: string, handlung: () => Promise<unknown>) => {
    setzeLaeuft(marke);
    setzeFehler(null);
    try {
      await handlung();
      await neuLaden();
      schliesse();
    } catch (ursache) {
      setzeFehler(ursache instanceof Error ? ursache.message : "Unbekannter Fehler.");
      setzeLaeuft(null);
    }
  };

  return (
    <Modal titel={organisation.name} breite="480px" schliesse={schliesse}>
      <header className="flex flex-col gap-2 border-b border-axon-linie px-[26px] pt-6 pb-5">
        <Etikett>
          {organisation.mitglieder} {organisation.mitglieder === 1 ? "Mitglied" : "Mitglieder"}
        </Etikett>
        <h2 className="truncate font-display text-2xl font-light text-axon-schrift">
          {organisation.name}
        </h2>
      </header>

      <div className="flex flex-col gap-6 px-[26px] py-6">
        <Unterlinienfeld
          beschriftung="Name"
          typ="text"
          wert={name}
          setze={setzeName}
          platzhalter="Name der Organisation"
          autoComplete="off"
        />

        {loeschen ? (
          <p className="font-sans text-base text-axon-schrift-fein">
            Löschen nimmt die Zugehörigkeit von{" "}
            <strong className="text-axon-schrift">
              {organisation.mitglieder} {organisation.mitglieder === 1 ? "Nutzer" : "Nutzern"}
            </strong>{" "}
            weg. Die Zugänge selbst bleiben, und was ein Unterprogramm unter dieser Organisation
            angelegt hat, wird hier nicht angefasst.
          </p>
        ) : (
          <p className="font-sans text-sm text-axon-schrift-fein">
            Wer zu dieser Organisation gehört, wird im Nutzerdialog gesetzt.
          </p>
        )}

        <p aria-live="polite" className="min-h-4 font-sans text-sm text-axon-fehler">
          {fehler ?? ""}
        </p>
      </div>

      <footer className="flex items-center gap-3 border-t border-axon-linie px-[26px] py-5">
        <Aktion
          onClick={() => void tue("name", () => benenneOrganisation(organisation.id, name))}
          disabled={!geaendert || laeuft !== null}
        >
          {laeuft === "name" ? "Einen Moment" : "Speichern"}
        </Aktion>
        <button
          type="button"
          disabled={laeuft !== null}
          onClick={() => {
            if (!loeschen) {
              setzeLoeschen(true);
              return;
            }
            void tue("loeschen", () => loescheOrganisation(organisation.id));
          }}
          className="ml-auto h-(--h-knopf) cursor-pointer border border-axon-fehler-kraeftig px-5 font-sans text-sm tracking-[0.14em] uppercase text-axon-fehler transition-colors duration-calm hover:text-axon-schrift disabled:cursor-not-allowed disabled:opacity-45"
        >
          {laeuft === "loeschen" ? "Einen Moment" : loeschen ? "Wirklich löschen" : "Löschen"}
        </button>
      </footer>
    </Modal>
  );
}
