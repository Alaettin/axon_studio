import type { Dispatch, SetStateAction } from "react";
import { useState } from "react";

import { Aktion, Etikett, Glasflaeche, Unterlinienfeld } from "@/components/Bausteine";
import type { Programm, Programmclient, Umgebung } from "@/lib/typen";
import type { Entwurf, UmgebungsEntwurf } from "./AufnahmeRoute";

/**
 * Bildschirm 12: unter welcher Adresse das Programm läuft, und wohin die Anmeldung
 * zurückkommt.
 *
 * Je Umgebung ein eigener Rückweg und später ein eigener Client. Ein gemeinsamer Client für
 * Produktion und Entwicklung hieße, dass ein Geheimnis vom Laptop auch die Produktion
 * öffnet.
 */

const UMGEBUNGEN: readonly { wert: Umgebung; wort: string }[] = [
  { wert: "produktion", wort: "Produktion" },
  { wert: "test", wort: "Test" },
  { wert: "lokal", wort: "Lokal" },
  { wert: "connector", wort: "Connector" },
];

interface Props {
  readonly entwurf: Entwurf;
  readonly setzeEntwurf: Dispatch<SetStateAction<Entwurf>>;
  readonly umgebungen: UmgebungsEntwurf[];
  readonly setzeUmgebungen: Dispatch<SetStateAction<UmgebungsEntwurf[]>>;
  readonly vorhandene: readonly Programmclient[];
  readonly weiter: (felder: Partial<Programm>) => Promise<void>;
}

