# apple-design — Kurzfassung für AXON Studio

Quelle: `emilkowalski/skills`, Skill `apple-design` (17 Prinzipien aus Apples
WWDC-Vorträgen, für das Web übersetzt). Gelesen 07.08.2026.

## Bewegung
- Rückmeldung auf `pointerdown`, nicht auf `click`. Während der Geste 1:1, nicht erst am Ende.
- Jede Animation unterbrechbar, und zwar **aus dem gerade sichtbaren Wert** heraus, nicht aus dem Zielwert. Sonst springt es.
- Federn statt Dauern für alles Berührbare. Voreinstellung: kritisch gedämpft, `damping 1.0`, `response 0.3–0.4`. Überschwingen (`damping ~0.8`) nur, wenn die Geste selbst Schwung trug.
- Geschwindigkeit von der Geste an die Feder übergeben, sonst sieht man die Naht.
- Schwung projizieren: `current + (v/1000)·d/(1−d)`, `d ≈ 0.998`, dann auf den nächsten Rastpunkt.
- Grenzen federn (Rubber-Band), nicht hart anschlagen.
- Nur `transform` und `opacity` animieren, `will-change` setzen.

## Raum
- Was von rechts hereinkommt, geht nach rechts hinaus. Gleicher Weg hin und zurück, gespiegelte Kurve.
- `transform-origin` auf das auslösende Element: Menüs, Popover und Blätter entstehen dort, wo geklickt wurde.
- Zwischenbilder sollen das Ziel andeuten, nicht blind interpolieren.

## Material (hier tragend: `--axon-anmeldung`, `--axon-karte`)
- Leisten und Blätter als durchscheinende Schicht (`backdrop-filter: blur()` plus halbtransparenter Grund), Inhalt läuft darunter durch — keine opaken Streifen.
- Materialstärke ist Hierarchie: dunkel/schwer trennt Bereiche, leicht hebt Bedienbares hervor. **Nie helles Glas auf hellem Glas.**
- Große Flächen lesen dicker: stärkere Streuung, tieferer Schatten als kleine Chips.
- Modal: Glas plus Abdunkeln, Hintergrund zurückschieben. Paralleles Panel: Glas plus Versatz, **kein** Abdunkeln.
- Über Glas kein flaches Grau: höherer Kontrast, etwas mehr Gewicht, leicht erhöhte Laufweite. Farbe gehört auf eine deckende Schicht.
- Statt 1px-Trennlinie unter der Kopfleiste eine kleine Verlaufsmaske, nur dort, wo Chrome den Inhalt wirklich überlagert.
- Glas soll materialisieren: Streuung und Skalierung gemeinsam animieren, nicht nur Deckkraft.

## Schrift
- Laufweite ist größenabhängig. Groß: negativ (≈ `-0.02em`). Klein: leicht positiv. Ein fester Wert ist irgendwo falsch.
- Zeilenhöhe umgekehrt zur Größe: eng bei Überschriften, luftig im Fließtext.
- Hierarchie aus Gewicht **und** Größe **und** Zeilenhöhe, nicht aus der Größe allein.
- Abstände in `rem`/`em`, damit größere Schrift das Layout mitzieht.

## Barrierefreiheit
- `prefers-reduced-motion`: Überblendung statt Verschiebung, kein Überschwingen. Nicht „keine Rückmeldung“, sondern eine sanftere.
- `prefers-reduced-transparency`: Deckkraft hoch, Streuung raus.
- `prefers-contrast: more`: fast deckende Flächen mit klarer Kontur.
- Keine vollflächig bewegten Hintergründe, keine langsamen Schleifen um 0,2 Hz. **Betrifft das Keyvisual direkt.**

## Die acht Grundsätze (WWDC 2026), als Vokabular
Zweck · Selbstbestimmung · Verantwortung · Vertrautheit · Anpassungsfähigkeit ·
Einfachheit (nicht Minimalismus) · Handwerk · Freude.

Dazu drei taktische Regeln, die hier greifen:
- Vier Arten von Rückmeldung: Status, Abschluss, Warnung, Fehler. Inline prüfen, nicht beim Absenden.
- Wegweisung: jeder Bildschirm beantwortet wo bin ich, wohin kann ich, was ist dort, wie komme ich raus.
- Direkte Beschriftungen statt sicherer Oberbegriffe. „Projekte“, nicht „Start“.
