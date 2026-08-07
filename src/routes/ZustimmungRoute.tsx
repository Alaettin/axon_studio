import { useEffect, useState } from "react";
import { Navigate, useSearchParams } from "react-router";

import { Etikett } from "@/components/Bausteine";
import { Flaeche } from "@/components/Flaeche";
import { Marke } from "@/components/Marke";
import { supabase } from "@/lib/supabase";
import { useSitzung } from "@/store/sitzung";

/**
 * Bildschirm 04 der Vorlage: ein Programm fragt Zugang an.
 *
 * Supabase leitet hierher mit einer `authorization_id`. Der Pfad ist in den
 * Einstellungen als Authorization Path hinterlegt und haengt zusammen mit der Site URL an
 * der Domain: aendert sich die Domain, aendert sich der Ort dieser Seite, und alle Flows
 * laufen ins Leere.
 *
 * Der Aufruf hat zwei moegliche Antworten, und das Unterscheiden ist Pflicht: entweder
 * eine Zustimmung ist noetig (dann steht `authorization_id` in der Antwort), oder der
 * Nutzer hat diesem Programm schon einmal zugestimmt und wird ohne Frage weitergeleitet.
 */

/** Was die Scopes fuer einen Menschen bedeuten. Unbekannte werden roh angezeigt. */
const SCOPE_TEXT: Record<string, { titel: string; detail: string }> = {
  openid: {
    titel: "Wer du bist",
    detail: "Deine Kennung in AXON Studio, damit das Programm dich wiedererkennt.",
  },
  email: {
    titel: "Deine E-Mail-Adresse",
    detail: "Lesen, nicht ändern.",
  },
  profile: {
    titel: "Dein Name",
    detail: "Anzeigename und Bild, soweit hinterlegt.",
  },
  offline_access: {
    titel: "Zugang auch ohne dich",
    detail: "Das Programm darf sich später erneut anmelden, ohne dass du dabei bist.",
  },
};

interface Details {
  readonly authorization_id: string;
  readonly client: { readonly name?: string };
  readonly redirect_uri?: string;
  readonly scope?: string;
}

