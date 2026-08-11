/**
 * Welche Adresse darf die Abnahme abrufen?
 *
 * Die Abnahme holt eine Adresse, die ein Administrator eingetragen hat, und tut das **vom
 * Server aus**. Das ist gewollt, sonst scheiterte sie an CORS. Es heisst aber auch, dass
 * hier jemand mit Verwaltungsrechten Adressen abfragen lassen koennte, die er selbst nicht
 * erreicht.
 *
 * Bis zum 10.08.2026 stand hier eine Liste von Mustern ueber dem **Hostnamen**. Der
 * Sicherheitsaudit (Befund 2) hat gezeigt, dass eine solche Liste die Schreibweise prueft
 * und nicht das Ziel: `http://2130706433/` und `[::ffff:127.0.0.1]` erreichen denselben
 * Rechner, ohne einem Muster auf `127.` zu begegnen, und ein oeffentlicher Name darf auf
 * `10.0.0.5` zeigen. Deshalb ist die Pruefung umgestellt auf **Adresse gegen Bereich**.
 *
 * Diese Datei ist mit Absicht frei von `Deno`: sie soll sich aus `test/` heraus pruefen
 * lassen. Die Namensaufloesung steht deshalb in `clients.ts`, hier steht nur das Urteil
 * ueber eine fertige Adresse.
 */

/** Eine IPv4 als vier Bytes, oder `null`, wenn der Text keine ist. */
export function alsIPv4(text: string): readonly number[] | null {
  const teile = text.split(".");
  if (teile.length === 0 || teile.length > 4) return null;

  const zahlen: number[] = [];
  for (const teil of teile) {
    const wert = alsZahl(teil);
    if (wert === null) return null;
    zahlen.push(wert);
  }

  /*
   * Die Kurzformen, die `inet_aton` kennt und die Browser und curl mitmachen: `127.1` ist
   * `127.0.0.1`, und `2130706433` ist es auch. Wer sie nicht kennt, laesst sie durch.
   */
  const letzte = zahlen[zahlen.length - 1] ?? 0;
  const vordere = zahlen.slice(0, -1);
  if (vordere.some((z) => z > 255)) return null;
  const rest = 4 - vordere.length;
  if (letzte >= 2 ** (8 * rest)) return null;

  const bytes = [...vordere];
  for (let i = rest - 1; i >= 0; i -= 1) {
    bytes.push((letzte >>> (8 * i)) & 0xff);
  }
  return bytes;
}

/** Dezimal, oktal (`0177`) und hexadezimal (`0x7f`), wie `inet_aton` sie liest. */
function alsZahl(text: string): number | null {
  if (text === "") return null;
  let wert: number;
  if (/^0[xX][0-9a-fA-F]+$/u.test(text)) wert = Number.parseInt(text.slice(2), 16);
  else if (/^0[0-7]+$/u.test(text)) wert = Number.parseInt(text.slice(1), 8);
  else if (/^\d+$/u.test(text)) wert = Number.parseInt(text, 10);
  else return null;
  return Number.isSafeInteger(wert) && wert >= 0 && wert <= 0xff_ff_ff_ff ? wert : null;
}

/**
 * Liegt diese IPv4 in einem Bereich, der nicht ins offene Netz gehoert?
 *
 * Die Bereiche stehen ausgeschrieben, nicht als Muster: „interner Bereich" ohne genaue
 * Angabe ist keine Aussage, an der sich spaeter jemand pruefen kann.
 */
