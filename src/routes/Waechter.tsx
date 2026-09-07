import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router";

import { Flaeche } from "@/components/Flaeche";
import { istAdmin, useSitzung } from "@/store/sitzung";

/**
 * Die Waechter.
 *
 * Sie sind Bequemlichkeit, keine Sicherheit: was ein Nutzer wirklich sehen darf,
 * entscheidet RLS in der Datenbank. Ein Waechter, der sich umgehen laesst, gibt deshalb
 * nichts preis, er zeigt nur eine leere Seite.
 */

function Warten() {
  return (
    <Flaeche schleier="buehne" className="items-center justify-center">
      <p className="font-mono text-2xs tracking-etikett uppercase text-axon-schrift-still">
        Einen Moment
      </p>
    </Flaeche>
  );
}

export function BrauchtAnmeldung({ children }: { readonly children: ReactNode }) {
  const sitzung = useSitzung((z) => z.sitzung);
  const ort = useLocation();

  // `undefined` heisst: noch nicht geprueft. Ohne diese Unterscheidung blitzt bei jedem
  // Laden kurz die Anmeldung auf, obwohl der Nutzer angemeldet ist.
  if (sitzung === undefined) return <Warten />;
  if (sitzung === null) {
    const weiter = ort.pathname + ort.search;
    return <Navigate to={`/anmeldung?weiter=${encodeURIComponent(weiter)}`} replace />;
  }
  return <>{children}</>;
}

export function BrauchtAdmin({ children }: { readonly children: ReactNode }) {
  const profil = useSitzung((z) => z.profil);
  const laedt = useSitzung((z) => z.laedt);
  const admin = useSitzung(istAdmin);

  if (!profil && laedt) return <Warten />;
  if (!admin) return <Navigate to="/" replace />;
  return <>{children}</>;
}

/**
 * Wer noch sein Startpasswort traegt.
 *
 * Ein Zugang entsteht mit einem Startpasswort, das der Administrator weitergibt und das
 * damit zwei Leuten bekannt ist. Deshalb fuehrt bis zum Wechsel jeder Weg auf
 * `/passwort-setzen`. Die Sicherheit liegt nicht in diesem Waechter, sondern darin, dass
 * die Marke `passwortwechsel_faellig` nur mit dem neuen Passwort zusammen geloescht wird.
 */
export function BrauchtPasswortwechsel({ children }: { readonly children: ReactNode }) {
  const profil = useSitzung((z) => z.profil);
  const laedt = useSitzung((z) => z.laedt);
  const ort = useLocation();

  // Wie bei BrauchtAdmin: ohne das Warten blitzt die Buehne auf, bevor das Profil da ist.
  if (!profil && laedt) return <Warten />;
  if (profil?.passwortwechsel_faellig) {
    const weiter = ort.pathname + ort.search;
    return <Navigate to={`/passwort-setzen?weiter=${encodeURIComponent(weiter)}`} replace />;
  }
  return <>{children}</>;
}

/**
 * Gesperrte Nutzer.
 *
 * Supabase laesst sie anmelden, solange `banned_until` nicht steht; `profiles.status` ist
 * die Angabe, die die Verwaltung setzt. Deshalb hier eine eigene Schranke: sonst sieht ein
 * gerade gesperrter Nutzer bis zum Ablauf seines Tokens weiter die Buehne.
 */
export function NichtGesperrt({ children }: { readonly children: ReactNode }) {
  const profil = useSitzung((z) => z.profil);
  const abmelden = useSitzung((z) => z.abmelden);

  if (profil?.status === "gesperrt") {
    return (
      <Flaeche schleier="mitte" className="items-center justify-center gap-6 p-9">
        <p className="max-w-[42ch] text-center font-sans text-lg text-axon-schrift">
          Dieser Zugang ist gesperrt. Wende dich an eine Person mit Verwaltungsrechten.
        </p>
        <button
          type="button"
          onClick={() => void abmelden()}
          className="h-(--h-knopf) cursor-pointer border border-axon-linie px-5 font-sans text-sm tracking-[0.14em] uppercase text-axon-schrift-leise transition-colors duration-calm hover:border-axon-fokus hover:text-axon-schrift"
        >
          Abmelden
        </button>
      </Flaeche>
    );
  }
  return <>{children}</>;
}
