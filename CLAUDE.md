# AXON Studio

Der **Hub**: eine zentrale Anlaufstelle für mehrere kleine Anwendungen, die selbst der
Identitätsanbieter ist.

**Die Projektakte liegt in Outline** (`outline.adogan.de`) unter
`01 Projekte → 02 Arbeit → 06 AXON Studio` und ist maßgeblich. Entscheidungen, verworfene Alternativen und Stolperfallen stehen dort,
nicht hier. **Dort nachschlagen, nicht aus dem Code rekonstruieren.**

## Nicht verwechseln

Der **AAS Editor** unter `...\Claude\AAS-Editor` trug den Namen „AXON Studio" vom 06. bis
zum 07.08.2026 und hat ihn abgegeben. Er liegt öffentlich auf `axon-studio.sliplane.app`,
also zeigt die naheliegende Adresse bis auf Weiteres auf das **falsche** Programm. Wer eine
Domain, einen Dienst oder eine Redirect-URI anlegt, muss wissen, welches der beiden gemeint
ist.

## Aufbau

Ein Vite-Projekt, kein Monorepo. React 19, Tailwind 4, Zustand, react-router, cmdk,
radix-ui, supabase-js.

```
src/
  styles/tokens.css       Die AXON-Rampe. Jeder Farbwert der Anwendung steht hier.
  components/Keyvisual/   Aus dem AAS Editor portiert, tokengesteuert, kennt keine Farbe.
  components/             Flaeche, Marke, Kopfzeile, Kachel, Palette, Modal, Bausteine
  routes/                 Anmeldung, Buehne, Profil, Zustimmung, PasswortSetzen, Waechter
  routes/verwaltung/      Nutzerliste, Nutzer-Detail, Zugang anlegen, Organisationen
  lib/                    supabase, typen, funktion, verwaltung, konto (Edge Functions)
  store/sitzung.ts        Wer ist angemeldet, was darf er sehen
supabase/
  migrations/             Alle mit `hub_` vorangestellt
  functions/verwaltung/   Was den service_role-Schluessel braucht, nur fuer Admins
  functions/konto/        Eigenes Passwort und eigene Organisationen, fuer jeden Angemeldeten
```

## Supabase: der Hub sattelt auf einem fremden Projekt auf

**Projekt `acbkhrfzeyixxdbcbnah` (AAS-Tools), eu-central-1.** Kein eigenes Projekt: der
Free-Plan gewährt zwei Projekte über alle Organisationen hinweg, und beide sind belegt.

Daraus folgen Regeln, die hier eingehalten werden:

- **Eigene Tabellen tragen `hub_`**, wie dort `dti_`, `ucc_`, `doc_`, `excel_`, `aas_`.
- **`profiles` und `user_tool_access` sind geteilt.** Sie werden benutzt, nicht umgebaut.
  Ausnahmen sind zwei additive Spalten: `profiles.status` und `profiles.passwortwechsel_faellig`.
- **Löschen ist im geteilten Projekt ein Lawinenabgang.** Dreizehn Tabellen hängen mit
  `on delete cascade` an `auth.users`, zwölf davon gehören der AAS Tools Platform; eine
  (`doc_manuals.created_by`) steht auf `no action` und sperrt, und ihr Fehler wird in GoTrue
  unkenntlich. Deshalb zeigt die Verwaltung erst eine Vorschau und verlangt die abgetippte
  Adresse. Die Vorschau wird in `hub_loeschvorschau()` **aus `pg_constraint` abgeleitet**, nicht
  gepflegt: eine Liste im Code wäre falsch, sobald die Tools-Plattform eine Tabelle ergänzt.
- **Organisationen sagen, wer zusammengehört, und sonst nichts.** `hub_organisationen` und
  `hub_organisation_mitglieder` (mehrere je Nutzer, Rolle `mitglied` oder `verwalter`), beide
  **nicht** in `profiles`: dort dürfte jeder seine eigene Zeile ändern und sich damit selbst in
  eine fremde Organisation eintragen. Die Unterprogramme fragen über die Edge Function `konto`,
  Handlung `organisationen`, mit dem OAuth-Zugriffstoken aus ihrem eigenen Codetausch. Kein
  Anspruch im Token: der Hook dafür liefe bei jeder Tokenausstellung des geteilten Projekts.
