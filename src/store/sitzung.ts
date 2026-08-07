import type { Session } from "@supabase/supabase-js";
import { useMemo } from "react";
import { create } from "zustand";

import { mitFrist, supabase } from "@/lib/supabase";
import type { Profil, Programm } from "@/lib/typen";

/**
 * Wer ist angemeldet, was darf er sehen.
 *
 * **Kein Zwischenspeicher in localStorage mit sofortigem Rendern.** In der AAS Tools
 * Platform sieht ein Nutzer eine geaenderte Rolle oder Freischaltung erst nach dem
 * Neuladen. Das ist nicht sicherheitsrelevant, RLS entscheidet serverseitig; es verwirrt
 * aber genau die Person, die die Rechte gerade vergeben hat. Deshalb wird Profil und
 * Zugriff bei jedem Auftauchen des Fensters frisch geholt.
 *
 * Abgeleitet statt nachgebildet: `istAdmin` und `freigeschaltet` sind Funktionen ueber dem
 * geladenen Zustand, keine eigenen Felder. Ein zweites Feld waere ein zweiter Zeitpunkt,
 * an dem es falsch sein kann.
 */

interface Zustand {
  /** `undefined` heisst: noch nicht geprueft. `null` heisst: nicht angemeldet. */
  sitzung: Session | null | undefined;
  profil: Profil | null;
  katalog: readonly Programm[];
  /** Die `hub_apps.id`, die dieser Nutzer oeffnen darf. */
  zugriffe: readonly string[];
  laedt: boolean;
  fehler: string | null;

  starte: () => () => void;
  aktualisiere: () => Promise<void>;
  abmelden: () => Promise<void>;
}

export const useSitzung = create<Zustand>((setze, hole) => ({
  sitzung: undefined,
  profil: null,
  katalog: [],
  zugriffe: [],
  laedt: false,
  fehler: null,

  starte: () => {
    void supabase.auth.getSession().then(({ data }) => {
      setze({ sitzung: data.session });
      if (data.session) void hole().aktualisiere();
    });

    const { data: horcher } = supabase.auth.onAuthStateChange((ereignis, sitzung) => {
      setze({ sitzung: sitzung ?? null });
      if (sitzung) {
        // TOKEN_REFRESHED kommt im Minutentakt und braucht keine neue Abfrage.
        if (ereignis !== "TOKEN_REFRESHED") void hole().aktualisiere();
      } else {
        setze({ profil: null, katalog: [], zugriffe: [] });
      }
    });

    // Rechte koennen sich geaendert haben, waehrend das Fenster im Hintergrund lag.
    const beiSichtbar = () => {
      if (document.visibilityState === "visible" && hole().sitzung) {
        void hole().aktualisiere();
      }
    };
    document.addEventListener("visibilitychange", beiSichtbar);

    return () => {
      horcher.subscription.unsubscribe();
      document.removeEventListener("visibilitychange", beiSichtbar);
    };
  },

  aktualisiere: async () => {
    setze({ laedt: true, fehler: null });
    try {
      const nutzer = (await supabase.auth.getUser()).data.user;
      if (!nutzer) {
        setze({ profil: null, katalog: [], zugriffe: [], laedt: false });
        return;
      }

      // Drei Abfragen, eine Runde. Nacheinander waeren es drei Umlaeufe fuer nichts.
      const [profil, katalog, zugriffe] = await Promise.all([
        mitFrist(supabase.from("profiles").select("*").eq("id", nutzer.id).single()),
        mitFrist(
          supabase
            .from("hub_apps")
            .select("*")
            .eq("aktiv", true)
            .order("sortierung", { ascending: true }),
        ),
        mitFrist(supabase.from("user_tool_access").select("tool_id").eq("user_id", nutzer.id)),
      ]);

      const ersterFehler = profil.error ?? katalog.error ?? zugriffe.error;
      if (ersterFehler) throw new Error(ersterFehler.message);

      setze({
        profil: profil.data as Profil,
        katalog: (katalog.data ?? []) as Programm[],
        zugriffe: (zugriffe.data ?? []).map((z: { tool_id: string }) => z.tool_id),
        laedt: false,
      });
    } catch (ursache) {
      setze({
        laedt: false,
        fehler: ursache instanceof Error ? ursache.message : "Unbekannter Fehler.",
      });
    }
  },

  abmelden: async () => {
    await supabase.auth.signOut();
    setze({ sitzung: null, profil: null, katalog: [], zugriffe: [] });
  },
}));

/**
 * Abgeleitet, nicht gespeichert. Gibt einen Grundwert zurueck und ist damit als Selektor
 * unbedenklich.
 */
export function istAdmin(zustand: Pick<Zustand, "profil">): boolean {
  return zustand.profil?.role === "admin";
}

/**
 * Der Katalog, aufgeteilt in das, was offen steht, und das, was nicht.
 *
 * **Ein Hook mit useMemo, kein Selektor.** Ein Selektor, der ein frisch gebautes Objekt
 * zurueckgibt, ist bei Zustand eine Endlosschleife: `useSyncExternalStore` vergleicht mit
 * `Object.is`, zwei gleiche Objekte sind nie dasselbe, also gilt der Speicher bei jedem
 * Rendern als geaendert. Genau das ist hier passiert, und es sah aus wie eine kaputte
 * Anmeldung: die Anfragen liefen alle mit 200 durch, die Seite blieb trotzdem stehen,
 * weil React die Aktualisierungstiefe abbrach.
 */
export function useKatalogteile(): {
  offen: readonly Programm[];
  gesperrt: readonly Programm[];
} {
  const katalog = useSitzung((z) => z.katalog);
  const zugriffe = useSitzung((z) => z.zugriffe);

  return useMemo(() => {
    const erlaubt = new Set(zugriffe);
    return {
      offen: katalog.filter((p) => erlaubt.has(p.id)),
      gesperrt: katalog.filter((p) => !erlaubt.has(p.id)),
    };
  }, [katalog, zugriffe]);
}
