import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Waechter ueber der Erscheinung.
 *
 * Die Regeln in `tokens.css` sind nur so viel wert wie ihre Durchsetzung. Im AAS Editor
 * hat sich genau das ausgezahlt: die ganze Anwendung wechselte die Farbrampe, ohne dass
 * ein Bauteil angefasst wurde, weil kein Bauteil je einen Farbwert kannte.
 *
 * Beim ersten Lauf dieser Pruefung standen sechsundzwanzig rohe Farbwerte im
 * Komponentencode. Sie sind jetzt Tokens.
 */

const QUELLE = join(import.meta.dirname, "..", "src");

function dateien(ordner: string, endung: string): string[] {
  return readdirSync(ordner).flatMap((eintrag) => {
    const pfad = join(ordner, eintrag);
    if (statSync(pfad).isDirectory()) return dateien(pfad, endung);
    return pfad.endsWith(endung) ? [pfad] : [];
  });
}

const bauteile = dateien(QUELLE, ".tsx").map((pfad) => ({
  pfad: pfad.slice(QUELLE.length + 1).replaceAll("\\", "/"),
  inhalt: readFileSync(pfad, "utf8"),
}));

describe("Farbwerte", () => {
  it("stehen nirgends roh im Komponentencode", () => {
    const treffer = bauteile.flatMap(({ pfad, inhalt }) =>
      [...inhalt.matchAll(/rgb\([\d\s_/.]+\)|#[0-9A-Fa-f]{6}\b/g)].map(
        (m) => `${pfad}: ${m[0]}`,
      ),
    );
    // Farbe aus den Daten ist erlaubt: `hub_apps.akzent` ist der Akzent eines Programms
    // und steht als gepflegter Wert in der Datenbank, nicht im Code.
    expect(treffer).toEqual([]);
  });

  it("kommen bei Daten nur ueber hub_apps.akzent herein", () => {
    const inline = bauteile.flatMap(({ pfad, inhalt }) =>
      [...inhalt.matchAll(/backgroundColor:\s*([^,}]+)/g)].map((m) => `${pfad}: ${m[1]?.trim()}`),
    );
    for (const stelle of inline) expect(stelle).toContain("akzent");
  });
});

describe("Die eine Erscheinung", () => {
  it("kennt keinen Dunkelmodus", () => {
    // Es gibt keine zweite Rampe. Eine `dark:`-Utility waere der Anfang einer zweiten Marke.
    const treffer = bauteile.filter(({ inhalt }) => /\bdark:/.test(inhalt)).map((b) => b.pfad);
    expect(treffer).toEqual([]);
  });

  it("bleibt kantig", () => {
    // Die Radienleiter endet bei 2px. Runde Dinge benutzen rounded-full und sind erlaubt.
    const treffer = bauteile.flatMap(({ pfad, inhalt }) =>
      [...inhalt.matchAll(/rounded-\[[^\]]+\]/g)].map((m) => `${pfad}: ${m[0]}`),
    );
    expect(treffer).toEqual([]);
  });
});

describe("Durchscheinende Flaechen", () => {
  it("tragen alle data-glas", () => {
    /*
     * `prefers-reduced-transparency` nimmt die Streuung ueber `[data-glas]` heraus. Eine
     * Flaeche mit `backdrop-blur`, aber ohne die Marke, bliebe dann streuend stehen: der
     * Nutzer hat um weniger Transparenz gebeten und bekaeme sie an dieser einen Stelle
     * nicht. Der Fehler faellt nur jemandem auf, der die Einstellung benutzt.
     */
    const ohne = bauteile.flatMap(({ pfad, inhalt }) =>
      [...inhalt.matchAll(/backdrop-blur-/g)].flatMap((treffer) => {
        /*
         * Zurueck bis zum oeffnenden `<` des Elements und dieses Stueck pruefen. Ein
         * festes Fenster von n Zeilen reicht nicht: an der Anmeldeleiste liegen zwischen
         * `data-glas` und der Klasse acht Zeilen Stilblock, und der Waechter meldete
         * faelschlich einen Verstoss.
         */
        const bis = treffer.index;
        const anfang = inhalt.lastIndexOf("<", bis);
        const element = inhalt.slice(anfang, bis);
        if (element.includes("data-glas")) return [];
        const zeile = inhalt.slice(0, bis).split("\n").length;
        return [`${pfad}:${String(zeile)}`];
      }),
    );
    expect(ohne).toEqual([]);
  });
});

describe("Die Schrift", () => {
  it("setzt Laufweite ueber benannte Stufen, nicht als Einzelwert", () => {
    /*
     * Laufweite ist groessenabhaengig (apple-design). Ein `tracking-[...]` im Bauteil ist
     * ein Wert ohne Groessenbezug und damit irgendwo falsch. Ausgenommen sind die drei
     * Stufen, die nur an einer Stelle vorkommen und dort dokumentiert sind.
     */
    const erlaubt = new Set(["tracking-[0.14em]", "tracking-[0.16em]", "tracking-[-0.005em]", "tracking-[0.02em]"]);
    const treffer = bauteile.flatMap(({ pfad, inhalt }) =>
      [...inhalt.matchAll(/tracking-\[[^\]]+\]/g)]
        .filter((m) => !erlaubt.has(m[0]))
        .map((m) => `${pfad}: ${m[0]}`),
    );
    expect(treffer).toEqual([]);
  });
});
