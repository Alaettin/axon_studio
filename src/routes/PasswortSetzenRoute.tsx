import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router";

import { Flaeche } from "@/components/Flaeche";
import { Marke } from "@/components/Marke";
import { supabase } from "@/lib/supabase";
import { useSitzung } from "@/store/sitzung";

/**
 * Wo eine Einladung und ein Passwort-Zurücksetzen landen.
 *
 * Beide Wege enden mit einem Link, den Supabase in eine Sitzung eintauscht
 * (`detectSessionInUrl`). Wer hier ankommt, ist also bereits angemeldet und setzt nur noch
 * sein Passwort. Ohne Sitzung ist der Link abgelaufen oder schon benutzt, und genau das
 * gehoert dann dagestanden statt eines leeren Formulars.
 */

const MINDESTLAENGE = 10;

export function PasswortSetzenRoute() {
  const sitzung = useSitzung((z) => z.sitzung);
  const gehe = useNavigate();

  const [passwort, setzePasswort] = useState("");
  const [wiederholung, setzeWiederholung] = useState("");
  const [laeuft, setzeLaeuft] = useState(false);
  const [fehler, setzeFehler] = useState<string | null>(null);

  const zuKurz = passwort.length > 0 && passwort.length < MINDESTLAENGE;
  const ungleich = wiederholung.length > 0 && passwort !== wiederholung;

  const setzen = async (ereignis: FormEvent) => {
    ereignis.preventDefault();
    setzeLaeuft(true);
    setzeFehler(null);

    const { error } = await supabase.auth.updateUser({ password: passwort });
    if (error) {
      setzeFehler(error.message);
      setzeLaeuft(false);
      return;
    }
    void gehe("/", { replace: true });
  };

  return (
    <Flaeche schleier="mitte" className="items-center justify-center gap-7 p-9">
      <Marke mitLogo />

      <div className="flex w-[480px] max-w-full flex-col gap-6 border border-axon-linie bg-popover p-7">
        {sitzung === undefined && (
          <p className="font-mono text-2xs tracking-etikett uppercase text-axon-schrift-still">
            Einen Moment
          </p>
        )}

        {sitzung === null && (
          <p className="font-sans text-base text-axon-schrift-leise">
            Dieser Link ist abgelaufen oder wurde schon benutzt. Lass dir über „Passwort
            vergessen" einen neuen schicken.
          </p>
        )}

        {sitzung && (
          <form onSubmit={(e) => void setzen(e)} className="flex flex-col gap-6">
            <h1 className="font-display text-3xl font-extralight tracking-titel text-axon-schrift">
              Passwort setzen
            </h1>

            <label className="flex flex-col gap-[9px]">
              <span className="font-mono text-etikett tracking-etikett uppercase text-axon-schrift-still">
                Neues Passwort
              </span>
              <input
                type="password"
                required
                minLength={MINDESTLAENGE}
                autoComplete="new-password"
                value={passwort}
                onChange={(e) => setzePasswort(e.target.value)}
                className="h-8 border-0 border-b border-axon-feld-rand bg-transparent p-0 font-sans text-lg text-axon-schrift transition-colors duration-feld outline-none focus:border-axon-fokus"
              />
              <span className="font-sans text-sm text-axon-schrift-leise">
                Mindestens {MINDESTLAENGE} Zeichen.
              </span>
            </label>

            <label className="flex flex-col gap-[9px]">
              <span className="font-mono text-etikett tracking-etikett uppercase text-axon-schrift-still">
                Wiederholung
              </span>
              <input
                type="password"
                required
                autoComplete="new-password"
                value={wiederholung}
                onChange={(e) => setzeWiederholung(e.target.value)}
                className="h-8 border-0 border-b border-axon-feld-rand bg-transparent p-0 font-sans text-lg text-axon-schrift transition-colors duration-feld outline-none focus:border-axon-fokus"
              />
            </label>

            {/* Eine Meldung, nicht drei uebereinander: der erste Grund ist der, den man
                zuerst beheben muss. */}
            <p aria-live="polite" className="min-h-4 font-sans text-sm text-axon-fehler">
              {fehler ??
                (zuKurz
                  ? `Noch zu kurz, mindestens ${String(MINDESTLAENGE)} Zeichen.`
                  : ungleich
                    ? "Die beiden stimmen nicht überein."
                    : "")}
            </p>

            <button
              type="submit"
              disabled={laeuft || zuKurz || ungleich || passwort.length === 0}
              className="h-(--h-anmeldeknopf) cursor-pointer border border-axon-aktion font-sans text-sm tracking-aktion uppercase text-axon-schrift transition-[background-color,border-color] duration-calm hover:border-axon-aktion-hover hover:bg-axon-aktion disabled:cursor-not-allowed disabled:opacity-45"
            >
              {laeuft ? "Einen Moment" : "Passwort setzen"}
            </button>
          </form>
        )}
      </div>
    </Flaeche>
  );
}
