import logo from "@/assets/neoception-weiss.png";
import { cn } from "@/lib/utils";

/**
 * Die Wortmarke: "AXON" kraeftig, "Studio" leicht.
 *
 * Zwei Groessen, beide aus der Vorlage. Die Laufweite haengt an der Groesse und nicht an
 * einem festen Wert: bei 38px zieht "AXON" auf -0.015em zusammen, bei 22px nur noch auf
 * -0.005em. Ein Wert fuer beide waere bei einer der beiden falsch.
 */

interface Props {
  /** `gross` fuer die Anmeldung (38px), `klein` fuer die Kopfzeile (22px). */
  readonly groesse?: "gross" | "klein";
  /** Das Neoception-Logo daneben. Auf der Anmeldung steht es oben links fuer sich. */
  readonly mitLogo?: boolean;
  readonly className?: string;
}

export function Marke({ groesse = "klein", mitLogo = false, className }: Props) {
  const gross = groesse === "gross";
  return (
    <div className={cn("flex items-center gap-[13px]", className)}>
      {mitLogo && (
        <img
          src={logo}
          alt="Neoception, Pepperl+Fuchs"
          className="block h-auto w-(--w-kopflogo) opacity-92"
        />
      )}
      <div className="flex items-baseline gap-2">
        <span
          className={cn(
            "font-display text-axon-schrift",
            gross
              ? "text-4xl font-normal tracking-marke"
              : "text-2xl font-normal tracking-[-0.005em]",
          )}
        >
          AXON
        </span>
        <span
          className={cn(
            "font-display font-extralight text-axon-schrift-leise",
            gross ? "text-4xl tracking-marke-leicht" : "text-2xl tracking-[0.02em]",
          )}
        >
          Studio
        </span>
      </div>
    </div>
  );
}
