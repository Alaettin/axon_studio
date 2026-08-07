import logo from "@/assets/neoception-weiss.png";
import { cn } from "@/lib/utils";

/**
 * Die Wortmarke: "AXON" kraeftig, "Studio" leicht.
 *
 * Zwei Groessen. Die Laufweite haengt an der Groesse und nicht an einem festen Wert: bei
 * 38px zieht "AXON" auf -0.015em zusammen, bei 33px auf -0.012em. Ein Wert fuer beide waere
 * bei einer der beiden falsch.
 *
 * Die kleine Groesse stand bis zum 07.08.2026 auf 22px und trug die Seite nicht: der Kopf
 * ist der eine Ort, an dem die Marke steht, und er war der leiseste. Jetzt 33px, Logo und
 * Abstaende um dieselbe Haelfte mitgewachsen.
 */

interface Props {
  /** `gross` fuer die Anmeldung (38px), `klein` fuer die Kopfzeile (33px). */
  readonly groesse?: "gross" | "klein";
  /** Das Neoception-Logo daneben. Auf der Anmeldung steht es oben links fuer sich. */
  readonly mitLogo?: boolean;
  readonly className?: string;
}

export function Marke({ groesse = "klein", mitLogo = false, className }: Props) {
  const gross = groesse === "gross";
  return (
    <div className={cn("flex items-center gap-(--gap-kopfmarke)", className)}>
      {mitLogo && (
        <img
          src={logo}
          alt="Neoception, Pepperl+Fuchs"
          className="block h-auto w-(--w-kopflogo) opacity-92"
        />
      )}
      <div className="flex items-baseline gap-3">
        <span
          className={cn(
            "font-display font-normal text-axon-schrift",
            gross ? "text-4xl tracking-marke" : "text-marke tracking-marke-kopf",
          )}
        >
          AXON
        </span>
        <span
          className={cn(
            "font-display font-extralight text-axon-schrift-leise",
            gross ? "text-4xl tracking-marke-leicht" : "text-marke tracking-marke-kopf-leicht",
          )}
        >
          Studio
        </span>
      </div>
    </div>
  );
}
