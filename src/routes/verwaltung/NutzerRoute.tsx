import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router";

import { Aktion, Brotkrume, Glasflaeche, Seitentitel } from "@/components/Bausteine";
import { Flaeche } from "@/components/Flaeche";
import { Kopfzeile } from "@/components/Kopfzeile";
import { Palette } from "@/components/Palette";
import { EinladenDialog } from "@/routes/verwaltung/EinladenDialog";
import { NutzerDetail } from "@/routes/verwaltung/NutzerDetail";
import { initialen, type Nutzerzeile } from "@/lib/typen";
import { ladeNutzer } from "@/lib/verwaltung";
import { useSitzung } from "@/store/sitzung";

/** Bildschirm 07 der Vorlage: die Nutzerliste. */

const SPALTEN = "2.2fr 2fr 1fr 1.1fr 1.3fr 1fr";

export function NutzerRoute() {
  const katalog = useSitzung((z) => z.katalog);
  const [paletteOffen, setzePaletteOffen] = useState(false);
  const [einladenOffen, setzeEinladenOffen] = useState(false);
  const [gewaehlt, setzeGewaehlt] = useState<string | null>(null);

  const [nutzer, setzeNutzer] = useState<readonly Nutzerzeile[]>([]);
  const [laedt, setzeLaedt] = useState(true);
  const [fehler, setzeFehler] = useState<string | null>(null);
  const [suche, setzeSuche] = useState("");

  const neuLaden = useCallback(async () => {
    setzeLaedt(true);
    setzeFehler(null);
    try {
      const { nutzer: geladen } = await ladeNutzer();
      setzeNutzer(geladen);
    } catch (ursache) {
      setzeFehler(ursache instanceof Error ? ursache.message : "Unbekannter Fehler.");
    }
    setzeLaedt(false);
  }, []);

  useEffect(() => {
    void neuLaden();
  }, [neuLaden]);

  const gefiltert = useMemo(() => {
    const nadel = suche.trim().toLowerCase();
    if (!nadel) return nutzer;
    return nutzer.filter(
      (n) =>
        (n.display_name ?? "").toLowerCase().includes(nadel) ||
        (n.email ?? "").toLowerCase().includes(nadel),
    );
  }, [nutzer, suche]);

  const gewaehlterNutzer = nutzer.find((n) => n.id === gewaehlt) ?? null;

  return (
    <Flaeche
      schleier={paletteOffen || gewaehlt || einladenOffen ? "dicht" : "sammlung"}
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
              <Seitentitel>Nutzer</Seitentitel>
            </div>

            <div
              data-glas
              className="ml-auto flex h-(--h-feld) items-center border border-axon-leiste-rand bg-axon-leiste px-[14px] backdrop-blur-leiste"
            >
              <input
                type="search"
                value={suche}
                onChange={(e) => setzeSuche(e.target.value)}
                placeholder="Nutzer suchen"
                aria-label="Nutzer suchen"
                className="h-full w-[190px] border-0 bg-transparent p-0 font-sans text-md text-axon-schrift outline-none placeholder:text-axon-platzhalter"
              />
            </div>

            <Aktion onClick={() => setzeEinladenOffen(true)}>
              Einladen <span aria-hidden className="text-lg">+</span>
            </Aktion>
          </div>

          <Glasflaeche className="flex-1">
            <div
              style={{ gridTemplateColumns: SPALTEN }}
              className="grid gap-3 border-b border-axon-linie-fein px-6 py-[15px] font-mono text-etikett tracking-brotkrume uppercase text-axon-schrift-leise"
            >
              <span>Nutzer</span>
              <span>E-Mail</span>
              <span>Rolle</span>
              <span>Programme</span>
              <span>Letzte Anmeldung</span>
              <span>Status</span>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto">
              {laedt && (
                <p className="px-6 py-5 font-mono text-2xs tracking-etikett uppercase text-axon-schrift-still">
                  Nutzer werden geladen
                </p>
              )}
              {fehler && (
                <p role="alert" className="px-6 py-5 font-sans text-base text-axon-fehler">
                  {fehler}
                </p>
              )}
              {!laedt && !fehler && gefiltert.length === 0 && (
                <p className="px-6 py-5 font-sans text-base text-axon-schrift-fein">
                  {suche ? "Kein Treffer." : "Noch niemand."}
                </p>
              )}

              {gefiltert.map((zeile) => (
                <button
                  key={zeile.id}
                  type="button"
                  onClick={() => setzeGewaehlt(zeile.id)}
                  style={{ gridTemplateColumns: SPALTEN }}
                  className="grid w-full cursor-pointer items-center gap-3 border-b border-axon-zeile-linie px-6 py-[15px] text-left transition-colors duration-quick hover:bg-axon-zeile-hover"
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <span
                      aria-hidden
                      className="flex size-7 shrink-0 items-center justify-center rounded-full border border-axon-linie-fein bg-axon-avatar-still font-sans text-2xs text-axon-schrift-leise"
                    >
                      {initialen(zeile)}
                    </span>
                    <span className="truncate font-sans text-md text-axon-schrift">
                      {zeile.display_name ?? "Ohne Namen"}
                    </span>
                  </span>
                  <span className="truncate font-mono text-xs text-axon-schrift-leise">
                    {zeile.email}
                  </span>
                  <span className="font-sans text-base text-axon-schrift-leise">
                    {zeile.role === "admin" ? "Administrator" : "Nutzer"}
                  </span>
                  {/*
                    Nur zaehlen, was im Katalog steht. `user_tool_access` ist mit der AAS
                    Tools Platform geteilt und traegt auch Kennungen von Werkzeugen, die
                    keine Programme des Hubs sind. Ohne den Filter stand dort "3 von 1",
                    sobald der Katalog kleiner wurde als der Bestand an Freischaltungen.
                  */}
                  <span className="font-mono text-xs text-axon-schrift-leise" data-numeric>
                    {zeile.programme.filter((p) => katalog.some((k) => k.id === p)).length} von{" "}
                    {katalog.length}
                  </span>
                  <span className="font-mono text-xs text-axon-schrift-leise" data-numeric>
                    {alsDatum(zeile.zuletzt_angemeldet)}
                  </span>
                  <span
                    className={
                      zeile.status === "gesperrt"
                        ? "font-mono text-xs tracking-fein text-axon-fehler"
                        : "font-mono text-xs tracking-fein text-success-text"
                    }
                  >
                    {zeile.status === "gesperrt" ? "Gesperrt" : "Aktiv"}
                  </span>
                </button>
              ))}
            </div>
          </Glasflaeche>
        </div>
      </div>

      {gewaehlterNutzer && (
        <NutzerDetail
          nutzer={gewaehlterNutzer}
          schliesse={() => setzeGewaehlt(null)}
          neuLaden={neuLaden}
        />
      )}
      {einladenOffen && (
        <EinladenDialog schliesse={() => setzeEinladenOffen(false)} neuLaden={neuLaden} />
      )}
      <Palette offen={paletteOffen} setzeOffen={setzePaletteOffen} />
    </Flaeche>
  );
}

/**
 * "Nie" statt eines leeren Feldes, und ein Datum statt eines Zeitstempels: die Uhrzeit der
 * letzten Anmeldung interessiert niemanden, die Spalte waere nur breiter.
 */
function alsDatum(wert: string | null): string {
  if (!wert) return "Nie";
  return new Date(wert).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}
