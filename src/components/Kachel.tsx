import type { Programm } from "@/lib/typen";

/**
 * Eine Kachel der Buehne.
 *
 * Der Akzentstrich oben traegt die Farbe des Programms. Er ist der einzige Ort, an dem ein
 * Farbwert aus den Daten kommt und nicht aus den Tokens: der Katalog ist gepflegt, und
 * `hub_apps.akzent` ist auf ein Hex-Muster eingeschraenkt.
 *
 * Beim Ueberfahren hebt sich die Kachel um 5px. Nur `transform` und `opacity`, damit der
 * Browser nicht neu setzt, und mit der Feder der Vorlage: kritisch gedaempft, kein
 * Ueberschwingen, weil die Geste selbst keinen Schwung trug (apple-design).
 */

export function Kachel({ programm }: { readonly programm: Programm }) {
  const ohneZiel = !programm.url;

  return (
    <a
      href={programm.url ?? undefined}
      aria-disabled={ohneZiel}
      title={ohneZiel ? "Für dieses Programm ist noch keine Adresse hinterlegt." : undefined}
      onClick={ohneZiel ? (e) => e.preventDefault() : undefined}
      data-glas
      className="group relative flex w-(--w-kachel) cursor-pointer flex-col gap-[14px] border border-axon-kachel-rand bg-axon-kachel-glas px-6 pt-[26px] pb-6 backdrop-blur-kachel transition-[transform,border-color,box-shadow] duration-calm ease-kachel will-change-transform hover:border-axon-kachel-rand-hover hover:shadow-[var(--shadow-card-hover)] motion-safe:hover:-translate-y-[5px] aria-disabled:cursor-not-allowed aria-disabled:opacity-70"
    >
      <span
        aria-hidden
        style={{ backgroundColor: programm.akzent }}
        className="absolute -inset-x-px -top-px h-0.5"
      />
      <span className="font-mono text-etikett tracking-etikett uppercase text-axon-schrift-fein">
        {programm.kuerzel}
      </span>
      <span className="font-display text-2xl font-light tracking-marke text-axon-schrift">
        {programm.name}
      </span>
      <span className="text-pretty font-sans text-base text-axon-schrift-fein">
        {programm.kurz}
      </span>
      <span className="mt-auto pt-[18px] font-mono text-2xs tracking-[0.16em] uppercase text-axon-schrift-leise">
        {ohneZiel ? "Adresse fehlt" : "Öffnen →"}
      </span>
    </a>
  );
}

/**
 * Die eine gestrichelte Kachel fuer alles, was nicht freigeschaltet ist. Bewusst eine
 * einzige statt einer je Programm: sonst zeigt die Buehne einem neuen Nutzer vor allem,
 * was er nicht darf.
 */
/**
 * Zahlen bis zwoelf werden im Deutschen ausgeschrieben, und die Vorlage macht es vor
 * ("Drei weitere Programme"). Darueber wird die Ziffer wieder besser lesbar.
 */
function ausgeschrieben(zahl: number): string {
  const woerter = [
    "Null", "Ein", "Zwei", "Drei", "Vier", "Fünf",
    "Sechs", "Sieben", "Acht", "Neun", "Zehn", "Elf", "Zwölf",
  ];
  return woerter[zahl] ?? String(zahl);
}

export function GesperrteKachel({ programme }: { readonly programme: readonly Programm[] }) {
  if (programme.length === 0) return null;

  return (
    <div className="flex w-(--w-kachel) flex-col gap-[10px] border border-dashed border-axon-gesperrt-rand px-6 pt-[26px] pb-6">
      <span className="font-mono text-etikett tracking-etikett uppercase text-axon-schrift-zierde">
        Gesperrt
      </span>
      <span className="font-display text-2xl font-light text-axon-schrift-leise">
        {programme.length === 1
          ? "Ein weiteres Programm"
          : `${ausgeschrieben(programme.length)} weitere Programme`}
      </span>
      <span className="font-sans text-base text-axon-schrift-fein">
        {programme.map((p) => p.name).join(", ")}.
      </span>
      <span className="mt-auto pt-[18px] font-mono text-2xs tracking-[0.16em] uppercase text-axon-schrift-zierde">
        Zugang anfragen
      </span>
    </div>
  );
}
