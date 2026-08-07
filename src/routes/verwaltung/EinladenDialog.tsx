import { useState, type FormEvent } from "react";

import { Aktion, Etikett, Nebenaktion, Unterlinienfeld } from "@/components/Bausteine";
import { Modal } from "@/components/Modal";
import type { Rolle } from "@/lib/typen";
import { ladeEinladung } from "@/lib/verwaltung";
import { useSitzung } from "@/store/sitzung";

/**
 * Bildschirm 09 der Vorlage: eine Einladung verschicken.
 *
 * Zugang gibt es nur auf Einladung, es gibt keine Selbstregistrierung. Damit ist der
 * Mailversand hier kein Beiwerk, sondern der einzige Weg herein. Solange der eingebaute
 * Versand von Supabase benutzt wird, steht das unter dem Formular, und zwar so, dass man
 * es liest.
 */

interface Props {
  readonly schliesse: () => void;
  readonly neuLaden: () => Promise<void>;
}

export function EinladenDialog({ schliesse, neuLaden }: Props) {
  const katalog = useSitzung((z) => z.katalog);

  const [email, setzeEmail] = useState("");
  const [rolle, setzeRolle] = useState<Rolle>("user");
  const [gewaehlt, setzeGewaehlt] = useState<readonly string[]>([]);
  const [laeuft, setzeLaeuft] = useState(false);
  const [fehler, setzeFehler] = useState<string | null>(null);
  const [fertig, setzeFertig] = useState<string | null>(null);

  const umschalten = (id: string) => {
    setzeGewaehlt((bisher) =>
      bisher.includes(id) ? bisher.filter((x) => x !== id) : [...bisher, id],
    );
  };

  const senden = async (ereignis: FormEvent) => {
    ereignis.preventDefault();
    setzeLaeuft(true);
    setzeFehler(null);
    try {
      const { email: adresse } = await ladeEinladung(email, rolle, gewaehlt);
      setzeFertig(adresse);
      await neuLaden();
    } catch (ursache) {
      setzeFehler(ursache instanceof Error ? ursache.message : "Unbekannter Fehler.");
    }
    setzeLaeuft(false);
  };

  return (
    <Modal titel="Nutzer einladen" breite="520px" schliesse={schliesse}>
      <header className="flex flex-col gap-2 border-b border-axon-linie px-[26px] pt-6 pb-5">
        <Etikett>Zugang nur auf Einladung</Etikett>
        <h2 className="font-display text-2xl font-light text-axon-schrift">Nutzer einladen</h2>
      </header>

      {fertig ? (
        <div className="flex flex-col gap-5 px-[26px] py-7">
          <p className="font-sans text-lg text-axon-schrift">
            Die Einladung an <span className="font-mono text-md">{fertig}</span> ist unterwegs.
          </p>
          <p className="font-sans text-base text-axon-schrift-fein">
            Sie enthält einen Link, über den sich ein Passwort setzen lässt. Bis dahin steht
            der Zugang in der Liste, ohne dass sich jemand angemeldet hätte.
          </p>
          <div className="flex justify-end">
            <Aktion onClick={schliesse}>Fertig</Aktion>
          </div>
        </div>
      ) : (
        <form onSubmit={(e) => void senden(e)} className="flex flex-col gap-6 px-[26px] py-6">
          <Unterlinienfeld
            beschriftung="E-Mail"
            typ="email"
            wert={email}
            setze={setzeEmail}
            platzhalter="name@unternehmen.de"
            autoComplete="off"
          />

          <div className="flex flex-col gap-3">
            <Etikett>Rolle</Etikett>
            <div className="flex">
              {(["user", "admin"] as const).map((wert) => (
                <button
                  key={wert}
                  type="button"
                  aria-pressed={rolle === wert}
                  onClick={() => setzeRolle(wert)}
                  className="cursor-pointer border border-axon-linie px-[14px] py-[9px] font-mono text-2xs tracking-[0.16em] uppercase text-axon-schrift-leise transition-colors duration-quick not-first:border-l-0 hover:text-axon-schrift aria-pressed:border-axon-wahl-rand aria-pressed:bg-axon-wahl-flaeche aria-pressed:text-axon-schrift"
                >
                  {wert === "admin" ? "Administrator" : "Nutzer"}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <Etikett>Sofort freischalten</Etikett>
            <div className="flex flex-wrap gap-2">
              {katalog.map((programm) => {
                const an = gewaehlt.includes(programm.id);
                return (
                  <button
                    key={programm.id}
                    type="button"
                    aria-pressed={an}
                    onClick={() => umschalten(programm.id)}
                    className="flex cursor-pointer items-center gap-2 border border-axon-linie px-3 py-2 font-sans text-sm text-axon-schrift-leise transition-colors duration-quick hover:text-axon-schrift aria-pressed:border-axon-wahl-rand aria-pressed:bg-axon-wahl-flaeche aria-pressed:text-axon-schrift"
                  >
                    <span
                      aria-hidden
                      style={{ backgroundColor: programm.akzent }}
                      className="size-[6px] rounded-full"
                    />
                    {programm.name}
                  </button>
                );
              })}
            </div>
            <p className="font-sans text-sm text-axon-schrift-fein">
              Was hier nicht gewählt ist, sieht der Eingeladene als „Zugang anfragen".
            </p>
          </div>

          <p aria-live="polite" className="min-h-4 font-sans text-sm text-axon-fehler">
            {fehler ?? ""}
          </p>

          <div className="flex items-center gap-3">
            <Aktion typ="submit" disabled={laeuft || !email.includes("@")}>
              {laeuft ? "Wird versendet" : "Einladung senden"}
            </Aktion>
            <Nebenaktion onClick={schliesse} disabled={laeuft}>
              Abbrechen
            </Nebenaktion>
          </div>
        </form>
      )}
    </Modal>
  );
}