- **Ein Zugang entsteht nur in der Verwaltung**, mit einem Startpasswort, das genau einmal
  angezeigt wird. Kein Einladungslink mehr: der hing an der projektweiten Site URL, und die
  gehört der AAS Tools Platform. Bis zum Wechsel steht `profiles.passwortwechsel_faellig`,
  und löschen darf die Marke nur die Edge Function `konto`, zusammen mit dem neuen Passwort.
  **Im Hub** gibt es keinen zweiten Weg herein; die Selbstregistrierung der Tools Platform
  legt aber weiterhin Konten an, die hier gültig sind.
- **Kein Fremdschlüssel von `user_tool_access` auf `hub_apps`.** Die Tools-Plattform
  schreibt dort, und ein nachträglicher Fremdschlüssel könnte ihre Schreibvorgänge brechen.
  Die Kopplung über `tool_id` = `hub_apps.id` ist Verabredung, nicht Zwang.
- Vor jeder Migration `list_tables`, danach `get_advisors` für Security **und** Performance.
  Der Ausgangsstand hatte 5 Sicherheitswarnungen und 123 Performance-Hinweise, alle
  vorbestehend. Neue dürfen nicht dazukommen.

## Regeln der Erscheinung

Durchgesetzt von `test/erscheinung.test.ts`, nicht nur behauptet:

- **Kein Farbwert im Komponentencode.** Alles kommt aus `tokens.css`. Einzige Ausnahme:
  `hub_apps.akzent`, eine gepflegte Angabe aus der Datenbank.
- **Genau eine Erscheinung.** Kein Dunkelmodus, kein `.dark`, keine `dark:`-Utility.
- **Kantig:** die Radienleiter endet bei 2px. Rundes benutzt `rounded-full`.
- **Genau eine Akzentfarbe**, sie heißt `primary` und ist das Aktionsgrün `#00A386`. Cyan
  `#00FDFD` ist Fokus und Auswahl, nicht Aktion.
- **Laufweite ist größenabhängig**, nicht ein fester Wert. Siehe `--tracking-*`.
- **Jede streuende Fläche trägt `data-glas`.** Daran hängt
  `prefers-reduced-transparency`; ohne die Marke bliebe sie streuend stehen.
- **Nie helles Glas auf hellem Glas.** Dialoge über einer Glasfläche sind deckend
  (`bg-popover`), nicht durchscheinend. Siehe `docs/apple-design-regeln.md`.

Vorlage: `docs/vorlage-axon-studio-hell.html`, fünfzehn Bildschirme. „Hell" heißt nicht
Hellmodus, sondern Kernblau statt des dunklen Grunds.

## Stolperfallen, teuer bezahlt

- **Ein Zustand-Selektor darf kein neues Objekt bauen.** `useSyncExternalStore` vergleicht
  mit `Object.is`; ein frisch gebautes Objekt gilt bei jedem Rendern als geändert, und
  React bricht mit „Maximum update depth exceeded" ab. Das sah aus wie eine kaputte
  Anmeldung: alle Anfragen liefen mit 200 durch, die Seite blieb trotzdem stehen. Deshalb
  ist `useKatalogteile` ein Hook mit `useMemo` und kein Selektor.
- **`current_user` ist in einer SECURITY-DEFINER-Funktion der Eigentümer**, nicht der
  Aufrufer. Eine Ausnahme „der Dienst darf" greift dort immer und schaltet den Schutz
  faktisch ab. `schuetze_rolle_und_status()` ist deshalb SECURITY INVOKER.
- **`Command.Dialog` von cmdk verteilt drei Klassennamen auf drei Knoten.** `className`
  landet am inneren Command-Element. Positionierung gehört in `contentClassName`, sonst
  fällt der Inhalt auf Höhe null zusammen und die Palette erscheint ohne Kasten.
- **Von Hand angelegte `auth.users` brauchen leere Strings, nicht NULL**, in
  `confirmation_token`, `recovery_token`, `email_change*`, `phone_change*` und
  `reauthentication_token`. GoTrue liest sie als `string` und antwortet sonst mit 500 auf
  **jede** Anmeldung, nicht nur auf die des betroffenen Nutzers.
- **Kein Formular vorbelegen, bevor die Daten da sind.** Ein Effekt an `[profil]`
  überschreibt getippten Text, sobald `aktualisiere()` beim Fensterwechsel läuft.
