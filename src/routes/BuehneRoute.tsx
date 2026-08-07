import { useState } from "react";

import { Flaeche } from "@/components/Flaeche";
import { GesperrteKachel, Kachel } from "@/components/Kachel";
import { Kopfzeile } from "@/components/Kopfzeile";
import { Palette } from "@/components/Palette";
import { anrede } from "@/lib/typen";
import { useKatalogteile, useSitzung } from "@/store/sitzung";

/**
 * Bildschirm 02 der Vorlage: die Buehne mit den freigeschalteten Programmen.
 *
 * Die Kacheln stehen in der Mitte und nicht in einem Raster am oberen Rand. Bei drei bis
 * acht Programmen ist das die ehrlichere Form: ein Raster verspricht Fuellung, die es
 * nicht gibt.
 */

export function BuehneRoute() {
  const profil = useSitzung((z) => z.profil);
  const laedt = useSitzung((z) => z.laedt);
  const fehler = useSitzung((z) => z.fehler);
  const { offen, gesperrt } = useKatalogteile();
  const [paletteOffen, setzePaletteOffen] = useState(false);

  return (
    <Flaeche schleier={paletteOffen ? "dicht" : "sammlung"} className="items-center px-14 pt-[30px] pb-10">
      <Kopfzeile oeffnePalette={() => setzePaletteOffen(true)} gedaempft={paletteOffen} />

      <div className="flex w-full flex-1 flex-col items-center justify-center gap-14">
        <h1 className="text-center font-display text-5xl font-extralight tracking-begruessung text-axon-schrift">
          {profil ? `${gruss()}, ${anrede(profil)}.` : gruss() + "."}
        </h1>

        {fehler && (
          <p role="alert" className="font-sans text-base text-axon-fehler">
            {fehler}
          </p>
        )}

        {laedt && offen.length === 0 && !fehler && (
          <p className="font-mono text-2xs tracking-etikett uppercase text-axon-schrift-still">
            Programme werden geladen
          </p>
        )}

        {!laedt && offen.length === 0 && gesperrt.length === 0 && !fehler && (
          <p className="max-w-[46ch] text-center font-sans text-base text-axon-schrift-fein">
            Für dich ist noch kein Programm freigeschaltet. Wende dich an eine Person mit
            Verwaltungsrechten.
          </p>
        )}

        {/* data-geladen unterscheidet "noch nichts da" von "nichts freigeschaltet". Der
            Browsertest haengt daran, und ohne die Unterscheidung prueft er gegen einen
            halb geladenen Zustand. */}
        <div
          data-geladen={laedt || (offen.length === 0 && gesperrt.length === 0) ? "nein" : "ja"}
          className="flex items-stretch gap-5"
        >
          {offen.map((programm) => (
            <Kachel key={programm.id} programm={programm} />
          ))}
          <GesperrteKachel programme={gesperrt} />
        </div>
      </div>

      <Palette offen={paletteOffen} setzeOffen={setzePaletteOffen} />
    </Flaeche>
  );
}

/**
 * Morgen, Tag, Abend. Nach Ortszeit des Browsers, nicht nach Serverzeit: gegruesst wird
 * der Mensch vor dem Bildschirm.
 */
function gruss(): string {
  const stunde = new Date().getHours();
  if (stunde < 11) return "Guten Morgen";
  if (stunde < 18) return "Guten Tag";
  return "Guten Abend";
}
