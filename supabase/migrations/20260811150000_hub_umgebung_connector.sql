/*
 * Eine vierte Umgebung: `connector`.
 *
 * Anlass ist der MCP-Zugang des AXON Editors. claude.ai verbindet sich mit ihm als
 * eigener OAuth-Client, mit eigener Rueckleitung auf `claude.ai` und eigenem Geheimnis,
 * das ein Nutzer in den Verbindungsdialog eintraegt. Das ist keine Produktion und keine
 * Entwicklung des Programms selbst, sondern ein fremder Klient, der auf dasselbe Programm
 * zeigt.
 *
 * Ohne einen eigenen Wert bliebe nur, ihn als "test" einzutragen. Der Eintrag stimmte
 * dann formal und waere trotzdem falsch: `umgebung` ist genau die Spalte, an der spaeter
 * jemand ablesen soll, wozu ein Client gehoert, und ein als Test gefuehrter Zugang, der
 * in Wahrheit der Weg von aussen ist, kostet diese Auskunft.
 *
 * Nur eine Erweiterung der Positivliste. Bestehende Zeilen sind unberuehrt, die
 * Eindeutigkeit je (app_id, umgebung) gilt unveraendert.
 */
alter table public.hub_app_clients
  drop constraint if exists hub_app_clients_umgebung_check;

alter table public.hub_app_clients
  add constraint hub_app_clients_umgebung_check
  check (umgebung in ('produktion', 'test', 'lokal', 'connector'));