export function SchrittAdresse({
  entwurf,
  setzeEntwurf,
  umgebungen,
  setzeUmgebungen,
  vorhandene,
  weiter,
}: Props) {
  const [beruehrt, setzeBeruehrt] = useState(false);

  const maengel = umgebungen.map((u) => pruefeRueckweg(u.redirect_uri));
  const basisMangel = pruefeBasis(entwurf.basis_adresse);
  /*
   * Dieselbe Pruefung fuer die Adresse der Kachel, und zwar nicht aus Ordnungsliebe: der
   * Wert landet in `hub_apps.url` und von dort in ein `href` und in `location.assign`.
   * Ohne Schema koennte dort `javascript:` stehen, und dann fuehrte ein Administrator Code
   * im Browser jedes Nutzers aus. Die Datenbank haelt dieselbe Regel als CHECK; hier steht
   * sie, damit der Mangel unter dem Feld erscheint und nicht als Datenbankmeldung.
   * Leer ist erlaubt, dann gilt die Basis-Adresse.
   */
  const urlMangel = entwurf.url.trim() ? pruefeBasis(entwurf.url) : null;
  const offen = UMGEBUNGEN.filter((u) => !umgebungen.some((v) => v.umgebung === u.wert));
  const vollstaendig =
    !basisMangel && !urlMangel && umgebungen.length > 0 && maengel.every((m) => m === null);

  return (
    <div className="flex flex-col gap-7">
      <Glasflaeche titel="Adresse" className="p-[26px]">
        <div className="grid grid-cols-[1.6fr_1fr] gap-7">
          <Unterlinienfeld
            beschriftung="Basis-Adresse"
            wert={entwurf.basis_adresse}
            setze={(basis_adresse) => setzeEntwurf((e) => ({ ...e, basis_adresse }))}
            platzhalter="https://axon-editor.sliplane.app"
            hinweis={beruehrt && basisMangel ? basisMangel : "Ohne Pfad, ohne Schrägstrich am Ende."}
          />
          <Unterlinienfeld
            beschriftung="Gesundheitspfad"
            wert={entwurf.gesundheitspfad}
            setze={(gesundheitspfad) => setzeEntwurf((e) => ({ ...e, gesundheitspfad }))}
            platzhalter="/api/health"
            hinweis="Die Abnahme ruft ihn auf und liest die Fassung mit."
          />
        </div>

        <div className="pt-6">
          <Unterlinienfeld
            beschriftung="Adresse der Kachel"
            wert={entwurf.url}
            setze={(url) => setzeEntwurf((e) => ({ ...e, url }))}
            platzhalter={entwurf.basis_adresse || "https://axon-editor.sliplane.app"}
            hinweis={
              beruehrt && urlMangel
                ? urlMangel
                : "Wohin die Kachel auf der Bühne führt. Leer heißt: die Basis-Adresse."
            }
          />
        </div>
      </Glasflaeche>

      <Glasflaeche
        titel="Umgebungen"
        kopfrechts={
          offen.length > 0 && (
            <div className="flex items-center gap-2">
              {offen.map((u) => (
                <button
                  key={u.wert}
                  type="button"
                  onClick={() =>
                    setzeUmgebungen((v) => [...v, { umgebung: u.wert, redirect_uri: "" }])
                  }
                  className="cursor-pointer border border-axon-linie px-3 py-[6px] font-mono text-2xs tracking-fein uppercase text-axon-schrift-leise transition-colors duration-quick hover:border-axon-fokus hover:text-axon-schrift"
                >
                  + {u.wort}
                </button>
              ))}
            </div>
          )
        }
      >
        <div className="flex flex-col divide-y divide-axon-zeile-linie">
          {umgebungen.map((u, i) => {
            const schonAngelegt = vorhandene.some((c) => c.umgebung === u.umgebung);
            return (
              <div key={u.umgebung} className="grid grid-cols-[130px_1fr_auto] items-end gap-5 px-[22px] py-5">
                <div className="flex flex-col gap-[9px]">
                  <Etikett>Umgebung</Etikett>
                  <span className="font-sans text-md text-axon-schrift">
                    {UMGEBUNGEN.find((x) => x.wert === u.umgebung)?.wort}
                  </span>
                </div>

                <Unterlinienfeld
                  beschriftung="Rückweg"
                  wert={u.redirect_uri}
                  setze={(redirect_uri) =>
                    setzeUmgebungen((v) =>
                      v.map((x, j) => (j === i ? { ...x, redirect_uri } : x)),
                    )
                  }
                  platzhalter="https://axon-editor.sliplane.app/api/auth/callback"
                  hinweis={
                    beruehrt && maengel[i]
                      ? maengel[i]
                      : schonAngelegt
                        ? "Angelegt. Eine Änderung hier zieht den Client nach, ohne neues Geheimnis."
                        : "Vollständige Adresse, ohne Abfrage und ohne Anker."
                  }
                />

                <button
                  type="button"
                  disabled={umgebungen.length === 1}
                  onClick={() => setzeUmgebungen((v) => v.filter((_, j) => j !== i))}
                  title={
                    schonAngelegt
                      ? "Entfernt die Zeile hier. Der angelegte Client wird in Schritt 4 gelöscht."
                      : undefined
                  }
                  className="cursor-pointer border border-axon-linie px-3 py-[6px] font-mono text-2xs tracking-fein uppercase text-axon-schrift-fein transition-colors duration-quick hover:border-axon-fehler hover:text-axon-fehler disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Entfernen
                </button>
              </div>
            );
          })}
        </div>
      </Glasflaeche>

      <div className="flex">
        <Aktion
          onClick={() => {
            setzeBeruehrt(true);
            if (!vollstaendig) return;
            void weiter({
              basis_adresse: entwurf.basis_adresse.replace(/\/+$/u, ""),
              gesundheitspfad: entwurf.gesundheitspfad || "/api/health",
              url: entwurf.url.trim() || entwurf.basis_adresse.replace(/\/+$/u, ""),
            });
          }}
        >
          Weiter <span aria-hidden>→</span>
        </Aktion>
      </div>
    </div>
  );
}

function pruefeBasis(adresse: string): string | null {
  if (!adresse.trim()) return "Ohne Basis-Adresse kann die Abnahme nichts messen.";
  try {
    const u = new URL(adresse);
    if (u.protocol !== "http:" && u.protocol !== "https:") return "Nur http oder https.";
  } catch {
    return "Das ist keine vollständige Adresse. Sie beginnt mit https://.";
  }
  return null;
}

/** Dieselbe Prüfung wie in der Edge Function, nur früher: hier sieht man den Tippfehler noch. */
function pruefeRueckweg(u: string): string | null {
  if (!u.trim()) return "Ohne Rückweg kommt die Anmeldung nirgends an.";
  let geprueft: URL;
  try {
    geprueft = new URL(u);
  } catch {
    return "Das ist keine vollständige Adresse.";
  }
  if (geprueft.protocol !== "http:" && geprueft.protocol !== "https:") {
    return "Nur http oder https.";
  }
  if (geprueft.search || geprueft.hash) return "Rückwege tragen keine Abfrage und keinen Anker.";
  return null;
}
