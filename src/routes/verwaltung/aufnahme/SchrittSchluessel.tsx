import type { Dispatch, SetStateAction } from "react";
import { useState } from "react";

import { Aktion, Etikett, Glasflaeche, Nebenaktion } from "@/components/Bausteine";
import type { Programmclient, Umgebung } from "@/lib/typen";
import {
  aendereRueckweg,
  erneuereGeheimnis,
  legeClientAn,
  loescheClient,
} from "@/lib/verwaltung";
import type { Entwurf, UmgebungsEntwurf } from "./AufnahmeRoute";

/**
 * Bildschirm 14: die Schlüssel.
 *
 * Hier entstehen die echten OAuth-Clients, einer je Umgebung. Deshalb steht der Schritt
 * hinter dem Speichern der ersten drei: gäbe es die Programmzeile noch nicht, hingen die
 * Clients an nichts.
 *
 * **Das Geheimnis steht nur hier.** Der Aussteller gibt es genau einmal heraus, es wird
 * nirgends gespeichert, und nach dem Verlassen dieses Schritts ist es weg. Wer es verliert,
 * erneuert es; das ist der vorgesehene Weg, kein Notausgang.
 */

const AUSSTELLER = `${import.meta.env["VITE_SUPABASE_URL"] ?? ""}/auth/v1`;

interface Props {
  readonly entwurf: Entwurf;
  readonly umgebungen: readonly UmgebungsEntwurf[];
  readonly vorhandene: readonly Programmclient[];
  readonly setzeVorhandene: Dispatch<SetStateAction<readonly Programmclient[]>>;
  readonly weiter: () => void;
}

interface Frisch {
  readonly umgebung: Umgebung;
  readonly client_id: string;
  readonly client_secret: string;
}

export function SchrittSchluessel({
  entwurf,
  umgebungen,
  vorhandene,
  setzeVorhandene,
  weiter,
}: Props) {
  const [frisch, setzeFrisch] = useState<Frisch[]>([]);
  const [laeuft, setzeLaeuft] = useState(false);
  const [fehler, setzeFehler] = useState<string | null>(null);

  const fehlend = umgebungen.filter((u) => !vorhandene.some((c) => c.umgebung === u.umgebung));
  const geaendert = vorhandene.filter((c) => {
    const soll = umgebungen.find((u) => u.umgebung === c.umgebung);
    return soll && soll.redirect_uri !== c.redirect_uri;
  });
  // In Schritt 2 entfernte Umgebungen: die Zeile ist weg, der Client beim Aussteller nicht.
  const ueberzaehlig = vorhandene.filter(
    (c) => !umgebungen.some((u) => u.umgebung === c.umgebung),
  );
  const zuTun = fehlend.length + geaendert.length + ueberzaehlig.length;

  async function anlegen() {
    setzeLaeuft(true);
    setzeFehler(null);
    try {
      for (const c of ueberzaehlig) {
        await loescheClient(c.oauth_client_id);
        setzeVorhandene((v) => v.filter((x) => x.oauth_client_id !== c.oauth_client_id));
      }
      for (const c of geaendert) {
        const soll = umgebungen.find((u) => u.umgebung === c.umgebung);
        if (!soll) continue;
        await aendereRueckweg(c.oauth_client_id, soll.redirect_uri);
        setzeVorhandene((v) =>
          v.map((x) =>
            x.oauth_client_id === c.oauth_client_id
              ? { ...x, redirect_uri: soll.redirect_uri }
              : x,
          ),
        );
      }
      for (const u of fehlend) {
        const neu = await legeClientAn(entwurf.id, entwurf.name, u.umgebung, u.redirect_uri);
        setzeFrisch((f) => [
          ...f,
          { umgebung: u.umgebung, client_id: neu.client_id, client_secret: neu.client_secret },
        ]);
        setzeVorhandene((v) => [
          ...v,
          {
            id: neu.client_id,
            app_id: entwurf.id,
            umgebung: u.umgebung,
            oauth_client_id: neu.client_id,
            redirect_uri: u.redirect_uri,
            created_at: new Date().toISOString(),
          },
        ]);
      }
    } catch (ursache) {
      setzeFehler(ursache instanceof Error ? ursache.message : "Unbekannter Fehler.");
    }
    setzeLaeuft(false);
  }

  async function erneuern(client: Programmclient) {
    setzeFehler(null);
    try {
      const neu = await erneuereGeheimnis(client.oauth_client_id);
      setzeFrisch((f) => [
        ...f.filter((x) => x.umgebung !== client.umgebung),
        {
          umgebung: client.umgebung,
          client_id: neu.client_id,
          client_secret: neu.client_secret,
        },
      ]);
    } catch (ursache) {
      setzeFehler(ursache instanceof Error ? ursache.message : "Unbekannter Fehler.");
    }
  }

  return (
    <div className="flex flex-col gap-7">
      {fehler && (
        <p role="alert" className="font-sans text-base text-axon-fehler">
          {fehler}
        </p>
      )}

      {zuTun > 0 && (
        <Glasflaeche titel="Anzulegen" className="p-[26px]">
          <div className="flex flex-col gap-5">
            <ul className="flex flex-col gap-2 font-mono text-xs text-axon-schrift-leise">
              {fehlend.map((u) => (
                <li key={u.umgebung}>Neuer Client für {u.umgebung}</li>
              ))}
              {geaendert.map((c) => (
                <li key={c.oauth_client_id}>Rückweg von {c.umgebung} ändern</li>
              ))}
              {ueberzaehlig.map((c) => (
                <li key={c.oauth_client_id} className="text-axon-fehler">
                  Client für {c.umgebung} löschen
                </li>
              ))}
            </ul>
            <div className="flex">
              <Aktion disabled={laeuft} onClick={() => void anlegen()}>
                {laeuft ? "Läuft" : "Ausführen"}
              </Aktion>
            </div>
          </div>
        </Glasflaeche>
      )}

      {vorhandene.map((c) => {
        const geheim = frisch.find((f) => f.umgebung === c.umgebung);
        return (
          <Glasflaeche
            key={c.oauth_client_id}
            titel={c.umgebung}
            kopfrechts={
              <Nebenaktion onClick={() => void erneuern(c)}>Geheimnis erneuern</Nebenaktion>
            }
            className="p-[26px]"
          >
            <div className="flex flex-col gap-5">
              <Feld beschriftung="Client-Kennung" wert={c.oauth_client_id} />
              {geheim ? (
                <>
                  <Feld beschriftung="Client-Geheimnis" wert={geheim.client_secret} warnend />
                  <p className="font-sans text-base text-warning-text">
                    Dieses Geheimnis wird nie wieder angezeigt. Jetzt kopieren und ablegen.
                  </p>
                  <div className="flex flex-col gap-[9px]">
                    <Etikett>Für die Umgebungsdatei</Etikett>
                    <Kasten text={envBlock(geheim.client_id, geheim.client_secret, c.redirect_uri)} />
                  </div>
                </>
              ) : (
                <p className="font-sans text-base text-axon-schrift-fein">
                  Das Geheimnis stand einmal hier und ist nirgends gespeichert. Wer es nicht
                  mehr hat, erneuert es.
                </p>
              )}
            </div>
          </Glasflaeche>
        );
      })}

      <div className="flex">
        <Aktion disabled={vorhandene.length === 0 || zuTun > 0} onClick={weiter}>
          Weiter zur Abnahme <span aria-hidden>→</span>
        </Aktion>
      </div>
    </div>
  );
}

