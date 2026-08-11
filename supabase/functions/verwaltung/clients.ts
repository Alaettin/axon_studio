/**
 * OAuth-Clients und die Abnahme eines Programms.
 *
 * Ausgelagert aus `index.ts`, weil die Datei sonst zwei Themen traegt: Nutzer auf der
 * einen Seite, Programme auf der anderen. Die Rechtepruefung bleibt in `index.ts` und
 * passiert **vor** jedem Aufruf hier.
 */

import { alsAdresse, pruefeAdresse, pruefeSchema } from "./adressen.ts";

// deno-lint-ignore no-explicit-any
export type Dienst = any;

export function antwort(rumpf: unknown, status = 200, cors: HeadersInit = {}): Response {
  return new Response(JSON.stringify(rumpf), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

/**
 * Redirect-URIs kennen keine Platzhalter, anders als die allgemeinen Redirect-URLs des
 * Projekts. Sie muessen vollstaendig dastehen. Ein Tippfehler faellt sonst erst beim
 * ersten echten Anmeldeversuch auf.
 */
export function pruefeRueckweg(u: string): string | null {
  let geprueft: URL;
  try {
    geprueft = new URL(u);
  } catch {
    return `Keine gueltige Redirect-URI: ${u}`;
  }
  if (geprueft.protocol !== "http:" && geprueft.protocol !== "https:") {
    return `Redirect-URI muss http oder https sein: ${u}`;
  }
  if (geprueft.search || geprueft.hash) {
    return `Redirect-URI mit Abfrage oder Anker: ${u}`;
  }
  return null;
}

/**
 * Gehoert diese Client-Kennung ueberhaupt zu einem Programm des Hubs?
 *
 * Ohne die Frage reichten `client-aendern`, `client-loeschen` und `geheimnis-erneuern` eine
 * beliebige Kennung an den Aussteller weiter. Das Supabase-Projekt ist mit der AAS Tools
 * Platform **geteilt**: ein Administrator (oder ein Fehler in der Oberflaeche) haette damit
 * jeden OAuth-Client des Projekts loeschen oder sein Geheimnis erneuern koennen, auch einen,
 * der nicht dem Hub gehoert. `hub_app_clients` ist die Liste dessen, was uns gehoert.
 *
 * Befund 5 des Sicherheitsaudits vom 10.08.2026.
 */
async function gehoertUns(dienst: Dienst, clientId: string): Promise<boolean> {
  return (await umgebungVon(dienst, clientId)) !== null;
}

/** Die Umgebung dieses Clients, oder `null`, wenn er uns nicht gehoert. */
async function umgebungVon(dienst: Dienst, clientId: string): Promise<string | null> {
  const { data } = await dienst
    .from("hub_app_clients")
    .select("umgebung")
    .eq("oauth_client_id", clientId)
    .maybeSingle();
  return (data?.umgebung as string | undefined) ?? null;
}

/**
 * Wie sich ein Client am Token-Endpunkt ausweist, haengt daran, **wer** ihn benutzt.
 *
 * Unsere eigenen Programme tauschen den Code mit HTTP-Basic; so macht es der AXON Editor
 * in `auth/oidc.ts`, und dabei bleibt es. Ein fremder Klient richtet sich nicht nach uns:
 * claude.ai schickt die Zugangsdaten im Rumpf (`client_secret_post`) und kennt die
 * registrierte Methode gar nicht, weil es sie bei einem vorab angelegten Client nirgends
 * erfaehrt. Der Aussteller weist den Tausch dann mit "client is registered for
 * client_secret_basic but client_secret_post was used" ab, und zwar erst im letzten
 * Schritt, nachdem Anmeldung und Zustimmung schon durch sind (gemessen am 11.08.2026 in
 * den Auth-Protokollen).
 *
 * Beide Methoden sind gleich stark: das Geheimnis geht so oder so ueber TLS an denselben
 * Endpunkt, nur einmal in der Kopfzeile und einmal im Rumpf.
 */
function ausweisartFuer(umgebung: string): "client_secret_post" | "client_secret_basic" {
  return umgebung === "connector" ? "client_secret_post" : "client_secret_basic";
}

/** Die immer gleiche Antwort darauf. 404, weil die Kennung fuer uns nicht existiert. */
function nichtUnserer(clientId: string, cors: HeadersInit): Response {
  return antwort(
    { fehler: `Zu dieser Client-Kennung gibt es kein Programm im Katalog: ${clientId}` },
    404,
    cors,
  );
}

export async function clientAnlegen(
  dienst: Dienst,
  auftrag: Record<string, unknown>,
  cors: HeadersInit,
): Promise<Response> {
  const appId = String(auftrag["app_id"] ?? "").trim();
  const umgebung = String(auftrag["umgebung"] ?? "").trim();
  const rueckweg = String(auftrag["redirect_uri"] ?? "").trim();
  const name = String(auftrag["name"] ?? "").trim();

  if (!appId) return antwort({ fehler: "Es fehlt das Programm." }, 400, cors);
  /*
   * Dieselbe Liste steht an drei weiteren Stellen: in der Pruefbedingung von
   * `hub_app_clients.umgebung`, im Typ `Umgebung` (src/lib/typen.ts) und in der Auswahl
   * des Assistenten (SchrittAdresse.tsx). Wer eine Umgebung ergaenzt, muss alle vier
   * anfassen; hier faellt es zuletzt auf, weil diese Funktion getrennt ausgerollt wird
   * und die Oberflaeche den neuen Wert schon anbietet (11.08.2026, `connector`).
   */
  if (!["produktion", "test", "lokal", "connector"].includes(umgebung)) {
    return antwort({ fehler: `Unbekannte Umgebung: ${umgebung}` }, 400, cors);
  }
  const mangel = pruefeRueckweg(rueckweg);
  if (mangel) return antwort({ fehler: mangel }, 400, cors);

  /*
   * Gibt es diese Umgebung schon, wird ihre Zeile gleich ueberschrieben. Ihr alter Client
   * beim Aussteller bliebe dann als Waise stehen, mit gueltigem Geheimnis und ohne dass ihn
   * noch jemand sieht. Also erst merken, spaeter wegraeumen.
   */
  const { data: vorher } = await dienst
    .from("hub_app_clients")
    .select("oauth_client_id")
    .eq("app_id", appId)
    .eq("umgebung", umgebung)
    .maybeSingle();

  /*
   * **Vertraulich**, nicht oeffentlich. Der Codetausch laeuft im Server des
   * Unterprogramms, das Token verlaesst ihn nie. Ein oeffentlicher Client legte das Token
   * in den Browser und waere gegenueber einer Anmeldung mit Passwort ein Rueckschritt.
   */
  const { data, error } = await dienst.auth.admin.oauth.createClient({
    name: `${name || appId} (${umgebung})`,
    redirect_uris: [rueckweg],
    client_type: "confidential",
    token_endpoint_auth_method: ausweisartFuer(umgebung),
  });
  if (error) return antwort({ fehler: error.message }, 400, cors);

  const { error: schreibFehler } = await dienst
    .from("hub_app_clients")
    .upsert(
      {
        app_id: appId,
        umgebung,
        oauth_client_id: data.client_id,
        redirect_uri: rueckweg,
      },
      { onConflict: "app_id,umgebung" },
    );
  if (schreibFehler) {
    /*
     * Der Client existiert beim Aussteller, unsere Zeile nicht. Ein Client ohne Zeile
     * findet niemand mehr wieder, also weg damit, statt eine Waise zu hinterlassen.
     */
    await dienst.auth.admin.oauth.deleteClient(data.client_id);
    return antwort({ fehler: schreibFehler.message }, 500, cors);
  }

  if (vorher?.oauth_client_id && vorher.oauth_client_id !== data.client_id) {
    await dienst.auth.admin.oauth.deleteClient(vorher.oauth_client_id);
  }

  // Das Geheimnis geht **einmal** hinaus und wird nirgends gespeichert.
  return antwort(
    { client_id: data.client_id, client_secret: data.client_secret, umgebung },
    200,
    cors,
  );
}

/**
 * Aendert nur den Rueckweg eines bestehenden Clients.
 *
 * Gaebe es das nicht, muesste jede korrigierte Adresse den Client neu anlegen, und das
 * zoege ein neues Geheimnis nach sich, das im laufenden Betrieb erst eingespielt werden
 * will. Ein Tippfehler soll kein Deployment kosten.
 */
export async function clientAendern(
  dienst: Dienst,
  auftrag: Record<string, unknown>,
  cors: HeadersInit,
): Promise<Response> {
  const clientId = String(auftrag["oauth_client_id"] ?? "").trim();
  const rueckweg = String(auftrag["redirect_uri"] ?? "").trim();
  if (!clientId) return antwort({ fehler: "Es fehlt die Client-Kennung." }, 400, cors);
  if (!(await gehoertUns(dienst, clientId))) return nichtUnserer(clientId, cors);
  const mangel = pruefeRueckweg(rueckweg);
  if (mangel) return antwort({ fehler: mangel }, 400, cors);

  const { error } = await dienst.auth.admin.oauth.updateClient(clientId, {
    redirect_uris: [rueckweg],
  });
  if (error) return antwort({ fehler: error.message }, 400, cors);

  const { error: schreibFehler } = await dienst
    .from("hub_app_clients")
    .update({ redirect_uri: rueckweg })
    .eq("oauth_client_id", clientId);
  if (schreibFehler) return antwort({ fehler: schreibFehler.message }, 500, cors);

  return antwort({ client_id: clientId, redirect_uri: rueckweg }, 200, cors);
}

export async function clientLoeschen(
  dienst: Dienst,
  auftrag: Record<string, unknown>,
  cors: HeadersInit,
): Promise<Response> {
  const clientId = String(auftrag["oauth_client_id"] ?? "").trim();
  if (!clientId) return antwort({ fehler: "Es fehlt die Client-Kennung." }, 400, cors);
  if (!(await gehoertUns(dienst, clientId))) return nichtUnserer(clientId, cors);

  const { error } = await dienst.auth.admin.oauth.deleteClient(clientId);
  // Ist er beim Aussteller schon weg, ist das kein Grund, unsere Zeile stehen zu lassen.
  if (error && !/not.?found/i.test(error.message)) {
    return antwort({ fehler: error.message }, 400, cors);
  }
  await dienst.from("hub_app_clients").delete().eq("oauth_client_id", clientId);
  return antwort({ geloescht: clientId }, 200, cors);
}

/**
 * Ein frisches Geheimnis, und dabei gleich die richtige Ausweisart.
 *
 * Das Erneuern zieht die Ausweisart mit, statt nur das Geheimnis zu tauschen. Grund: ein
 * Client, der vor dem 11.08.2026 angelegt wurde, traegt `client_secret_basic`, auch wenn
 * er inzwischen in der Umgebung `connector` steht. Ohne diese Zeile bliebe er dabei, denn
 * die Ausweisart laesst sich in der Oberflaeche nirgends anfassen, und der einzige Ausweg
 * waere: Umgebung entfernen, ausfuehren, wieder anlegen. Drei Schritte fuer ein Feld.
 *
 * Fuer alle anderen Umgebungen ist es ein Nullgriff, sie stehen ohnehin auf Basic.
 */
export async function geheimnisErneuern(
  dienst: Dienst,
  auftrag: Record<string, unknown>,
  cors: HeadersInit,
): Promise<Response> {
  const clientId = String(auftrag["oauth_client_id"] ?? "").trim();
  if (!clientId) return antwort({ fehler: "Es fehlt die Client-Kennung." }, 400, cors);
  const umgebung = await umgebungVon(dienst, clientId);
  if (umgebung === null) return nichtUnserer(clientId, cors);

  const { error: ausweisFehler } = await dienst.auth.admin.oauth.updateClient(clientId, {
    token_endpoint_auth_method: ausweisartFuer(umgebung),
  });
  if (ausweisFehler) return antwort({ fehler: ausweisFehler.message }, 400, cors);

  const { data, error } = await dienst.auth.admin.oauth.regenerateClientSecret(clientId);
  if (error) return antwort({ fehler: error.message }, 400, cors);
  return antwort({ client_id: clientId, client_secret: data.client_secret }, 200, cors);
}

/** Ein Punkt der Abnahme. `null` bei `gut` heisst: nicht automatisch pruefbar. */
interface Punkt {
  readonly name: string;
  readonly gut: boolean | null;
  readonly befund: string;
}

/**
 * Verhindert, dass die Abnahme zum Fernrohr ins innere Netz wird.
 *
 * Das Urteil ueber eine Adresse steht in `adressen.ts`, hier steht der Weg dorthin: aus
 * dem Hostnamen wird eine Adresse, notfalls ueber die Namensaufloesung.
 *
 * **Der Name wird aufgeloest, nicht gelesen.** Ein oeffentlicher Name darf auf `10.0.0.5`
 * zeigen, und genau das sah die alte Musterliste nicht. Ein Rest bleibt und gehoert
 * benannt: zwischen dieser Aufloesung und dem eigentlichen Aufruf kann die Antwort des
 * Namensdienstes wechseln. Dagegen hilft nur, selbst zur Adresse zu verbinden, und das
 * kann `fetch` nicht.
 */
async function zielErlaubt(u: URL): Promise<string | null> {
  const schemaMangel = pruefeSchema(u.protocol);
  if (schemaMangel) return schemaMangel;

  const host = u.hostname.toLowerCase();

  // Steht die Adresse schon da, gibt es nichts aufzuloesen.
  const unmittelbar = alsAdresse(host);
  if (unmittelbar !== null) return pruefeAdresse(unmittelbar);

  // `localhost` und die Sondernamen aufzuloesen ginge auch, aber sie hier abzuweisen ist
  // ehrlicher: sie bedeuten in jedem Netz etwas anderes.
  if (host === "localhost" || host.endsWith(".internal") || host.endsWith(".local")) {
    return `Diese Abnahme prueft nur oeffentliche Adressen, nicht ${host}.`;
  }

  const adressen: string[] = [];
  for (const art of ["A", "AAAA"] as const) {
    try {
      adressen.push(...(await Deno.resolveDns(host, art)));
    } catch {
      // Ein Name muss nicht beide Arten fuehren. Erst wenn beide leer bleiben, ist es ein
      // Mangel, und das steht unten.
    }
  }
  if (adressen.length === 0) return `Dieser Name loest nicht auf: ${host}.`;

  for (const adresse of adressen) {
    const mangel = pruefeAdresse(adresse);
    if (mangel) return mangel;
  }
  return null;
}

/** Wie viele Weiterleitungen die Abnahme mitgeht. Drei reichen fuer jeden ehrlichen Dienst. */
const SPRUENGE = 3;

/**
 * Holt eine Adresse und prueft **vor jedem Sprung** neu.
 *
 * Das ist der eigentliche Befund 2: `fetch` folgt Weiterleitungen von sich aus, und die
 * Pruefung lief nur einmal, auf der eingetragenen Adresse. Ein oeffentlicher Server, der
 * mit `302 Location: http://169.254.169.254/` antwortet, fuehrte an der ganzen Liste
 * vorbei. Mit `redirect: "manual"` gehoert jeder Sprung uns.
 */
async function holeGeprueft(start: URL): Promise<Response> {
  let ziel = start;
  for (let sprung = 0; sprung <= SPRUENGE; sprung += 1) {
    const mangel = await zielErlaubt(ziel);
    if (mangel) throw new Error(mangel);

    const r = await fetch(ziel.toString(), {
      redirect: "manual",
      signal: AbortSignal.timeout(10_000),
    });
    if (r.status < 300 || r.status > 399) return r;

    const weiter = r.headers.get("location");
    if (weiter === null) return r;
    await r.body?.cancel();
    ziel = new URL(weiter, ziel);
  }
  throw new Error(`Mehr als ${String(SPRUENGE)} Weiterleitungen, das ist keine Abnahme mehr.`);
}

export async function abnahme(
  dienst: Dienst,
  auftrag: Record<string, unknown>,
  ausstellerBasis: string,
  cors: HeadersInit,
): Promise<Response> {
  const appId = String(auftrag["app_id"] ?? "").trim();
  if (!appId) return antwort({ fehler: "Es fehlt das Programm." }, 400, cors);

  const { data: app, error: leseFehler } = await dienst
    .from("hub_apps")
    .select("*")
    .eq("id", appId)
    .single();
  if (leseFehler || !app) {
    return antwort({ fehler: leseFehler?.message ?? "Programm nicht gefunden." }, 404, cors);
  }

  const { data: clients } = await dienst
    .from("hub_app_clients")
    .select("*")
    .eq("app_id", appId);

  const punkte: Punkt[] = [];
  let fassung: string | null = null;

  // 1. Antwortet der Dienst ueberhaupt?
  if (!app.basis_adresse) {
    punkte.push({ name: "Dienst antwortet", gut: false, befund: "Keine Basis-Adresse hinterlegt." });
  } else {
    try {
      const ziel = new URL(app.gesundheitspfad ?? "/api/health", app.basis_adresse);
      // Wird die Adresse abgewiesen, wirft `holeGeprueft`, und der Grund landet im
      // `catch` unten. Ein Zweig weniger, und der Grund steht trotzdem im Befund.
      const r = await holeGeprueft(ziel);
      // Manche Dienste melden ihre Fassung im Gesundheitspfad. Wenn ja, nehmen wir sie
      // mit; wenn nicht, ist das kein Mangel.
      try {
        const rumpf = (await r.clone().json()) as Record<string, unknown>;
        const v = rumpf["version"] ?? rumpf["fassung"];
        if (typeof v === "string") fassung = v;
      } catch {
        // Kein JSON. Auch gut, der Statuscode ist die eigentliche Aussage.
      }
      punkte.push({
        name: "Dienst antwortet",
        gut: r.ok,
        befund: `${ziel.pathname} → ${String(r.status)}${fassung ? `, Fassung ${fassung}` : ""}`,
      });
    } catch (ursache) {
      punkte.push({
        name: "Dienst antwortet",
        gut: false,
        befund: ursache instanceof Error ? ursache.message : "Nicht erreichbar.",
      });
    }
  }

  // 2. Stimmt die Redirect-URI mit dem ueberein, was beim Aussteller steht?
  if (!clients || clients.length === 0) {
    punkte.push({
      name: "Redirect-URI stimmt exakt",
      gut: false,
      befund: "Noch keine Umgebung angelegt.",
    });
  } else {
    const abweichungen: string[] = [];
    for (const c of clients) {
      const { data: beimAussteller, error } = await dienst.auth.admin.oauth.getClient(
        c.oauth_client_id,
      );
      if (error || !beimAussteller) {
        abweichungen.push(`${c.umgebung}: Client nicht gefunden`);
        continue;
      }
      const eingetragen: string[] = beimAussteller.redirect_uris ?? [];
      if (!eingetragen.includes(c.redirect_uri)) {
        abweichungen.push(
          `${c.umgebung}: Katalog sagt ${c.redirect_uri}, registriert ist ${eingetragen.join(", ") || "nichts"}`,
        );
      }
    }
    punkte.push({
      name: "Redirect-URI stimmt exakt",
      gut: abweichungen.length === 0,
      befund:
        abweichungen.length === 0
          ? `${String(clients.length)} Umgebung${clients.length === 1 ? "" : "en"} geprüft`
          : abweichungen.join(" | "),
    });
  }

  // 3. Kann ein Programm das ID-Token ueberhaupt pruefen?
  try {
    const r = await fetch(`${ausstellerBasis}/.well-known/jwks.json`, {
      signal: AbortSignal.timeout(10_000),
    });
    const { keys } = (await r.json()) as { keys: { alg?: string }[] };
    const asymmetrisch = keys.filter((k) => k.alg === "ES256" || k.alg === "RS256");
    punkte.push({
      name: "ID-Token prüfbar",
      gut: asymmetrisch.length > 0,
      befund:
        asymmetrisch.length > 0
          ? `${asymmetrisch.map((k) => k.alg).join(", ")} über JWKS`
          : "JWKS führt keinen asymmetrischen Schlüssel, ID-Tokens sind nicht prüfbar.",
    });
  } catch (ursache) {
    punkte.push({
      name: "ID-Token prüfbar",
      gut: false,
      befund: ursache instanceof Error ? ursache.message : "JWKS nicht erreichbar.",
    });
  }

  /*
   * Die letzten beiden sind **nicht** automatisch pruefbar, und das steht hier statt eines
   * gruenen Hakens, der nichts bedeutet.
   */
  punkte.push({
    name: "Code gegen Token getauscht",
    gut: null,
    befund: "Braucht einen echten Anmeldeversuch mit einem Menschen davor.",
  });
  punkte.push({
    name: "Abmelden wirkt in beide Richtungen",
    gut: null,
    befund: "Das Programm muss beim Abmelden seine eigene Sitzung mitbeenden. Von hier nicht messbar.",
  });

  const harteFehler = punkte.filter((p) => p.gut === false).length;
  const neuerStatus = harteFehler === 0 ? "aktiv" : "pruefen";

  await dienst
    .from("hub_apps")
    .update({
      status: neuerStatus,
      fassung,
      zuletzt_geprueft: new Date().toISOString(),
    })
    .eq("id", appId);

  return antwort({ punkte, status: neuerStatus, fassung }, 200, cors);
}