function istInternesIPv4(bytes: readonly number[]): boolean {
  const [a = 0, b = 0] = bytes;
  return (
    a === 0 || //            0.0.0.0/8       diese Maschine
    a === 10 || //           10.0.0.0/8      privat
    a === 127 || //          127.0.0.0/8     Loopback
    (a === 100 && b >= 64 && b <= 127) || // 100.64.0.0/10   Betreiber-NAT
    (a === 169 && b === 254) || //           169.254.0.0/16  Link-lokal, Metadatendienste
    (a === 172 && b >= 16 && b <= 31) || //  172.16.0.0/12   privat
    (a === 192 && b === 168) || //           192.168.0.0/16  privat
    (a === 192 && b === 0) || //             192.0.0.0/24    IETF-Sonderzwecke
    (a === 198 && (b === 18 || b === 19)) || // 198.18.0.0/15 Messnetze
    a >= 224 //                              224.0.0.0/4 und 240.0.0.0/4, Multicast und reserviert
  );
}

/**
 * Liegt diese IPv6 in einem solchen Bereich?
 *
 * Der wichtige Fall ist die **IPv4-gemappte** Form: `::ffff:127.0.0.1` ist derselbe
 * Rechner wie `127.0.0.1`. Sie wird ausgepackt und als IPv4 beurteilt, statt den ganzen
 * Bereich `::ffff:0:0/96` zu sperren, denn der enthaelt auch jedes oeffentliche Ziel.
 */
function istInternesIPv6(text: string): boolean {
  const roh = text.replace(/^\[/u, "").replace(/\]$/u, "").split("%")[0]?.toLowerCase() ?? "";

  const gemappt = /^::ffff:(.+)$/u.exec(roh)?.[1];
  if (gemappt !== undefined) {
    const bytes = alsIPv4(gemappt);
    if (bytes) return istInternesIPv4(bytes);
    // `::ffff:7f00:1`, dieselbe Adresse in Hexpaaren.
    const paare = /^([0-9a-f]{1,4}):([0-9a-f]{1,4})$/u.exec(gemappt);
    if (paare) {
      const hoch = Number.parseInt(paare[1] ?? "0", 16);
      const tief = Number.parseInt(paare[2] ?? "0", 16);
      return istInternesIPv4([hoch >>> 8, hoch & 0xff, tief >>> 8, tief & 0xff]);
    }
  }

  if (roh === "::" || roh === "::1") return true; // unbestimmt und Loopback
  if (/^f[cd][0-9a-f]{0,2}:/u.test(roh)) return true; // fc00::/7, eindeutig lokal
  if (/^fe[89ab][0-9a-f]?:/u.test(roh)) return true; // fe80::/10, link-lokal
  if (/^ff[0-9a-f]{0,2}:/u.test(roh)) return true; // ff00::/8, Multicast
  return false;
}

/** `null` heisst erlaubt, sonst steht hier der Grund im Klartext. */
export function pruefeAdresse(adresse: string): string | null {
  if (adresse.includes(":") && !alsIPv4(adresse)) {
    return istInternesIPv6(adresse)
      ? `Diese Abnahme prueft nur oeffentliche Adressen, nicht ${adresse}.`
      : null;
  }
  const bytes = alsIPv4(adresse);
  if (!bytes) return `Das ist keine Adresse, die sich beurteilen laesst: ${adresse}.`;
  return istInternesIPv4(bytes)
    ? `Diese Abnahme prueft nur oeffentliche Adressen, nicht ${adresse}.`
    : null;
}

/**
 * Steht im Hostnamen schon eine Adresse, oder muss er aufgeloest werden?
 *
 * Gibt die Adresse zurueck, wenn der Name selbst eine ist, sonst `null`. Nur dann lohnt
 * eine Namensaufloesung, und nur dann gibt es einen Namen, der auf etwas anderes zeigen
 * koennte, als er sagt.
 */
export function alsAdresse(host: string): string | null {
  if (host.startsWith("[")) return host;
  if (host.includes(":")) return host;
  return alsIPv4(host) ? host : null;
}

/** Das Schema. Alles ausser http und https hat hier nichts zu suchen. */
export function pruefeSchema(protokoll: string): string | null {
  return protokoll === "http:" || protokoll === "https:" ? null : "Nur http oder https.";
}
