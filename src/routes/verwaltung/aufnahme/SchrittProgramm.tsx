import type { Dispatch, SetStateAction } from "react";

import { Aktion, Etikett, Glasflaeche, Unterlinienfeld } from "@/components/Bausteine";
import { Kachel } from "@/components/Kachel";
import type { Programm } from "@/lib/typen";
import { AKZENTE } from "@/lib/typen";
import type { Entwurf } from "./AufnahmeRoute";

/**
 * Bildschirm 11: wer das Programm ist.
 *
 * Am Ende dieses Schritts entsteht die Zeile in `hub_apps`, mit `status = entwurf`. Erst
 * danach darf Schritt 4 Clients anlegen, die auf sie zeigen.
 */

/** `hub_apps.kurz` ist in der Datenbank auf 60 Zeichen begrenzt. Die Grenze steht hier sichtbar. */
const MAX_KURZ = 60;

interface Props {
  readonly entwurf: Entwurf;
  readonly setzeEntwurf: Dispatch<SetStateAction<Entwurf>>;
  readonly bearbeitet: boolean;
  readonly weiter: (felder: Partial<Programm>) => Promise<void>;
}

export function SchrittProgramm({ entwurf, setzeEntwurf, bearbeitet, weiter }: Props) {
  // Die Kennung wird aus dem Namen abgeleitet, solange niemand sie bearbeitet hat. Sie ist
  // der Primärschlüssel und steht in Redirect-URIs und Freischaltungen; nachträglich zu
  // ändern hieße, all das mitzuziehen. Deshalb ist sie beim Bearbeiten fest.
  const kennung = entwurf.id || schluessel(entwurf.name);
  const vollstaendig =
    entwurf.name.trim().length > 0 &&
    entwurf.kuerzel.trim().length > 0 &&
    entwurf.kurz.trim().length > 0 &&
    kennung.length > 0;

  const vorschau: Programm = {
    id: kennung,
    name: entwurf.name || "Ohne Namen",
    kuerzel: entwurf.kuerzel || "···",
    kurz: entwurf.kurz || "Noch kein Satz dazu.",
    akzent: entwurf.akzent,
    url: entwurf.url || null,
    sortierung: 0,
    aktiv: true,
    basis_adresse: null,
    gesundheitspfad: entwurf.gesundheitspfad,
    scopes: entwurf.scopes,
    zustimmung_ueberspringen: entwurf.zustimmung_ueberspringen,
    status: "entwurf",
    fassung: null,
    zuletzt_geprueft: null,
  };

  return (
    <div className="grid grid-cols-[1fr_auto] gap-7">
      <Glasflaeche titel="Programm" className="p-[26px]">
        <div className="flex flex-col gap-6">
          <Unterlinienfeld
            beschriftung="Name"
            wert={entwurf.name}
            setze={(name) => setzeEntwurf((e) => ({ ...e, name }))}
            platzhalter="AXON Editor"
          />

          <div className="grid grid-cols-2 gap-6">
            <Unterlinienfeld
              beschriftung="Kürzel"
              wert={entwurf.kuerzel}
              setze={(kuerzel) => setzeEntwurf((e) => ({ ...e, kuerzel: kuerzel.toUpperCase() }))}
              platzhalter="EDT"
              hinweis="Drei bis fünf Zeichen, steht auf der Kachel."
            />
            <Unterlinienfeld
              beschriftung="Kennung"
              wert={kennung}
              gesperrt={bearbeitet}
              setze={
                bearbeitet ? undefined : (id) => setzeEntwurf((e) => ({ ...e, id: schluessel(id) }))
              }
              hinweis={
                bearbeitet
                  ? "Steht fest, sobald das Programm angelegt ist."
                  : "Bleibt für immer. Steht in Freischaltungen und Adressen."
              }
            />
          </div>

          <div className="flex flex-col gap-[9px]">
            <div className="flex items-baseline gap-3">
              <Etikett>Ein Satz</Etikett>
              <span
                data-numeric
                className={
                  "ml-auto font-mono text-2xs " +
                  (entwurf.kurz.length > MAX_KURZ
                    ? "text-axon-fehler"
                    : "text-axon-schrift-fein")
                }
              >
                {entwurf.kurz.length}/{MAX_KURZ}
              </span>
            </div>
            <input
              value={entwurf.kurz}
              maxLength={MAX_KURZ}
              placeholder="Verwaltungsschalen bauen und prüfen."
              onChange={(ev) => setzeEntwurf((e) => ({ ...e, kurz: ev.target.value }))}
              className="h-8 border-0 border-b border-axon-feld-rand bg-transparent p-0 font-sans text-lg text-axon-schrift transition-colors duration-feld outline-none placeholder:text-axon-platzhalter focus:border-axon-fokus"
            />
          </div>

          <div className="flex flex-col gap-[14px]">
            <Etikett>Farbe</Etikett>
            <div className="flex items-center gap-[14px]">
              {AKZENTE.map((akzent) => (
                <button
                  key={akzent}
                  type="button"
                  aria-label={`Farbe ${akzent}`}
                  aria-pressed={entwurf.akzent === akzent}
                  onClick={() => setzeEntwurf((e) => ({ ...e, akzent }))}
                  style={{ backgroundColor: akzent }}
                  className="size-6 cursor-pointer rounded-full transition-transform duration-quick aria-pressed:ring-2 aria-pressed:ring-axon-fokus aria-pressed:ring-offset-2 aria-pressed:ring-offset-transparent motion-safe:hover:scale-110"
                />
              ))}
            </div>
          </div>

          <div className="flex pt-2">
            <Aktion
              disabled={!vollstaendig}
              onClick={() => {
                // Die abgeleitete Kennung muss in den Entwurf, sonst speichern die
                // folgenden Schritte gegen eine leere Kennung.
                setzeEntwurf((e) => ({ ...e, id: kennung }));
                void weiter({
                  id: kennung,
                  name: entwurf.name.trim(),
                  kuerzel: entwurf.kuerzel.trim(),
                  kurz: entwurf.kurz.trim(),
                  akzent: entwurf.akzent,
                  status: "entwurf",
                });
              }}
            >
              Weiter <span aria-hidden>→</span>
            </Aktion>
          </div>
        </div>
      </Glasflaeche>

      <div className="flex flex-col gap-[14px]">
        <Etikett>So sieht sie aus</Etikett>
        {/* Die echte Kachel, nicht ihr Abbild: was hier steht, steht nachher auf der Bühne. */}
        <Kachel programm={vorschau} />
      </div>
    </div>
  );
}

/** Kleinbuchstaben, Bindestriche, sonst nichts. `AXON Editor` wird zu `axon-editor`. */
function schluessel(text: string): string {
  return text
    .toLowerCase()
    .replaceAll("ä", "ae")
    .replaceAll("ö", "oe")
    .replaceAll("ü", "ue")
    .replaceAll("ß", "ss")
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-+|-+$/gu, "");
}
