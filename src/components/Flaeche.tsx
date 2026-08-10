import type { ReactNode } from "react";

import { AxonKeyvisual } from "@/components/Keyvisual/AxonKeyvisual";
import { cn } from "@/lib/utils";

/**
 * Die Buehne, auf der jeder Bildschirm steht.
 *
 * Anders als im AAS Editor, wo das Keyvisual der Anmeldung vorbehalten blieb: die Vorlage
 * zeigt es auf allen fuenfzehn Bildschirmen. Es ist hier kein Auftritt beim Anmelden,
 * sondern der Grund, auf dem der Hub steht.
 *
 * Ueber dem Canvas liegt ein Schleier. Seine Staerke ist die Aussage darueber, wie sehr
 * der Inhalt im Vordergrund steht, und sie ist je Bildschirm eine andere. Die Werte
 * stammen aus der Vorlage:
 *
 * | Schleier   | Wofuer                           | Vorlage        |
 * |------------|----------------------------------|----------------|
 * | `buehne`   | Anmeldung, das Bild traegt       | 01             |
 * | `sammlung` | Kachelwand, Tabellen, Formulare  | 02, 06, 07, 11-15 |
 * | `mitte`    | Zustimmung, eine Karte in Ruhe   | 04             |
 * | `dicht`    | Palette und Dialoge darueber     | 03, 05, 08     |
 *
 * Die Vorlage zeigt 06 (Profil) mit offener Palette, also im gedaempften Zustand. Das ist
 * kein eigener Grundton der Seite: in Ruhe traegt sie `sammlung` wie jede andere Vollseite.
 */

export type Schleier = "buehne" | "sammlung" | "mitte" | "dicht";

const SCHLEIER: Record<Schleier, string> = {
  buehne: "bg-(image:--axon-schleier-buehne)",
  sammlung: "bg-(image:--axon-schleier-sammlung)",
  mitte: "bg-(image:--axon-schleier-mitte)",
  dicht: "bg-axon-schleier-dicht",
};

interface Props {
  readonly schleier?: Schleier;
  readonly children: ReactNode;
  readonly className?: string;
}

export function Flaeche({ schleier = "sammlung", children, className }: Props) {
  return (
    <div className="szene-axon relative min-h-dvh overflow-hidden bg-axon-grund">
      <AxonKeyvisual />
      <div aria-hidden className={cn("pointer-events-none absolute inset-0", SCHLEIER[schleier])} />
      <div className={cn("relative z-10 flex min-h-dvh flex-col", className)}>{children}</div>
    </div>
  );
}
