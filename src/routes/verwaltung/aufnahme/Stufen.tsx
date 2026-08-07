/** Die Stufenleiste des Assistenten, Bildschirme 11 bis 15 der Vorlage. */

export const STUFEN = ["Programm", "Adresse", "Zugriff", "Schlüssel", "Abnahme"] as const;

interface Props {
  /** 1 bis 5. */
  readonly aktuell: number;
  /** Bis wohin man springen darf. Weiter als bis zur nächsten offenen Stufe geht es nicht. */
  readonly erreicht: number;
  readonly springe: (stufe: number) => void;
}

export function Stufen({ aktuell, erreicht, springe }: Props) {
  return (
    <nav
      aria-label="Fortschritt"
      className="flex items-center font-mono text-2xs tracking-[0.16em] uppercase"
    >
      {STUFEN.map((name, i) => {
        const nummer = i + 1;
        const erledigt = nummer < erreicht;
        const hier = nummer === aktuell;
        return (
          <span key={name} className="flex items-center">
            {i > 0 && <span aria-hidden className="h-px w-[22px] bg-axon-linie-fein" />}
            <button
              type="button"
              // Zurueckspringen ja, vorspringen nein: Schritt 4 legt echte Clients an, und
              // das darf nicht passieren, bevor Adresse und Zugriff stehen.
              disabled={nummer > erreicht}
              onClick={() => springe(nummer)}
              aria-current={hier ? "step" : undefined}
              className={
                "cursor-pointer border px-[14px] py-[9px] transition-colors duration-quick " +
                (hier
                  ? "border-axon-wahl-rand bg-axon-wahl-flaeche text-axon-schrift"
                  : "border-axon-linie text-axon-schrift-leise hover:text-axon-schrift") +
                " disabled:cursor-not-allowed disabled:opacity-45"
              }
            >
              {erledigt ? `${String(nummer)} ✓` : `${String(nummer)} ${name}`}
            </button>
          </span>
        );
      })}
    </nav>
  );
}