export function ZustimmungRoute() {
  const [parameter] = useSearchParams();
  const sitzung = useSitzung((z) => z.sitzung);
  const profil = useSitzung((z) => z.profil);
  const kennung = parameter.get("authorization_id");

  const [details, setzeDetails] = useState<Details | null>(null);
  const [laedt, setzeLaedt] = useState(true);
  const [fehler, setzeFehler] = useState<string | null>(null);
  const [entscheidet, setzeEntscheidet] = useState(false);

  /*
   * Abhaengig von der **Kennung** des Angemeldeten, nicht vom Sitzungsobjekt.
   *
   * `sitzung` bekommt bei jedem Auffrischen des Tokens eine neue Identitaet, und der
   * Effekt lief dadurch mehrfach: im Container waren es zwei Abrufe derselben
   * `authorization_id` hintereinander, im Netzwerkmitschnitt gut zu sehen. Harmlos
   * gelesen, aber eine Autorisierungsanfrage ist nichts, was man zweimal abholt.
   */
  const angemeldetAls = sitzung?.user.id ?? null;

  useEffect(() => {
    if (!kennung || !angemeldetAls) return;

    void (async () => {
      const { data, error } = await supabase.auth.oauth.getAuthorizationDetails(kennung);
      if (error) {
        setzeFehler(error.message);
      } else if (data && !("authorization_id" in data)) {
        // Schon einmal zugestimmt: keine Frage, nur der Weg zurueck.
        window.location.assign(data.redirect_url);
        return;
      } else if (data) {
        setzeDetails(data as unknown as Details);
      }
      setzeLaedt(false);
    })();
  }, [kennung, angemeldetAls]);

  // Noch nicht angemeldet: hin zur Anmeldung, und die Kennung mitnehmen, sonst ist die
  // Anfrage nach dem Anmelden verloren.
  if (sitzung === null) {
    const ziel = `/zustimmung?authorization_id=${encodeURIComponent(kennung ?? "")}`;
    return <Navigate to={`/anmeldung?weiter=${encodeURIComponent(ziel)}`} replace />;
  }

  const entscheide = async (erlauben: boolean) => {
    if (!kennung) return;
    setzeEntscheidet(true);
    const { data, error } = erlauben
      ? await supabase.auth.oauth.approveAuthorization(kennung)
      : await supabase.auth.oauth.denyAuthorization(kennung);

    if (error) {
      setzeFehler(error.message);
      setzeEntscheidet(false);
      return;
    }
    window.location.assign(data.redirect_url);
  };

  const scopes = (details?.scope ?? "").split(" ").filter(Boolean);

  return (
    <Flaeche schleier="mitte" className="items-center justify-center gap-7 p-9">
      <Marke mitLogo />

      <div className="flex w-[480px] max-w-full flex-col border border-axon-linie bg-popover shadow-[var(--shadow-overlay)]">
        <div className="flex flex-col gap-2 border-b border-axon-linie-fein px-7 pt-7 pb-6">
          <Etikett>Anfrage von einem Programm</Etikett>
          {!kennung ? (
            <p className="font-sans text-base text-axon-fehler">
              In der Adresse fehlt die Kennung der Anfrage. Öffne das Programm erneut.
            </p>
          ) : (
            <>
              <p className="font-display text-2xl font-light text-axon-schrift">
                {details?.client.name ?? "Ein Programm"}
                <span className="font-sans text-base text-axon-schrift-leise">
                  {" "}
                  möchte auf dein Konto zugreifen.
                </span>
              </p>
              {details?.redirect_uri && (
                <p className="truncate font-mono text-xs text-axon-schrift-fein">
                  {new URL(details.redirect_uri).host}
                </p>
              )}
            </>
          )}
        </div>

        {laedt && kennung && (
          <p className="px-7 py-6 font-mono text-2xs tracking-etikett uppercase text-axon-schrift-still">
            Anfrage wird geprüft
          </p>
        )}

        {fehler && (
          <p role="alert" className="px-7 py-6 font-sans text-base text-axon-fehler">
            {fehler}
          </p>
        )}

        {details && (
          <ul className="flex flex-col gap-4 px-7 py-6">
            {scopes.length === 0 && (
              <li className="font-sans text-base text-axon-schrift-fein">
                Das Programm fragt keine besonderen Rechte an.
              </li>
            )}
            {scopes.map((scope) => {
              const text = SCOPE_TEXT[scope];
              return (
                <li key={scope} className="flex gap-[14px]">
                  <span
                    aria-hidden
                    className="mt-[7px] size-[5px] shrink-0 rounded-full bg-axon-aktion"
                  />
                  <div className="flex flex-col gap-1">
                    <span className="font-sans text-md text-axon-schrift">
                      {text?.titel ?? scope}
                    </span>
                    {text && (
                      <span className="font-sans text-base text-axon-schrift-fein">
                        {text.detail}
                      </span>
                    )}
                    <span className="font-mono text-2xs text-axon-schrift-zierde">{scope}</span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {details && (
          <div className="flex gap-3 border-t border-axon-linie-fein px-7 py-5">
            <button
              type="button"
              disabled={entscheidet}
              onClick={() => void entscheide(true)}
              className="h-(--h-knopf) flex-1 cursor-pointer bg-axon-aktion font-sans text-sm tracking-[0.14em] uppercase text-axon-aktion-schrift transition-colors duration-calm hover:bg-axon-aktion-hover disabled:cursor-wait disabled:opacity-60"
            >
              Erlauben
            </button>
            <button
              type="button"
              disabled={entscheidet}
              onClick={() => void entscheide(false)}
              className="h-(--h-knopf) flex-1 cursor-pointer border border-axon-linie font-sans text-sm tracking-[0.14em] uppercase text-axon-schrift-leise transition-colors duration-calm hover:border-axon-fehler-kraeftig hover:text-axon-schrift disabled:cursor-wait disabled:opacity-60"
            >
              Ablehnen
            </button>
          </div>
        )}

        <p className="border-t border-axon-linie-fein px-7 py-4 font-sans text-sm text-axon-schrift-fein">
          Du bist als {profil?.email ?? "…"} angemeldet. Die Freigabe lässt sich später
          zurücknehmen.
        </p>
      </div>
    </Flaeche>
  );
}
