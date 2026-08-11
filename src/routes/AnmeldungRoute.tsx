import { useRef, useState, type FormEvent } from "react";
import { Navigate, useSearchParams } from "react-router";

import { AxonKeyvisual } from "@/components/Keyvisual/AxonKeyvisual";
import logo from "@/assets/neoception-weiss.png";
import { supabase } from "@/lib/supabase";
import { nurEigenerPfad } from "@/lib/utils";
import { useSitzung } from "@/store/sitzung";

/**
 * Bildschirm 01 der Vorlage.
 *
 * Die Anmeldeleiste steht ueber die volle Hoehe am rechten Rand, 38 Prozent breit, und
 * laesst als einzige Flaeche des Hubs das Keyvisual durchscheinen (Streuung 10px statt 18
 * bis 20). Hinter ihr laufen die Schienen weiter, und genau die soll man ahnen.
 *
 * Unter 48rem bleibt sie eine Karte ueber die volle Breite: ein 38-Prozent-Streifen mit
 * 420px Mindestbreite ergibt auf einem Telefon keinen Sinn.
 */

export function AnmeldungRoute() {
  const sitzung = useSitzung((z) => z.sitzung);
  const [parameter] = useSearchParams();
  const leisteRef = useRef<HTMLDivElement>(null);

  const [email, setzeEmail] = useState("");
  const [passwort, setzePasswort] = useState("");
  const [laeuft, setzeLaeuft] = useState(false);
  const [fehler, setzeFehler] = useState<string | null>(null);
  const [hinweis, setzeHinweis] = useState<string | null>(null);

  // `weiter` kommt aus der Adresszeile. `nurEigenerPfad` haelt es im eigenen Programm:
  // `//boesewicht.invalid` ist ein protokollrelativer Pfad und fuehrte sonst nach der
  // Anmeldung auf eine fremde Seite.
  if (sitzung) return <Navigate to={nurEigenerPfad(parameter.get("weiter"))} replace />;

  const anmelden = async (ereignis: FormEvent) => {
    ereignis.preventDefault();
    setzeLaeuft(true);
    setzeFehler(null);
    setzeHinweis(null);

    const { error } = await supabase.auth.signInWithPassword({ email, password: passwort });

    if (error) {
      // Bewusst dieselbe Meldung fuer falsches Passwort und unbekannte Adresse: sonst ist
      // die Anmeldung ein Verzeichnis darueber, wer hier ein Konto hat.
      setzeFehler(
        error.message.toLowerCase().includes("invalid")
          ? "E-Mail oder Passwort stimmt nicht."
          : error.message,
      );
      setzeLaeuft(false);
      return;
    }
    // Kein setzeLaeuft(false): der Zustandswechsel leitet gleich weiter, und ein wieder
    // aktiver Knopf davor sieht aus, als waere nichts passiert.
  };

  const passwortVergessen = async () => {
    if (!email) {
      setzeFehler("Bitte zuerst die E-Mail-Adresse eintragen.");
      return;
    }
    setzeFehler(null);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/passwort-setzen`,
    });
    if (error) setzeFehler(error.message);
    else setzeHinweis("Wenn es zu dieser Adresse ein Konto gibt, ist die Mail unterwegs.");
  };

  return (
    <div className="szene-axon relative min-h-dvh overflow-hidden bg-axon-grund">
      <AxonKeyvisual kartenRef={leisteRef} />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-(image:--axon-schleier-buehne)"
      />

      <img
        src={logo}
        alt="Neoception, Pepperl+Fuchs"
        className="absolute top-10 left-12 z-10 block h-auto w-(--w-anmeldelogo)"
      />

      <div
        ref={leisteRef}
        data-glas
        style={{
          // Der Blitz. Erreicht ein Datenpaket das Ende einer Schiene, schreibt das
          // Keyvisual --axon-blitz hierher, und Rand und Schein leiten sich daraus ab.
          // Bewusst eine CSS-Variable statt Zustand: sonst renderte React im Takt der
          // Animation, also sechzig Mal je Sekunde.
          borderLeftColor: "rgb(255 255 255 / calc(0.1 + 0.5 * var(--axon-blitz)))",
          boxShadow: "0 0 calc(20px + 40px * var(--axon-blitz)) rgb(0 253 253 / calc(0.16 * var(--axon-blitz)))",
        }}
        className="absolute inset-y-0 right-0 z-10 flex w-full flex-col justify-center gap-[34px] border-l border-axon-anmeldung-rand bg-axon-anmeldung px-[8%] backdrop-blur-anmeldung md:w-(--w-anmeldeleiste) md:min-w-(--min-w-anmeldeleiste) md:pl-(--pl-anmeldeleiste) md:pr-(--pr-anmeldeleiste)"
      >
        {/* Die Lichtkante: cyan oben, gruen unten, an den Enden auslaufend. */}
        <div
          aria-hidden
          className="absolute inset-y-0 left-0 w-px bg-(image:--axon-kante)"
        />
        <div
          aria-hidden
          className="absolute -left-0.5 size-[5px] rounded-full bg-white shadow-(--axon-kante-schein) motion-safe:animate-[axon-kante_7.5s_cubic-bezier(0.45,0,0.55,1)_infinite]"
        />
        <div
          aria-hidden
          className="absolute -left-px size-[3px] rounded-full bg-axon-kante-punkt shadow-(--axon-kante-schein-klein) motion-safe:animate-[axon-kante_7.5s_cubic-bezier(0.45,0,0.55,1)_-3.75s_infinite]"
        />

        <h1 className="flex items-baseline gap-3 leading-[1.05]">
          <span className="font-display text-4xl font-normal tracking-marke text-axon-schrift">
            AXON
          </span>
          <span className="font-display text-4xl font-extralight tracking-marke-leicht text-axon-schrift-leise">
            Studio
          </span>
        </h1>

        <form onSubmit={(e) => void anmelden(e)} className="flex flex-col gap-5">
          <Feld
            beschriftung="E-Mail"
            typ="email"
            wert={email}
            setze={setzeEmail}
            platzhalter="name@unternehmen.de"
            autoComplete="username"
          />
          <Feld
            beschriftung="Passwort"
            typ="password"
            wert={passwort}
            setze={setzePasswort}
            platzhalter="••••••••••"
            autoComplete="current-password"
          />

          {/* aria-live, damit der Fehler auch angesagt wird und nicht nur erscheint. */}
          <p aria-live="polite" className="min-h-4 font-sans text-sm text-axon-fehler">
            {fehler ?? hinweis ?? ""}
          </p>

          <button
            type="submit"
            disabled={laeuft}
            className="flex h-(--h-anmeldeknopf) cursor-pointer items-center justify-between border border-axon-aktion px-5 font-sans text-sm tracking-aktion uppercase text-axon-schrift transition-[background-color,border-color] duration-calm hover:border-axon-aktion-hover hover:bg-axon-aktion disabled:cursor-wait disabled:opacity-60"
          >
            <span>{laeuft ? "Einen Moment" : "Anmelden"}</span>
            <span aria-hidden className="text-lg">
              →
            </span>
          </button>

          <div className="flex items-center justify-between font-mono text-2xs tracking-fein text-axon-schrift-leise">
            <button
              type="button"
              onClick={() => void passwortVergessen()}
              className="cursor-pointer transition-colors duration-quick hover:text-axon-fokus"
            >
              Passwort vergessen
            </button>
            <span>AXON Studio&thinsp;//&thinsp;{__APP_VERSION__}</span>
          </div>
        </form>
      </div>
    </div>
  );
}

/**
 * Ein Feld der Anmeldung: keine Umrandung, nur eine Unterlinie, die beim Fokus auf Cyan
 * wechselt. Der globale Fokusring waere hier ein Kasten um ein Feld, das keiner ist,
 * deshalb `focus:outline-none` zusammen mit einem sichtbaren Ersatz.
 */
function Feld({
  beschriftung,
  typ,
  wert,
  setze,
  platzhalter,
  autoComplete,
}: {
  readonly beschriftung: string;
  readonly typ: "email" | "password";
  readonly wert: string;
  readonly setze: (wert: string) => void;
  readonly platzhalter: string;
  readonly autoComplete: string;
}) {
  return (
    <label className="flex flex-col gap-[9px]">
      <span className="font-mono text-etikett tracking-etikett uppercase text-axon-schrift-still">
        {beschriftung}
      </span>
      <input
        type={typ}
        required
        value={wert}
        onChange={(e) => setze(e.target.value)}
        placeholder={platzhalter}
        autoComplete={autoComplete}
        className="h-(--h-anmeldefeld) border-0 border-b border-axon-feld-rand bg-transparent p-0 font-sans text-lg text-axon-schrift transition-colors duration-feld outline-none placeholder:text-axon-platzhalter focus:border-axon-fokus"
      />
    </label>
  );
}
