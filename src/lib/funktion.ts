import { mitFrist, supabase } from "@/lib/supabase";

/**
 * Der Aufruf einer Edge Function.
 *
 * Steht fuer sich, weil es zwei gibt: `verwaltung` fuer Administratoren und `konto` fuer
 * jeden Angemeldeten. Das Auspacken des Fehlerrumpfs gehoert beiden und soll nicht zweimal
 * dastehen.
 */
export async function rufe<T>(
  funktion: "verwaltung" | "konto",
  handlung: string,
  rest: Record<string, unknown> = {},
): Promise<T> {
  const { data, error } = await mitFrist(
    supabase.functions.invoke<T & { fehler?: string }>(funktion, {
      body: { handlung, ...rest },
    }),
  );

  if (error) {
    // FunctionsHttpError verschweigt den Rumpf. Ohne dieses Auspacken steht in der
    // Oberflaeche "Edge Function returned a non-2xx status code" und niemand weiss, warum.
    const rumpf = await ausFehler(error);
    throw new Error(rumpf ?? error.message);
  }
  if (data && "fehler" in data && data.fehler) throw new Error(data.fehler);
  return data as T;
}

async function ausFehler(fehler: unknown): Promise<string | null> {
  if (
    typeof fehler === "object" &&
    fehler !== null &&
    "context" in fehler &&
    fehler.context instanceof Response
  ) {
    try {
      const rumpf = (await fehler.context.json()) as { fehler?: string };
      return rumpf.fehler ?? null;
    } catch {
      return null;
    }
  }
  return null;
}
