import type { Dispatch, SetStateAction } from "react";

import { Aktion, Etikett, Glasflaeche } from "@/components/Bausteine";
import type { Programm, Scope } from "@/lib/typen";
import { SCOPE_TEXT } from "@/lib/typen";
import type { Entwurf } from "./AufnahmeRoute";

/**
 * Bildschirm 13: was das Programm über den Nutzer erfahren darf.
 *
 * Die Vorlage führt hier vier Zeilen, die vierte hieß `apps.read`. **Gemessen am 07.08.2026:
 * der Aussteller weist sie ab** (`unsupported scope: apps.read`); er kennt nur `openid`,
 * `profile`, `email`, `phone` und `offline_access`. Die Zeile ist deshalb weg statt als
 * Attrappe stehen zu bleiben.
 *
 * Und: durchgesetzt wird das hier auf **unserer** Zustimmungsseite. `createClient` kennt
 * kein Scope-Feld, technisch könnte jeder Client jeden der fünf verlangen. Was hier steht,
 * ist das Verabredete, gegen das die Zustimmungsseite die Anfrage hält.
 */

/** Was ein Mensch entscheidet, und welche Scopes das nach sich zieht. */
const ZEILEN: readonly {
  readonly titel: string;
  readonly erklaerung: string;
  readonly scopes: readonly Scope[];
  readonly fest?: boolean;
}[] = [
  {
    titel: "Wer du bist",
    erklaerung: "Kennung und Anzeigename. Ohne das kann kein Programm dich wiedererkennen.",
    scopes: ["openid", "profile"],
    fest: true,
  },
  {
    titel: "Deine E-Mail-Adresse",
    erklaerung: "Lesen, nicht ändern.",
    scopes: ["email"],
  },
  {
    titel: "Angemeldet bleiben",
    erklaerung: "Das Programm darf sich später erneut anmelden, ohne dass du dabei bist.",
    scopes: ["offline_access"],
  },
];

interface Props {
  readonly entwurf: Entwurf;
  readonly setzeEntwurf: Dispatch<SetStateAction<Entwurf>>;
  readonly weiter: (felder: Partial<Programm>) => Promise<void>;
}

export function SchrittZugriff({ entwurf, setzeEntwurf, weiter }: Props) {
  const an = (zeile: (typeof ZEILEN)[number]) =>
    zeile.scopes.every((s) => entwurf.scopes.includes(s));

  function schalte(zeile: (typeof ZEILEN)[number]) {
    if (zeile.fest) return;
    setzeEntwurf((e) => {
      const drin = zeile.scopes.every((s) => e.scopes.includes(s));
      const scopes = drin
        ? e.scopes.filter((s) => !zeile.scopes.includes(s))
        : [...e.scopes, ...zeile.scopes.filter((s) => !e.scopes.includes(s))];
      return { ...e, scopes };
    });
  }

  return (
    <div className="grid grid-cols-[1fr_320px] gap-7">
      <Glasflaeche titel="Zugriff">
        <div className="flex flex-col divide-y divide-axon-zeile-linie">
          {ZEILEN.map((zeile) => (
            <button
              key={zeile.titel}
              type="button"
              disabled={zeile.fest}
              onClick={() => schalte(zeile)}
              aria-pressed={an(zeile)}
              className="flex cursor-pointer items-start gap-5 px-[22px] py-[18px] text-left transition-colors duration-quick hover:bg-axon-zeile-hover disabled:cursor-default disabled:hover:bg-transparent"
            >
              <span
                aria-hidden
                className={
                  "mt-[3px] flex size-[18px] shrink-0 items-center justify-center border text-2xs " +
                  (an(zeile)
                    ? "border-axon-fokus bg-axon-wahl-flaeche text-axon-fokus"
                    : "border-axon-linie text-transparent")
                }
              >
                ✓
              </span>
              <span className="flex min-w-0 flex-col gap-[5px]">
                <span className="font-sans text-md text-axon-schrift">{zeile.titel}</span>
                <span className="font-sans text-base text-axon-schrift-fein">
                  {zeile.erklaerung}
                </span>
                <span className="font-mono text-2xs tracking-fein text-axon-schrift-still">
                  {zeile.scopes.join(" ")}
                  {zeile.fest && " · immer"}
                </span>
              </span>
            </button>
          ))}
        </div>

        <div className="border-t border-axon-linie-fein px-[22px] py-[18px]">
          <label className="flex cursor-pointer items-start gap-5">
            <input
              type="checkbox"
              checked={entwurf.zustimmung_ueberspringen}
              onChange={(ev) =>
                setzeEntwurf((e) => ({ ...e, zustimmung_ueberspringen: ev.target.checked }))
              }
              className="mt-[3px] size-[18px] shrink-0 cursor-pointer accent-axon-fokus"
            />
            <span className="flex flex-col gap-[5px]">
              <span className="font-sans text-md text-axon-schrift">
                Zustimmungsseite überspringen
              </span>
              <span className="font-sans text-base text-axon-schrift-fein">
                Nur für Programme aus diesem Haus. Der Nutzer sieht die Frage dann nicht und
                landet gleich im Programm. Fragt es mehr an, als hier steht, wird trotzdem
                gefragt.
              </span>
            </span>
          </label>
        </div>
      </Glasflaeche>

      <div className="flex flex-col gap-[14px]">
        <Etikett>Was der Nutzer liest</Etikett>
        <div
          data-glas
          className="flex flex-col gap-4 border border-axon-flaeche-rand bg-axon-flaeche p-5 backdrop-blur-flaeche"
        >
          {entwurf.zustimmung_ueberspringen ? (
            <p className="font-sans text-base text-axon-schrift-fein">
              Nichts. Die Seite wird übersprungen, solange die Anfrage im Rahmen bleibt.
            </p>
          ) : (
            <>
              <p className="font-sans text-base text-axon-schrift">
                <span className="text-axon-schrift">{entwurf.name || "Das Programm"}</span> möchte:
              </p>
              <ul className="flex flex-col gap-[14px]">
                {entwurf.scopes.map((s) => (
                  <li key={s} className="flex flex-col gap-[3px]">
                    <span className="font-sans text-base text-axon-schrift">
                      {SCOPE_TEXT[s].titel}
                    </span>
                    <span className="font-sans text-sm text-axon-schrift-fein">
                      {SCOPE_TEXT[s].detail}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>

        <div className="flex pt-2">
          <Aktion
            onClick={() =>
              void weiter({
                scopes: entwurf.scopes,
                zustimmung_ueberspringen: entwurf.zustimmung_ueberspringen,
              })
            }
          >
            Weiter <span aria-hidden>→</span>
          </Aktion>
        </div>
      </div>
    </div>
  );
}
