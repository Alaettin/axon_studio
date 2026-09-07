import { useState, type FormEvent } from "react";

import { Aktion, Etikett, Nebenaktion, Unterlinienfeld } from "@/components/Bausteine";
import { Modal } from "@/components/Modal";
import type { Rolle } from "@/lib/typen";
import { legeZugangAn } from "@/lib/verwaltung";
import { useSitzung } from "@/store/sitzung";

/**
 * Bildschirm 09 der Vorlage: einen Zugang anlegen.
 *
 * **Es wird keine Mail verschickt.** Der Dialog legt den Zugang an und zeigt das
 * Startpasswort; weitergegeben wird es von Hand (Entscheidung 07.09.2026). Der eingebaute
 * Versand von Supabase ist nicht fuer den Betrieb gedacht, und ein eigener SMTP-Dienst
 * braucht Absender und DNS-Eintraege, die es beide noch nicht gibt.
 *
 * Das Startpasswort ist damit das Ergebnis dieses Dialogs, nicht eine Randnotiz: es steht
 * nirgends sonst und ist der einzige Weg herein. Deshalb steht es vollstaendig da,
 * auswaehlbar, mit einer Schaltflaeche zum Kopieren, und der Hinweis, dass es genau einmal
 * zu sehen ist, steht davor und nicht darunter. Wechseln muss der Neue es ohnehin, bevor
 * er den Hub benutzen kann.
 */

interface Props {
  readonly schliesse: () => void;
  readonly neuLaden: () => Promise<void>;
}

export function ZugangAnlegenDialog({ schliesse, neuLaden }: Props) {
  const katalog = useSitzung((z) => z.katalog);

  const [email, setzeEmail] = useState("");
  const [rolle, setzeRolle] = useState<Rolle>("user");
  const [gewaehlt, setzeGewaehlt] = useState<readonly string[]>([]);
  const [laeuft, setzeLaeuft] = useState(false);
  const [fehler, setzeFehler] = useState<string | null>(null);
  const [fertig, setzeFertig] = useState<{ email: string; startpasswort: string } | null>(null);
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
      const { email: adresse, startpasswort } = await legeZugangAn(email, rolle, gewaehlt);
      setzeFertig({ email: adresse, startpasswort });
      await neuLaden();
    } catch (ursache) {
      setzeFehler(ursache instanceof Error ? ursache.message : "Unbekannter Fehler.");
    }
    setzeLaeuft(false);
  };

  return (
    <Modal titel="Zugang anlegen" breite="520px" schliesse={schliesse}>
      <header className="flex flex-col gap-2 border-b border-axon-linie px-[26px] pt-6 pb-5">
        <Etikett>Zugang nur über die Verwaltung</Etikett>
        <h2 className="font-display text-2xl font-light text-axon-schrift">Zugang anlegen</h2>
      </header>

      {fertig ? (
        <div className="flex flex-col gap-5 px-[26px] py-7">
          <p className="font-sans text-lg text-axon-schrift">
            Der Zugang für <span className="font-mono text-md">{fertig.email}</span> ist
            angelegt.
          </p>
          {/*
            Es wird bewusst keine Mail verschickt. Das Passwort steht deshalb hier, und zwar
            vollstaendig und auswaehlbar: es ist der einzige Weg herein, und wer diesen
            Dialog schliesst, sieht es nicht wieder.
          */}
          <p className="font-sans text-base text-axon-schrift-fein">
            Es wurde <strong className="text-axon-schrift">keine Mail verschickt</strong>.
            Gib E-Mail und Startpasswort selbst weiter. Das Passwort steht{" "}
            <strong className="text-axon-schrift">nur hier</strong> und ist nach dem
            Schließen weg.
          </p>

          <label className="flex flex-col gap-[9px]">
            <Etikett>Startpasswort</Etikett>
            <input
              readOnly
              value={fertig.startpasswort}
              onFocus={(e) => e.currentTarget.select()}
              className="border border-axon-linie bg-axon-flaeche p-3 font-mono text-md tracking-fein break-all text-axon-schrift outline-none focus:border-axon-fokus"
            />
          </label>

          <div className="flex items-center gap-3">
            <Aktion
              onClick={() => {
                void navigator.clipboard.writeText(fertig.startpasswort).then(() => {
                  setzeKopiert(true);
                });
              }}
            >
              {kopiert ? "Kopiert" : "Passwort kopieren"}
            </Aktion>
            <Nebenaktion onClick={schliesse}>Fertig</Nebenaktion>
          </div>

          <p className="font-sans text-sm text-axon-schrift-fein">
            Bei der ersten Anmeldung muss der Neue ein eigenes Passwort vergeben. Bis dahin
            steht der Zugang in der Liste mit „Nie" als letzter Anmeldung.
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
              Was hier nicht gewählt ist, sieht der Neue als „Zugang anfragen".
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
