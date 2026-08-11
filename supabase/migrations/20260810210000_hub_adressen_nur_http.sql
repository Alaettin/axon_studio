-- Adressen im Katalog tragen ein Schema, und zwar http oder https.
--
-- Befund 3 des Sicherheitsaudits vom 10.08.2026. `hub_apps.url` geht ungeprueft in ein
-- `href` (Kachel.tsx) und in `window.location.assign` (Palette.tsx). Ohne Regel koennte
-- dort `javascript:…` stehen: ein Administrator fuehrte damit Code im Browser jedes
-- Nutzers aus, der die Kachel anklickt. Das ist eine Grenze, die sonst haelt, ein
-- Administrator vergibt Rechte und nimmt Programme auf, aber er kommt nicht in die Sitzung
-- eines anderen.
--
-- `basis_adresse` bekommt dieselbe Regel: sie wird von der Abnahme serverseitig abgerufen.
--
-- Vorbild ist `hub_apps_akzent_check`: derselbe Gedanke fuer die Farbe, die in ein
-- `style`-Attribut geht. Deshalb ein CHECK und keine Pruefung im Code allein.
--
-- NULL bleibt erlaubt: eine leere Adresse der Kachel heisst "nimm die Basis-Adresse".

alter table public.hub_apps
  add constraint hub_apps_url_check
    check (url is null or url ~ '^https?://'),
  add constraint hub_apps_basis_adresse_check
    check (basis_adresse is null or basis_adresse ~ '^https?://');
