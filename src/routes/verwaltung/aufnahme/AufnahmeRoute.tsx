import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";

import { Aktion, Brotkrume, Nebenaktion, Seitentitel } from "@/components/Bausteine";
import { Flaeche } from "@/components/Flaeche";
import { Kopfzeile } from "@/components/Kopfzeile";
import { Modal } from "@/components/Modal";
import type { Programm, Programmclient, Scope, Umgebung } from "@/lib/typen";
import { AKZENTE } from "@/lib/typen";
import { aendereProgramm, ladeKatalog, legeProgrammAn, loescheProgramm } from "@/lib/verwaltung";
import { SchrittAbnahme } from "./SchrittAbnahme";
import { SchrittAdresse } from "./SchrittAdresse";
import { SchrittProgramm } from "./SchrittProgramm";
import { SchrittSchluessel } from "./SchrittSchluessel";
import { SchrittZugriff } from "./SchrittZugriff";
import { STUFEN, Stufen } from "./Stufen";

/**
 * Der Aufnahme-Assistent, Bildschirme 11 bis 15 der Vorlage.
 *
 * **Er speichert schrittweise, nicht am Ende.** Das ist der wichtigste Zuschnitt: in
 * Schritt 4 entstehen echte OAuth-Clients beim Aussteller. Bräche jemand danach ab und
 * wäre bis dahin nichts gespeichert, blieben Registrierungen zurück, die zu keinem
 * Programm mehr gehören und die niemand wiederfindet.
 *
 * Deshalb entsteht die Zeile schon am Ende von Schritt 1, mit `status = entwurf`. Ein
 * abgebrochener Entwurf steht danach im Katalog und ist als solcher erkennbar, statt
 * unsichtbar Müll zu hinterlassen.
 *
 * Dieselbe Route dient dem Bearbeiten: `/verwaltung/katalog/:id` lädt ein vorhandenes
 * Programm in denselben Ablauf.
 */

export interface Entwurf {
  id: string;
  name: string;
  kuerzel: string;
  kurz: string;
  akzent: string;
  basis_adresse: string;
  gesundheitspfad: string;
  url: string;
  scopes: Scope[];
  zustimmung_ueberspringen: boolean;
}

const LEER: Entwurf = {
  id: "",
  name: "",
  kuerzel: "",
  kurz: "",
  akzent: AKZENTE[0],
  basis_adresse: "",
  gesundheitspfad: "/api/health",
  url: "",
  scopes: ["openid", "profile", "email"],
  zustimmung_ueberspringen: false,
};

export interface UmgebungsEntwurf {
  umgebung: Umgebung;
  redirect_uri: string;
}

