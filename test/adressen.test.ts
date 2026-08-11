import { describe, expect, it } from "vitest";

import { alsAdresse, alsIPv4, pruefeAdresse, pruefeSchema } from "../supabase/functions/verwaltung/adressen";

/**
 * Waechter ueber der Adresspruefung der Abnahme.
 *
 * Befund 2 des Sicherheitsaudits vom 10.08.2026: die alte Pruefung war eine Liste von
 * Mustern ueber dem Hostnamen und traf damit die Schreibweise, nicht das Ziel. Diese
 * Pruefungen sind die Faelle, an denen sie vorbeiging. Sie stehen hier, damit die Liste
 * beim naechsten Umbau nicht stillschweigend wieder schrumpft.
 *
 * Was hier **nicht** geprueft wird und auch nicht kann: dass `fetch` Weiterleitungen nicht
 * mehr von selbst folgt. Das haengt an `redirect: "manual"` in `clients.ts` und braucht
 * einen Server, der weiterleitet.
 */

describe("alsIPv4 liest die Schreibweisen, die inet_aton kennt", () => {
  it("die gewoehnliche Form", () => {
    expect(alsIPv4("127.0.0.1")).toEqual([127, 0, 0, 1]);
    expect(alsIPv4("8.8.8.8")).toEqual([8, 8, 8, 8]);
  });

  it("dezimal in einem Stueck", () => {
    expect(alsIPv4("2130706433")).toEqual([127, 0, 0, 1]);
  });

  it("oktal und hexadezimal", () => {
    expect(alsIPv4("0177.0.0.1")).toEqual([127, 0, 0, 1]);
    expect(alsIPv4("0x7f.0.0.1")).toEqual([127, 0, 0, 1]);
  });

  it("die Kurzform mit weniger als vier Teilen", () => {
    expect(alsIPv4("127.1")).toEqual([127, 0, 0, 1]);
    expect(alsIPv4("10.1")).toEqual([10, 0, 0, 1]);
  });

  it("was keine Adresse ist, ist keine", () => {
    expect(alsIPv4("axon-editor.sliplane.app")).toBeNull();
    expect(alsIPv4("256.0.0.1")).toBeNull();
    expect(alsIPv4("127.0.0.1.1")).toBeNull();
    expect(alsIPv4("")).toBeNull();
  });
});

describe("pruefeAdresse weist das innere Netz ab", () => {
  const innen = [
    "127.0.0.1",
    "2130706433", // dieselbe, dezimal
    "0177.0.0.1", // dieselbe, oktal
    "127.1", // dieselbe, kurz
    "10.0.0.5",
    "172.16.0.1",
    "172.31.255.254",
    "192.168.1.1",
    "169.254.169.254", // Metadatendienste
    "100.64.0.1", // Betreiber-NAT
    "0.0.0.0",
    "192.0.0.1",
    "198.18.0.1",
    "224.0.0.1",
    "::1",
    "::",
    "fd00::1", // eindeutig lokal
    "fc00::1",
    "fe80::1", // link-lokal
    "::ffff:127.0.0.1", // IPv4-gemappt
    "::ffff:7f00:1", // dieselbe in Hexpaaren
    "[::ffff:169.254.169.254]",
  ];

  for (const adresse of innen) {
    it(`weist ${adresse} ab`, () => {
      expect(pruefeAdresse(adresse)).not.toBeNull();
    });
  }

  const aussen = ["8.8.8.8", "1.1.1.1", "172.15.0.1", "172.32.0.1", "100.63.0.1", "2606:4700::1"];

  for (const adresse of aussen) {
    it(`laesst ${adresse} durch`, () => {
      expect(pruefeAdresse(adresse)).toBeNull();
    });
  }

  it("packt IPv4-gemappte Adressen aus, statt den Bereich pauschal zu sperren", () => {
    // `::ffff:0:0/96` enthaelt auch jedes oeffentliche Ziel. Wer ihn ganz sperrt, sperrt
    // mehr, als er sagt.
    expect(pruefeAdresse("::ffff:8.8.8.8")).toBeNull();
    expect(pruefeAdresse("::ffff:127.0.0.1")).not.toBeNull();
  });
});

describe("alsAdresse unterscheidet Adresse von Name", () => {
  it("erkennt eine Adresse als solche", () => {
    expect(alsAdresse("127.0.0.1")).toBe("127.0.0.1");
    expect(alsAdresse("2130706433")).toBe("2130706433");
    expect(alsAdresse("[::1]")).toBe("[::1]");
  });

  it("gibt bei einem Namen null zurueck, damit er aufgeloest wird", () => {
    expect(alsAdresse("axon-editor.sliplane.app")).toBeNull();
    expect(alsAdresse("localhost")).toBeNull();
  });
});

describe("pruefeSchema", () => {
  it("laesst http und https zu", () => {
    expect(pruefeSchema("http:")).toBeNull();
    expect(pruefeSchema("https:")).toBeNull();
  });

  it("weist alles andere ab", () => {
    expect(pruefeSchema("file:")).not.toBeNull();
    expect(pruefeSchema("gopher:")).not.toBeNull();
  });
});
