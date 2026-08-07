import { Dialog } from "radix-ui";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Ein Blatt ueber der Flaeche.
 *
 * **Deckend, nicht aus Glas.** Der Bildschirm darunter traegt bereits eine Glasflaeche
 * (die Tabelle), und die Materialregel des apple-design-Skills ist an dieser Stelle
 * eindeutig: nie helles Glas auf hellem Glas, die Lesbarkeit bricht. Farbe gehoert auf
 * eine deckende Schicht.
 *
 * Das Abdunkeln des Grundes uebernimmt der Bildschirm selbst ueber `Flaeche schleier="dicht"`,
 * damit nicht zwei Schleier uebereinanderliegen. Die Overlay-Ebene hier faengt nur den
 * Klick daneben.
 */

interface Props {
  readonly titel: string;
  readonly breite?: string;
  readonly schliesse: () => void;
  readonly children: ReactNode;
  readonly className?: string;
}

export function Modal({ titel, breite = "var(--w-dialog)", schliesse, children, className }: Props) {
  return (
    <Dialog.Root
      open
      onOpenChange={(offen) => {
        if (!offen) schliesse();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="szene-axon fixed inset-0 z-40 bg-transparent" />
        <Dialog.Content
          style={{ width: breite }}
          className={cn(
            "szene-axon fixed top-1/2 left-1/2 z-50 flex max-h-[calc(100dvh-5rem)] max-w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 flex-col border border-axon-leiste-rand bg-popover shadow-[var(--shadow-overlay)]",
            // Glas soll materialisieren: Streuung und Skalierung gemeinsam, nicht nur
            // Deckkraft. Hier ohne Streuung, also Skalierung plus Deckkraft.
            "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95",
            className,
          )}
        >
          <Dialog.Title className="sr-only">{titel}</Dialog.Title>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