export function AufnahmeRoute() {
  const { id } = useParams<{ id: string }>();
  const bearbeitet = id !== undefined && id !== "aufnehmen";
  const gehe = useNavigate();

  const [stufe, setzeStufe] = useState(1);
  const [erreicht, setzeErreicht] = useState(1);
  const [entwurf, setzeEntwurf] = useState<Entwurf>(LEER);
  const [umgebungen, setzeUmgebungen] = useState<UmgebungsEntwurf[]>([
    { umgebung: "produktion", redirect_uri: "" },
  ]);
  const [vorhandene, setzeVorhandene] = useState<readonly Programmclient[]>([]);
  const [laedt, setzeLaedt] = useState(bearbeitet);
  const [fehler, setzeFehler] = useState<string | null>(null);
  const [loeschfrage, setzeLoeschfrage] = useState(false);

  // Ein vorhandenes Programm in denselben Ablauf laden.
  useEffect(() => {
    if (!bearbeitet) return;
    void (async () => {
      try {
        const { programme, clients } = await ladeKatalog();
        const p = programme.find((x) => x.id === id);
        if (!p) {
          setzeFehler("Dieses Programm gibt es nicht.");
          setzeLaedt(false);
          return;
        }
        setzeEntwurf({
          id: p.id,
          name: p.name,
          kuerzel: p.kuerzel,
          kurz: p.kurz,
          akzent: p.akzent,
          basis_adresse: p.basis_adresse ?? "",
          gesundheitspfad: p.gesundheitspfad,
          url: p.url ?? "",
          scopes: [...p.scopes],
          zustimmung_ueberspringen: p.zustimmung_ueberspringen,
        });
        const eigene = clients.filter((c) => c.app_id === p.id);
        setzeVorhandene(eigene);
        if (eigene.length > 0) {
          setzeUmgebungen(
            eigene.map((c) => ({ umgebung: c.umgebung, redirect_uri: c.redirect_uri })),
          );
        }
        // Wer bearbeitet, darf überall hin: alles ist schon einmal durchlaufen.
        setzeErreicht(5);
      } catch (ursache) {
        setzeFehler(ursache instanceof Error ? ursache.message : "Unbekannter Fehler.");
      }
      setzeLaedt(false);
    })();
  }, [bearbeitet, id]);

  /** Speichert den bisherigen Stand und geht eine Stufe weiter. */
  const weiter = useCallback(
    async (felder: Partial<Programm>) => {
      setzeFehler(null);
      try {
        /*
         * Schritt 1 legt die Zeile an, alle weiteren aendern sie. Ein `upsert` mit den
         * paar Feldern eines spaeteren Schritts waere weiterhin ein INSERT und liefe in
         * die NOT-NULL-Bedingung auf `name`.
         */
        if (felder.name !== undefined && felder.id !== undefined) {
          await legeProgrammAn({ ...felder, id: felder.id, name: felder.name });
        } else {
          await aendereProgramm(entwurf.id, felder);
        }
        setzeStufe((s) => {
          const naechste = Math.min(s + 1, 5);
          setzeErreicht((e) => Math.max(e, naechste));
          return naechste;
        });
      } catch (ursache) {
        setzeFehler(ursache instanceof Error ? ursache.message : "Unbekannter Fehler.");
      }
    },
    [entwurf.id],
  );

  if (laedt) {
    return (
      <Flaeche schleier="sammlung" className="items-center justify-center">
        <p className="font-mono text-2xs tracking-etikett uppercase text-axon-schrift-still">
          Programm wird geladen
        </p>
      </Flaeche>
    );
  }

  return (
    <Flaeche schleier="sammlung" className="px-14 pt-[30px] pb-9">
      <Kopfzeile />

      <div className="flex min-h-0 flex-1 flex-col items-center pt-[30px]">
        <div className="flex min-h-0 w-[980px] max-w-full flex-col gap-6">
          <div className="flex flex-col gap-[9px]">
            <Brotkrume>
              <Link
                to="/verwaltung/katalog"
                className="text-axon-schrift-leise hover:text-axon-fokus"
              >
                ← Katalog
              </Link>
              <span className="text-axon-trenner">/</span>
              <span>{bearbeitet ? entwurf.name : "Programm aufnehmen"}</span>
            </Brotkrume>
            <Seitentitel>
              {bearbeitet ? STUFEN[stufe - 1] : "Programm aufnehmen"}
            </Seitentitel>
          </div>

          <Stufen aktuell={stufe} erreicht={erreicht} springe={setzeStufe} />

          {fehler && (
            <p role="alert" className="font-sans text-base text-axon-fehler">
              {fehler}
            </p>
          )}

          {stufe === 1 && (
            <SchrittProgramm
              entwurf={entwurf}
              setzeEntwurf={setzeEntwurf}
              bearbeitet={bearbeitet}
              weiter={weiter}
            />
          )}
          {stufe === 2 && (
            <SchrittAdresse
              entwurf={entwurf}
              setzeEntwurf={setzeEntwurf}
              umgebungen={umgebungen}
              setzeUmgebungen={setzeUmgebungen}
              vorhandene={vorhandene}
              weiter={weiter}
            />
          )}
          {stufe === 3 && (
            <SchrittZugriff entwurf={entwurf} setzeEntwurf={setzeEntwurf} weiter={weiter} />
          )}
          {stufe === 4 && (
            <SchrittSchluessel
              entwurf={entwurf}
              umgebungen={umgebungen}
              vorhandene={vorhandene}
              setzeVorhandene={setzeVorhandene}
              weiter={() => void weiter({})}
            />
          )}
          {stufe === 5 && (
            <SchrittAbnahme
              entwurf={entwurf}
              fertig={() => void gehe("/verwaltung/katalog")}
            />
          )}

          <div className="flex items-center gap-3 pb-4">
            <span className="font-mono text-2xs tracking-fein uppercase text-axon-schrift-fein">
              Schritt {stufe} von 5
            </span>
            <div className="ml-auto flex items-center gap-3">
              {bearbeitet && (
                <Nebenaktion onClick={() => setzeLoeschfrage(true)}>
                  Programm entfernen
                </Nebenaktion>
              )}
              <Nebenaktion onClick={() => void gehe("/verwaltung/katalog")}>
                {stufe === 5 ? "Schließen" : "Abbrechen"}
              </Nebenaktion>
            </div>
          </div>
        </div>
      </div>

      {loeschfrage && (
        <Modal titel="Programm entfernen" schliesse={() => setzeLoeschfrage(false)}>
          <div className="flex flex-col gap-5 p-7">
            <p className="font-display text-2xl font-light text-axon-schrift">
              {entwurf.name} entfernen?
            </p>
            <p className="font-sans text-base text-axon-schrift-fein">
              Die Kachel verschwindet, und die {vorhandene.length === 1 ? "Registrierung" : "Registrierungen"}{" "}
              beim Aussteller {vorhandene.length === 1 ? "wird" : "werden"} mitgelöscht. Wer das
              Programm später wieder aufnimmt, bekommt neue Geheimnisse.
            </p>
            <div className="flex justify-end gap-3">
              <Nebenaktion onClick={() => setzeLoeschfrage(false)}>Abbrechen</Nebenaktion>
              <Aktion
                onClick={() => {
                  void (async () => {
                    try {
                      await loescheProgramm(entwurf.id);
                      void gehe("/verwaltung/katalog");
                    } catch (ursache) {
                      setzeFehler(
                        ursache instanceof Error ? ursache.message : "Unbekannter Fehler.",
                      );
                      setzeLoeschfrage(false);
                    }
                  })();
                }}
              >
                Entfernen
              </Aktion>
            </div>
          </div>
        </Modal>
      )}
    </Flaeche>
  );
}
