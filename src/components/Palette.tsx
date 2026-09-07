import { Command } from "cmdk";
import { useEffect } from "react";
import { useNavigate } from "react-router";

import { istAdmin, useKatalogteile, useSitzung } from "@/store/sitzung";

/**
 * Bildschirm 03 der Vorlage: die Befehlspalette.
 *
 * Programme und Verwaltung stehen in **einer** Liste. Das ist die Aussage des Entwurfs:
 * wer sucht, sucht eine Sache, nicht einen Ort. Der Verwaltungsabschnitt traegt ein
 * Etikett "Nur Admin" und erscheint nur fuer Admins, sonst waere er eine Auskunft darueber,
 * was es alles gibt und man nicht darf.
 */

interface Befehl {
  readonly id: string;
  readonly name: string;
  readonly hinweis: string;
  readonly gehe: string;
}

interface Props {
  readonly offen: boolean;
  readonly setzeOffen: (offen: boolean) => void;
}

export function Palette({ offen, setzeOffen }: Props) {
  const { offen: programme } = useKatalogteile();
  const admin = useSitzung(istAdmin);
  const abmelden = useSitzung((z) => z.abmelden);
  const navigiere = useNavigate();

  useEffect(() => {
    const bei = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setzeOffen(!offen);
      }
    };
    document.addEventListener("keydown", bei);
    return () => {
      document.removeEventListener("keydown", bei);
    };
  }, [offen, setzeOffen]);

  const verwaltung: readonly Befehl[] = admin
    ? [
        { id: "nutzer", name: "Nutzer", hinweis: "Verwaltung", gehe: "/verwaltung/nutzer" },
        { id: "katalog", name: "Katalog", hinweis: "Verwaltung", gehe: "/verwaltung/katalog" },
        {
          id: "organisationen",
          name: "Organisationen",
          hinweis: "Verwaltung",
          gehe: "/verwaltung/organisationen",
        },
        {
          id: "aufnehmen",
          name: "Programm aufnehmen",
          hinweis: "Verwaltung",
          gehe: "/verwaltung/katalog/aufnehmen",
        },
        { id: "profil", name: "Mein Profil", hinweis: "Konto", gehe: "/profil" },
      ]
    : [{ id: "profil", name: "Mein Profil", hinweis: "Konto", gehe: "/profil" }];

  if (!offen) return null;

  return (
    <Command.Dialog
      open={offen}
      onOpenChange={setzeOffen}
      label="Programme und Verwaltung durchsuchen"
      /*
       * Die drei Klassennamen gehen an drei verschiedene Knoten, und das ist die Falle:
       * `className` landet am **inneren** Command-Element, nicht am Inhalt. Die
       * Positionierung stand deshalb zuerst am falschen Knoten, das Command war `fixed`,
       * fiel damit aus dem Fluss, und der Inhalt kollabierte auf Hoehe null: die Palette
       * erschien ohne Kasten, durchsichtig ueber der Buehne. Im Bild sofort zu sehen, im
       * Test nicht, weil die Eintraege ja da waren.
       *
       * Abgedunkelt wird nicht hier: das macht der Bildschirm ueber `schleier="dicht"`.
       * Zwei Schleier uebereinander waeren doppelt so dunkel wie die Vorlage.
       */
      className="flex min-h-0 flex-col"
      overlayClassName="fixed inset-0 z-40 bg-transparent"
      contentClassName="szene-axon fixed top-1/2 left-1/2 z-50 flex w-(--w-palette) max-w-[calc(100vw-4rem)] -translate-x-1/2 -translate-y-1/2 flex-col border border-axon-palette-rand bg-popover shadow-[var(--shadow-overlay)] data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95"
    >
      <div className="flex items-center gap-[14px] border-b border-axon-linie px-[22px] py-5">
        <span aria-hidden className="font-mono text-2xs tracking-brotkrume uppercase text-axon-schrift-leise">
          ⌘K
        </span>
        <Command.Input
          autoFocus
          placeholder="Suchen"
          className="flex-1 border-0 bg-transparent p-0 font-sans text-xl text-axon-schrift outline-none placeholder:text-axon-platzhalter"
        />
      </div>

      <Command.List className="max-h-[420px] overflow-y-auto py-[14px]">
        <Command.Empty className="px-[22px] py-6 font-sans text-base text-axon-schrift-fein">
          Nichts gefunden.
        </Command.Empty>

        {programme.length > 0 && (
          <Command.Group heading="Programme" className="[&_[cmdk-group-heading]]:px-[22px] [&_[cmdk-group-heading]]:pb-2 [&_[cmdk-group-heading]]:font-mono [&_[cmdk-group-heading]]:text-etikett [&_[cmdk-group-heading]]:tracking-etikett [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:text-axon-schrift-zierde">
            {programme.map((programm) => (
              <Zeile
                key={programm.id}
                name={programm.name}
                hinweis={programm.url ? "Programm" : "Adresse fehlt"}
                akzent={programm.akzent}
                waehle={() => {
                  if (!programm.url) return;
                  setzeOffen(false);
                  window.location.assign(programm.url);
                }}
              />
            ))}
          </Command.Group>
        )}

        <Command.Group
          heading={admin ? "Verwaltung" : "Konto"}
          className="[&_[cmdk-group-heading]]:px-[22px] [&_[cmdk-group-heading]]:pt-4 [&_[cmdk-group-heading]]:pb-2 [&_[cmdk-group-heading]]:font-mono [&_[cmdk-group-heading]]:text-etikett [&_[cmdk-group-heading]]:tracking-etikett [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:text-axon-schrift-zierde"
        >
          {verwaltung.map((befehl) => (
            <Zeile
              key={befehl.id}
              name={befehl.name}
              hinweis={befehl.hinweis}
              waehle={() => {
                setzeOffen(false);
                void navigiere(befehl.gehe);
              }}
            />
          ))}
          <Zeile
            name="Abmelden"
            hinweis="Konto"
            waehle={() => {
              setzeOffen(false);
              void abmelden();
            }}
          />
        </Command.Group>
      </Command.List>

      <div className="flex items-center gap-[18px] border-t border-axon-linie px-[22px] py-[14px] font-mono text-2xs tracking-fein text-axon-schrift-fein">
        <span>↑↓ Auswahl</span>
        <span>↵ Öffnen</span>
        <span>Esc Schließen</span>
      </div>
    </Command.Dialog>
  );
}

function Zeile({
  name,
  hinweis,
  akzent,
  waehle,
}: {
  readonly name: string;
  readonly hinweis: string;
  readonly akzent?: string;
  readonly waehle: () => void;
}) {
  return (
    <Command.Item
      onSelect={waehle}
      className="flex cursor-pointer items-center gap-[14px] px-[22px] py-3 data-[selected=true]:bg-axon-zeile-aktiv"
    >
      <span
        aria-hidden
        style={akzent ? { backgroundColor: akzent } : undefined}
        className={akzent ? "size-[5px] rounded-full" : "size-[5px] rounded-full bg-axon-punkt-still"}
      />
      <span className="font-sans text-lg text-axon-schrift">{name}</span>
      <span className="ml-auto font-mono text-2xs tracking-[0.14em] uppercase text-axon-schrift-fein">
        {hinweis}
      </span>
    </Command.Item>
  );
}
