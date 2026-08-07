-- Die Zustimmungsseite soll sagen, **wer** fragt.
--
-- `getAuthorizationDetails` liefert dazu nichts: das Feld `client` enthaelt genau eine
-- Kennung und keinen Namen (nachgemessen am 07.08.2026 an der rohen Antwort:
--   { authorization_id, redirect_uri, client: { id }, user: { id, email }, scope } ).
-- Die Seite sagte deshalb "Ein Programm moechte auf dein Konto zugreifen", und eine
-- Zustimmungsseite, die den Fragenden nicht benennt, ist der schwaechste Teil eines
-- Anmeldewegs.
--
-- Der Hub kennt seine Programme selbst, ihm fehlte nur die Verbindung zur Client-Kennung.
-- `unique`, weil ein OAuth-Client zu genau einem Programm gehoert.
--
-- Was **nicht** hierher gehoert: das Client-Geheimnis. Es wird beim Anlegen einmal
-- ausgegeben und lebt danach nur in den Diensteinstellungen des Unterprogramms.
alter table public.hub_apps
  add column if not exists oauth_client_id text;

create unique index if not exists hub_apps_oauth_client_id
  on public.hub_apps (oauth_client_id)
  where oauth_client_id is not null;

-- Der AXON Editor, registriert am 07.08.2026.
update public.hub_apps
   set oauth_client_id = '352122ca-57bc-46f7-97c5-0dc216cef6e9'
 where id = 'aas-editor';
