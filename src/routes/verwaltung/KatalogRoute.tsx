import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";

import { Aktion, Brotkrume, Glasflaeche, Seitentitel } from "@/components/Bausteine";
import { Flaeche } from "@/components/Flaeche";
import { Kopfzeile } from "@/components/Kopfzeile";
import { Palette } from "@/components/Palette";
import type { Programm, Programmclient, Programmstatus } from "@/lib/typen";
import { ladeKatalog } from "@/lib/verwaltung";


/** Bildschirm 10 der Vorlage: der Katalog der Unterprogramme. */

const SPALTEN = "2.4fr 0.8fr 1.6fr 1fr 0.8fr 0.9fr";

const STATUSFARBE: Record<Programmstatus, string> = {
  aktiv: "text-success-text",
  pruefen: "text-warning-text",
  entwurf: "text-axon-schrift-fein",
};

const STATUSWORT: Record<Programmstatus, string> = {
  aktiv: "Aktiv",
  pruefen: "Prüfen",
  entwurf: "Entwurf",
};

export function KatalogRoute() {
  const [paletteOffen, setzePaletteOffen] = useState(false);
  const gehe = useNavigate();

  const [programme, setzeProgramme] = useState<readonly Programm[]>([]);
  const [clients, setzeClients] = useState<readonly Programmclient[]>([]);
  const [freigeschaltet, setzeFreigeschaltet] = useState<Record<string, number>>({});
  const [laedt, setzeLaedt] = useState(true);
  const [fehler, setzeFehler] = useState<string | null>(null);

  const neuLaden = useCallback(async () => {
    setzeLaedt(true);
    setzeFehler(null);
    try {
      const { programme: p, clients: c, freigeschaltet: f } = await ladeKatalog();
      setzeProgramme(p);
      setzeClients(c);
      setzeFreigeschaltet(f);
    } catch (ursache) {
      setzeFehler(ursache instanceof Error ? ursache.message : "Unbekannter Fehler.");
    }
    setzeLaedt(false);
  }, []);

  useEffect(() => {
    void neuLaden();
  }, [neuLaden]);

  return (
    <Flaeche schleier={paletteOffen ? "dicht" : "sammlung"} className="px-14 pt-[30px] pb-9">
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
              <Seitentitel>Katalog</Seitentitel>
            </div>

            <div className="ml-auto">
              <Aktion onClick={() => void gehe("/verwaltung/katalog/aufnehmen")}>
                Programm aufnehmen <span aria-hidden className="text-lg">+</span>
              </Aktion>
            </div>
          </div>

          <Glasflaeche className="flex-1">
            <div
              style={{ gridTemplateColumns: SPALTEN }}
              className="grid gap-3 border-b border-axon-linie-fein px-6 py-[15px] font-mono text-etikett tracking-brotkrume uppercase text-axon-schrift-leise"
            >
              <span>Programm</span>
              <span>Kürzel</span>
              <span>Adresse</span>
              <span>Freigeschaltet</span>
              <span>Fassung</span>
              <span>Status</span>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto">
              {laedt && (
                <p className="px-6 py-5 font-mono text-2xs tracking-etikett uppercase text-axon-schrift-still">
                  Katalog wird geladen
                </p>
              )}
              {fehler && (
                <p role="alert" className="px-6 py-5 font-sans text-base text-axon-fehler">
                  {fehler}
                </p>
              )}
              {!laedt && !fehler && programme.length === 0 && (
                <p className="px-6 py-5 font-sans text-base text-axon-schrift-fein">
                  Noch kein Programm aufgenommen.
                </p>
              )}

              {programme.map((p) => {
                const umgebungen = clients.filter((c) => c.app_id === p.id);
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => void gehe(`/verwaltung/katalog/${p.id}`)}
                    style={{ gridTemplateColumns: SPALTEN }}
                    className="grid w-full cursor-pointer items-center gap-3 border-b border-axon-zeile-linie px-6 py-[15px] text-left transition-colors duration-quick hover:bg-axon-zeile-hover"
                  >
                    <span className="flex min-w-0 items-center gap-3">
                      <span
                        aria-hidden
                        style={{ backgroundColor: p.akzent }}
                        className="size-[6px] shrink-0 rounded-full"
                      />
                      <span className="truncate font-sans text-md text-axon-schrift">{p.name}</span>
                    </span>
                    <span className="font-mono text-xs uppercase text-axon-schrift-leise">
                      {p.kuerzel}
                    </span>
                    <span className="truncate font-mono text-xs text-axon-schrift-leise">
                      {/*
                        Der Host, nicht die ganze Adresse: in einer Spalte von 1,6fr ist eine
                        volle URL abgeschnitten und damit unlesbar. Die Zahl der Umgebungen
                        daneben sagt, dass es mehr als eine gibt.
                      */}
                      {p.basis_adresse ? hostVon(p.basis_adresse) : "keine Adresse"}
                      {umgebungen.length > 1 && (
                        <span className="text-axon-schrift-fein">
                          {" "}
                          +{umgebungen.length - 1}
                        </span>
                      )}
                    </span>
                    <span className="font-mono text-xs text-axon-schrift-leise" data-numeric>
                      {freigeschaltet[p.id] ?? 0}
                    </span>
                    <span className="font-mono text-xs text-axon-schrift-leise" data-numeric>
                      {p.fassung ?? "—"}
                    </span>
                    <span className={`font-mono text-xs tracking-fein ${STATUSFARBE[p.status]}`}>
                      {STATUSWORT[p.status]}
                    </span>
                  </button>
                );
              })}
            </div>
          </Glasflaeche>
        </div>
      </div>

      <Palette offen={paletteOffen} setzeOffen={setzePaletteOffen} />
    </Flaeche>
  );
}

function hostVon(adresse: string): string {
  try {
    return new URL(adresse).host;
  } catch {
    return adresse;
  }
}