function Feld({
  beschriftung,
  wert,
  warnend = false,
}: {
  readonly beschriftung: string;
  readonly wert: string;
  readonly warnend?: boolean;
}) {
  return (
    <div className="flex flex-col gap-[9px]">
      <Etikett>{beschriftung}</Etikett>
      <div className="flex items-center gap-3">
        <code
          className={
            "min-w-0 flex-1 truncate border-b border-axon-feld-rand pb-[6px] font-mono text-md " +
            (warnend ? "text-warning-text" : "text-axon-schrift")
          }
        >
          {wert}
        </code>
        <Kopieren text={wert} />
      </div>
    </div>
  );
}

function Kasten({ text }: { readonly text: string }) {
  return (
    <div className="flex items-start gap-3 border border-axon-linie-fein bg-axon-flaeche p-4">
      <pre className="min-w-0 flex-1 overflow-x-auto font-mono text-xs leading-relaxed text-axon-schrift-leise">
        {text}
      </pre>
      <Kopieren text={text} />
    </div>
  );
}

function Kopieren({ text }: { readonly text: string }) {
  const [kopiert, setzeKopiert] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard.writeText(text);
        setzeKopiert(true);
        setTimeout(() => setzeKopiert(false), 1600);
      }}
      className="shrink-0 cursor-pointer border border-axon-linie px-3 py-[6px] font-mono text-2xs tracking-fein uppercase text-axon-schrift-leise transition-colors duration-quick hover:border-axon-fokus hover:text-axon-schrift"
    >
      {kopiert ? "Kopiert" : "Kopieren"}
    </button>
  );
}

/** Genau die Namen, die der AXON Editor liest. Ein Block zum Einfügen, kein Vorbild zum Abtippen. */
function envBlock(clientId: string, geheimnis: string, rueckweg: string): string {
  return [
    `AUTH_MODE=oidc`,
    `OIDC_ISSUER=${AUSSTELLER}`,
    `OIDC_CLIENT_ID=${clientId}`,
    `OIDC_CLIENT_SECRET=${geheimnis}`,
    `OIDC_REDIRECT_URI=${rueckweg}`,
  ].join("\n");
}