- **`add_header` in einem nginx-`location` löscht alle Köpfe der äußeren Ebene**, still und
  ohne Warnung. Drei der vier `location` setzen Cache-Control oder Content-Type, also
  hätten drei von vier Wegen die Sicherheitskopfzeilen verloren. Deshalb
  `docker/sicherheitskopf.conf` und ein `include` an jeder Stelle. Wer die Köpfe nur auf
  Serverebene setzt und gegen `/` misst, sieht den Fehler nie.
- **RLS kennt keine Spaltenbedingung, und eine Liste geschützter Spalten wächst nicht mit.**
  Der Trigger `schuetze_rolle_und_status()` deckte `role` und `status` ab; `email` blieb
  offen, obwohl die Nutzerverwaltung genau sie anzeigt. Kommt eine Spalte dazu, die niemand
  über sich selbst setzen darf, gehört sie in denselben Trigger.
- **Ein Recht zu entziehen heißt, es zweimal zu entziehen.** `revoke ... from public` nimmt weg,
  was PUBLIC hat; Supabase vergibt EXECUTE über Vorgaberechte **zusätzlich einzeln** an `anon`,
  `authenticated` und `service_role`. Wer nur eines von beidem tut, sieht den Advisor weiter
  meckern und hat die Funktion nicht geschlossen.
- **Ein OAuth-Zugriffstoken eines Unterprogramms ist ein vollwertiges Nutzertoken.** Es trägt
  `role: authenticated` und die Kennung, also kann ein Programm damit alles, was der Nutzer
  selbst darf, auch in der AAS Tools Platform. Die Scopes der Zustimmungsseite schränken **nur**
  ein, was der Aussteller in den Anspruch schreibt, nicht was PostgREST erlaubt. Gemessen am
  07.09.2026 mit `scripts/oauth-rundlauf.mjs`.
- **Eine Sperrliste über Hostnamen prüft die Schreibweise, nicht das Ziel.** `2130706433`
  und `[::ffff:127.0.0.1]` sind `127.0.0.1`, und ein öffentlicher Name darf auf `10.0.0.5`
  zeigen. `adressen.ts` urteilt deshalb über aufgelöste Adressen gegen Bereiche. Und
  `fetch` folgt Weiterleitungen von selbst: ohne `redirect: "manual"` prüft man den ersten
  Sprung und lädt den letzten.

## Verifikation

```
pnpm typecheck            tsc, muss still bleiben
pnpm test                 Waechter ueber Erscheinung und Adresspruefung
pnpm e2e                  Sechzehn Pruefungen im Browser, gegen die echte Datenbank
node scripts/bewegung.mjs Zaehlt rAF-Bilder mit und ohne prefers-reduced-motion
node scripts/bildschirme.mjs   Legt Bilder aller Bildschirme in test-results ab
node scripts/sperren-rundlauf.mjs  Sperren und Entsperren ueber die Edge Function
node scripts/zugang-rundlauf.mjs   Zugang anlegen, Startpasswort, Wechsel erzwungen
node scripts/loeschen-rundlauf.mjs Vorschau, Bestaetigung, Loeschen, Nachschau
node scripts/organisationen-rundlauf.mjs  Anlegen, zuordnen, und was ein Programm erfaehrt
node scripts/oauth-rundlauf.mjs .oauth-client-lokal.json   Der ganze Anmeldeweg eines Programms
node scripts/kopfzeilen-pruefen.mjs <adresse>   Die sechs Sicherheitskopfzeilen
```

**Die Kopfzeilen sieht `pnpm e2e` nicht.** Playwright laeuft gegen den Vite-Dev-Server, die
Koepfe entstehen erst in nginx. Sie brauchen den gebauten Container:

```
docker build -f docker/Dockerfile -t axon-hub .
docker run -d --name hub -p 8081:8080 axon-hub
node scripts/kopfzeilen-pruefen.mjs http://localhost:8081
```

**Die Browserprüfungen brauchen zwei Wegwerf-Zugänge**, die in der Datenbank stehen:
`axon-probe-admin@example.invalid` und `axon-probe-nutzer@example.invalid`. Die Adressen
liegen auf `.invalid` (RFC 2606) und können nie echt sein. Sie tauchen in der
Nutzerverwaltung auf; wer sie löscht, macht die Browserprüfungen unbrauchbar.

## Was gilt

- **Niemals pushen ohne ausdrückliche Ansage.**
- Keine Gedankenstriche in generierten Inhalten.
- Deutsch mit echten Umlauten in der Oberfläche. Der Code ist deutsch benannt, Kommentare
  ohne Umlaute.
