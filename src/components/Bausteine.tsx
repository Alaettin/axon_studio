import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Die wiederkehrenden Formen der Vorlage: Brotkrume, Seitentitel, Glasflaeche mit
 * Kopfetikett, Etikett, Unterlinienfeld.
 *
 * Sie stehen hier und nicht in jedem Bildschirm noch einmal, weil sie sich sonst
 * auseinanderentwickeln. Alle Werte kommen aus den Tokens.
 */

export function Brotkrume({ children }: { readonly children: ReactNode }) {
  return (
    <div className="flex items-center gap-[9px] font-mono text-2xs tracking-brotkrume uppercase text-axon-schrift-fein">
      {children}
    </div>
  );
}

/** 34px, Gewicht 200, zusammengezogen. Raleway, weil IBM Plex Sans kein 200 hat. */
export function Seitentitel({ children }: { readonly children: ReactNode }) {
  return (
    <h1 className="font-display text-3xl font-extralight tracking-titel text-axon-schrift">
      {children}
    </h1>
  );
}

/** Das 9px-Mono-Etikett ueber einer Gruppe. */
export function Etikett({
  children,
  className,
}: {
  readonly children: ReactNode;
  readonly className?: string;
}) {
  return (
    <span
      className={cn(
        "font-mono text-etikett tracking-etikett uppercase text-axon-schrift-still",
        className,
      )}
    >
      {children}
    </span>
  );
}

/**
 * Eine grosse Glasflaeche mit Kopfetikett. Grosse Flaechen lesen dicker als kleine, deshalb
 * die staerkere Streuung (apple-design).
 */
export function Glasflaeche({
  titel,
  kopfrechts,
  children,
  className,
}: {
  readonly titel?: string;
  readonly kopfrechts?: ReactNode;
  readonly children: ReactNode;
  readonly className?: string;
}) {
  return (
    <section
      data-glas
      className={cn(
        "flex min-h-0 flex-col border border-axon-flaeche-rand bg-axon-flaeche backdrop-blur-flaeche",
        className,
      )}
    >
      {titel && (
        <header className="flex items-center gap-3 border-b border-axon-linie-fein px-[22px] py-[17px]">
          <Etikett>{titel}</Etikett>
          {kopfrechts && <div className="ml-auto flex items-center gap-2">{kopfrechts}</div>}
        </header>
      )}
      {children}
    </section>
  );
}

/**
 * Ein Feld ohne Kasten, nur mit Unterlinie. Beim Fokus wechselt sie auf Cyan; der globale
 * Fokusring waere hier ein Rahmen um etwas, das keiner ist.
 */
export function Unterlinienfeld({
  beschriftung,
  wert,
  setze,
  hinweis,
  gesperrt = false,
  typ = "text",
  platzhalter,
  autoComplete,
  className,
}: {
  readonly beschriftung: string;
  readonly wert: string;
  readonly setze?: (wert: string) => void;
  readonly hinweis?: string;
  readonly gesperrt?: boolean;
  readonly typ?: "text" | "email";
  readonly platzhalter?: string;
  readonly autoComplete?: string;
  readonly className?: string;
}) {
  return (
    <label className={cn("flex flex-col gap-[9px]", className)}>
      <Etikett>{beschriftung}</Etikett>
      <input
        type={typ}
        value={wert}
        readOnly={gesperrt}
        disabled={gesperrt}
        placeholder={platzhalter}
        autoComplete={autoComplete}
        onChange={setze ? (e) => setze(e.target.value) : undefined}
        className="h-8 border-0 border-b border-axon-feld-rand bg-transparent p-0 font-sans text-lg text-axon-schrift transition-colors duration-feld outline-none placeholder:text-axon-platzhalter focus:border-axon-fokus disabled:text-axon-schrift-still"
      />
      {hinweis && <span className="font-sans text-sm text-axon-schrift-leise">{hinweis}</span>}
    </label>
  );
}

/** Gefuellter Knopf in der einen Aktionsfarbe. */
export function Aktion({
  children,
  onClick,
  disabled,
  typ = "button",
}: {
  readonly children: ReactNode;
  readonly onClick?: () => void;
  readonly disabled?: boolean;
  readonly typ?: "button" | "submit";
}) {
  return (
    <button
      type={typ === "submit" ? "submit" : "button"}
      onClick={onClick}
      disabled={disabled}
      className="flex h-(--h-knopf) cursor-pointer items-center gap-[10px] bg-axon-aktion px-5 font-sans text-sm tracking-[0.14em] uppercase text-axon-aktion-schrift transition-colors duration-calm hover:bg-axon-aktion-hover disabled:cursor-not-allowed disabled:opacity-45"
    >
      {children}
    </button>
  );
}

/** Knopf im Umriss, fuer alles, was nicht die Hauptaktion ist. */
export function Nebenaktion({
  children,
  onClick,
  disabled,
}: {
  readonly children: ReactNode;
  readonly onClick?: () => void;
  readonly disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex h-(--h-knopf) cursor-pointer items-center gap-[10px] border border-axon-linie px-5 font-sans text-sm tracking-[0.14em] uppercase text-axon-schrift-leise transition-colors duration-calm hover:border-axon-fokus hover:text-axon-schrift disabled:cursor-not-allowed disabled:opacity-45"
    >
      {children}
    </button>
  );
}
