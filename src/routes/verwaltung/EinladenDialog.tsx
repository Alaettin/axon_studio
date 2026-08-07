import { useState, type FormEvent } from "react";

import { Aktion, Etikett, Nebenaktion, Unterlinienfeld } from "@/components/Bausteine";
import { Modal } from "@/components/Modal";
import type { Rolle } from "@/lib/typen";
import { ladeEinladung } from "@/lib/verwaltung";
import { useSitzung } from "@/store/sitzung";

/**
 * Bildschirm 09 der Vorlage: einen Zugang anlegen.
 *
 * **Es wird keine Mail verschickt.** Der Dialog legt den Nutzer an und zeigt den
 * Einladungslink; weitergeschickt wird er von Hand (Entscheidung 07.08.2026). Der
 * eingebaute Versand von Supabase ist nicht fuer den Betrieb gedacht, und ein eigener
 * SMTP-Dienst braucht Absender und DNS-Eintraege, die es beide noch nicht gibt.
 *
 * Der Link ist damit das Ergebnis dieses Dialogs, nicht eine Randnotiz: er ist der einzige
 * Weg herein. Deshalb steht er vollstaendig da, auswaehlbar, mit einer Schaltflaeche zum
 * Kopieren, und der Hinweis, dass keine Mail unterwegs ist, steht vor dem Link und nicht
 * darunter.
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
  const [fertig, setzeFertig] = useState<{ email: string; link: string } | null>(null);
  const [kopiert, setzeKopiert] = useState(false);

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
      const { email: adresse, link } = await ladeEinladung(email, rolle, gewaehlt);
      setzeFertig({ email: adresse, link });
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
            Der Zugang für <span className="font-mono text-md">{fertig.email}</span> ist
            angelegt.
          </p>
          {/*
            Es wird bewusst keine Mail verschickt. Der Link steht deshalb hier, und zwar
            vollstaendig und auswaehlbar: er ist der einzige Weg herein, und wer ihn
            verliert, muss die Einladung neu erzeugen.
          */}
          <p className="font-sans text-base text-axon-schrift-fein">
            Es wurde <strong className="text-axon-schrift">keine Mail verschickt</strong>.
            Schick diesen Link selbst weiter. Er gilt einmalig und führt zum Setzen des
            Passworts.
          </p>

          <label className="flex flex-col gap-[9px]">
            <Etikett>Einladungslink</Etikett>
            <textarea
              readOnly
              rows={3}
              value={fertig.link}
              onFocus={(e) => e.currentTarget.select()}
              className="resize-none border border-axon-linie bg-axon-flaeche p-3 font-mono text-xs break-all text-axon-schrift outline-none focus:border-axon-fokus"
            />
          </label>

          <div className="flex items-center gap-3">
            <Aktion
              onClick={() => {
                void navigator.clipboard.writeText(fertig.link).then(() => {
                  setzeKopiert(true);
                });
              }}
            >
              {kopiert ? "Kopiert" : "Link kopieren"}
            </Aktion>
            <Nebenaktion onClick={schliesse}>Fertig</Nebenaktion>
          </div>

          <p className="font-sans text-sm text-axon-schrift-fein">
            Bis der Link benutzt wird, steht der Zugang in der Liste mit „Nie" als letzter
            Anmeldung.
          </p>
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
              {laeuft ? "Wird angelegt" : "Zugang anlegen"}
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
