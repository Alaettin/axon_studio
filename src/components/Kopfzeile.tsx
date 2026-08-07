import { DropdownMenu } from "radix-ui";
import { useNavigate } from "react-router";

import { Marke } from "@/components/Marke";
import { initialen } from "@/lib/typen";
import { istAdmin, useSitzung } from "@/store/sitzung";

/**
 * Der Kopf jedes angemeldeten Bildschirms: Marke mittig, Palettenkuerzel und Konto rechts.
 *
 * Die Marke steht in der Mitte der vollen Breite, nicht in der Mitte des Rests. Deshalb
 * liegen die beiden rechten Elemente absolut und nicht in einem Fluss: sonst schoebe die
 * Breite des Namens die Marke aus der Achse.
 */

interface Props {
  /** Oeffnet die Befehlspalette. Fehlt sie, entfaellt das Kuerzel. */
  readonly oeffnePalette?: () => void;
  /** Auf der Palette selbst tritt der Kopf zurueck. */
  readonly gedaempft?: boolean;
}

export function Kopfzeile({ oeffnePalette, gedaempft = false }: Props) {
  const profil = useSitzung((z) => z.profil);
  const abmelden = useSitzung((z) => z.abmelden);
  const admin = useSitzung(istAdmin);
  const gehe = useNavigate();

  if (gedaempft) {
    return (
      <div className="flex w-full justify-center opacity-45">
        <Marke mitLogo />
      </div>
    );
  }

  return (
    <div className="relative flex w-full items-center justify-center gap-4">
      <Marke mitLogo />

      {oeffnePalette && (
        <button
          type="button"
          onClick={oeffnePalette}
          aria-keyshortcuts="Meta+K Control+K"
          className="absolute top-1/2 right-12 -mt-[13px] cursor-pointer border border-axon-linie-fein px-[9px] py-[5px] font-mono text-xs text-axon-schrift-still transition-colors duration-quick hover:border-axon-schrift-leise hover:text-axon-schrift"
        >
          ⌘K
        </button>
      )}

      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <button
            type="button"
            aria-label="Konto und Verwaltung"
            className="absolute top-1/2 right-0 -mt-[17px] flex size-[34px] cursor-pointer items-center justify-center rounded-full border border-axon-avatar-rand bg-axon-avatar font-sans text-xs text-axon-schrift transition-colors duration-quick hover:border-axon-fokus"
          >
            {profil ? initialen(profil) : "?"}
          </button>
        </DropdownMenu.Trigger>

        <DropdownMenu.Portal>
          {/*
            Das Menue entsteht am Ausloeser, nicht irgendwo: Radix setzt
            --radix-dropdown-menu-content-transform-origin auf den Anker, und der Ursprung
            der Skalierung ist damit der Kreis, den man angeklickt hat (apple-design,
            raeumliche Konsistenz).
          */}
          <DropdownMenu.Content
            align="end"
            sideOffset={10}
            className="szene-axon z-50 min-w-[220px] origin-(--radix-dropdown-menu-content-transform-origin) border border-axon-linie bg-popover py-2 shadow-[var(--shadow-overlay)] data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95"
          >
            <div className="px-4 pt-1 pb-3">
              <div className="truncate font-sans text-md text-axon-schrift">
                {profil?.display_name ?? "Ohne Namen"}
              </div>
              <div className="truncate font-mono text-xs text-axon-schrift-still">
                {profil?.email}
              </div>
            </div>

            <DropdownMenu.Separator className="my-1 h-px bg-axon-linie-fein" />

            <Eintrag onSelect={() => void gehe("/profil")}>Profil</Eintrag>

            {admin && (
              <>
                <DropdownMenu.Separator className="my-1 h-px bg-axon-linie-fein" />
                <div className="flex items-center gap-[10px] px-4 pt-3 pb-2">
                  <span className="font-mono text-etikett tracking-etikett uppercase text-axon-schrift-zierde">
                    Verwaltung
                  </span>
                  <span className="border border-axon-wahl-rand-leise px-[6px] py-[2px] font-mono text-etikett tracking-fein uppercase text-axon-fokus">
                    Nur Admin
                  </span>
                </div>
                <Eintrag onSelect={() => void gehe("/verwaltung/nutzer")}>Nutzer</Eintrag>
              </>
            )}

            <DropdownMenu.Separator className="my-1 h-px bg-axon-linie-fein" />
            <Eintrag onSelect={() => void abmelden()}>Abmelden</Eintrag>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
    </div>
  );
}

function Eintrag({
  children,
  onSelect,
}: {
  readonly children: string;
  readonly onSelect: () => void;
}) {
  return (
    <DropdownMenu.Item
      onSelect={onSelect}
      className="cursor-pointer px-4 py-[10px] font-sans text-lg text-axon-schrift-leise outline-none data-highlighted:bg-axon-zeile-aktiv data-highlighted:text-axon-schrift"
    >
      {children}
    </DropdownMenu.Item>
  );
}
