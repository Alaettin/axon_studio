import { useCallback, useEffect, useState } from "react";

import { Aktion, Etikett, Glasflaeche, Nebenaktion } from "@/components/Bausteine";
import type { Abnahmepunkt, Nutzerzeile, Programmstatus } from "@/lib/typen";
import { initialen } from "@/lib/typen";
import { ladeNutzer, pruefeProgramm, setzeFreischaltungen } from "@/lib/verwaltung";
import type { Entwurf } from "./AufnahmeRoute";

/**
 * Bildschirm 15: die Abnahme.
 *
 * Sie misst drei Punkte wirklich und benennt zwei als nicht automatisch prüfbar, statt sie
 * grün zu haken. Ein Haken, der immer grün ist, sagt nichts; er kostet nur das Vertrauen in
 * die anderen.
 *
 * Der Status kommt aus der Messung, nicht aus einem Knopf: kein harter Fehler heißt `aktiv`,
 * sonst `pruefen`.
 */

interface Props {
  readonly entwurf: Entwurf;
  readonly fertig: () => void;
}

export function SchrittAbnahme({ entwurf, fertig }: Props) {
  const [punkte, setzePunkte] = useState<readonly Abnahmepunkt[] | null>(null);
  const [status, setzeStatus] = useState<Programmstatus | null>(null);
  const [laeuft, setzeLaeuft] = useState(false);
  const [fehler, setzeFehler] = useState<string | null>(null);

  const [nutzer, setzeNutzer] = useState<readonly Nutzerzeile[]>([]);
  const [frei, setzeFrei] = useState<readonly string[]>([]);
  const [gespeichert, setzeGespeichert] = useState(false);

  const messen = useCallback(async () => {
    setzeLaeuft(true);
    setzeFehler(null);
    try {
      const ergebnis = await pruefeProgramm(entwurf.id);
      setzePunkte(ergebnis.punkte);
      setzeStatus(ergebnis.status);
    } catch (ursache) {
      setzeFehler(ursache instanceof Error ? ursache.message : "Unbekannter Fehler.");
    }
    setzeLaeuft(false);
  }, [entwurf.id]);

  useEffect(() => {
    void messen();
  }, [messen]);

  useEffect(() => {
    void (async () => {
      try {
        const { nutzer: alle } = await ladeNutzer();
        setzeNutzer(alle);
        setzeFrei(alle.filter((n) => n.programme.includes(entwurf.id)).map((n) => n.id));
      } catch {
        // Die Freischaltung ist die Zugabe dieses Schritts, nicht sein Zweck. Scheitert sie,
        // bleibt die Abnahme lesbar; freischalten geht auch in der Nutzerverwaltung.
      }
    })();
  }, [entwurf.id]);

  async function speichereFreigaben() {
    setzeFehler(null);
    try {
      await setzeFreischaltungen(entwurf.id, frei);
      setzeGespeichert(true);
      setTimeout(() => setzeGespeichert(false), 1800);
    } catch (ursache) {
      setzeFehler(ursache instanceof Error ? ursache.message : "Unbekannter Fehler.");
    }
  }

  return (
    <div className="flex flex-col gap-7">
      {fehler && (
        <p role="alert" className="font-sans text-base text-axon-fehler">
          {fehler}
        </p>
      )}

      <Glasflaeche
        titel="Abnahme"
        kopfrechts={
          <Nebenaktion disabled={laeuft} onClick={() => void messen()}>
            {laeuft ? "Misst" : "Erneut messen"}
          </Nebenaktion>
        }
      >
        <div className="flex flex-col divide-y divide-axon-zeile-linie">
          {punkte === null && (
            <p className="px-[22px] py-5 font-mono text-2xs tracking-etikett uppercase text-axon-schrift-still">
              Wird gemessen
            </p>
          )}
          {punkte?.map((p) => (
            <div key={p.name} className="flex items-start gap-4 px-[22px] py-[15px]">
              <span
                aria-hidden
                className={
                  "mt-[2px] w-[18px] shrink-0 text-center font-mono text-md " +
                  (p.gut === true
                    ? "text-success-text"
                    : p.gut === false
                      ? "text-axon-fehler"
                      : "text-axon-schrift-still")
                }
              >
                {p.gut === true ? "✓" : p.gut === false ? "✕" : "~"}
              </span>
              <span className="flex min-w-0 flex-col gap-[3px]">
                <span className="font-sans text-md text-axon-schrift">{p.name}</span>
                <span className="font-mono text-xs text-axon-schrift-fein">{p.befund}</span>
              </span>
              <span className="ml-auto shrink-0 font-mono text-2xs tracking-fein uppercase text-axon-schrift-still">
                {p.gut === null ? "Nicht messbar" : ""}
              </span>
            </div>
          ))}
        </div>

        {status && (
          <div className="flex items-center gap-3 border-t border-axon-linie-fein px-[22px] py-[17px]">
            <Etikett>Status</Etikett>
            <span
              className={
                "font-mono text-xs tracking-fein uppercase " +
                (status === "aktiv" ? "text-success-text" : "text-warning-text")
              }
            >
              {status === "aktiv" ? "Aktiv" : "Prüfen"}
            </span>
            <span className="ml-auto font-sans text-sm text-axon-schrift-fein">
              {status === "aktiv"
                ? "Kein harter Fehler. Das Programm steht als aufgenommen im Katalog."
                : "Mindestens ein messbarer Punkt sitzt nicht. Beheben und erneut messen."}
            </span>
          </div>
        )}
      </Glasflaeche>

      <Glasflaeche
        titel="Wer es sieht"
        kopfrechts={
          <Nebenaktion onClick={() => void speichereFreigaben()}>
            {gespeichert ? "Gespeichert" : "Freigaben übernehmen"}
          </Nebenaktion>
        }
      >
        <div className="flex max-h-[260px] flex-col divide-y divide-axon-zeile-linie overflow-y-auto">
          {nutzer.map((n) => (
            <label
              key={n.id}
              className="flex cursor-pointer items-center gap-4 px-[22px] py-3 transition-colors duration-quick hover:bg-axon-zeile-hover"
            >
              <input
                type="checkbox"
                checked={frei.includes(n.id)}
                onChange={(ev) =>
                  setzeFrei((v) =>
                    ev.target.checked ? [...v, n.id] : v.filter((x) => x !== n.id),
                  )
                }
                className="size-[16px] shrink-0 cursor-pointer accent-axon-fokus"
              />
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-axon-avatar font-mono text-2xs text-axon-schrift-leise">
                {initialen(n)}
              </span>
              <span className="truncate font-sans text-md text-axon-schrift">
                {n.display_name ?? n.email}
              </span>
              <span className="ml-auto shrink-0 font-mono text-2xs uppercase text-axon-schrift-still">
                {n.role}
              </span>
            </label>
          ))}
        </div>
      </Glasflaeche>

      <div className="flex">
        <Aktion onClick={fertig}>Fertig</Aktion>
      </div>
    </div>
  );
}
