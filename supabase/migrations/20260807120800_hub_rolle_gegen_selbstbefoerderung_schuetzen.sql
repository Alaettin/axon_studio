-- Rechteausweitung, gefunden am 07.08.2026 beim Nachmessen der RLS fuer AXON Studio.
--
-- Die Policy "Users can update own profile" prueft nur, WELCHE Zeile geaendert wird
-- (auth.uid() = id), nicht WELCHE Spalten. Jeder der 16 Nutzer konnte damit
--   PATCH /rest/v1/profiles?id=eq.<eigene-id>  {"role":"admin"}
-- schicken und war Administrator. RLS kennt keine Spaltenbedingung: WITH CHECK sieht nur
-- die neue Zeile, nicht den Unterschied zur alten. Deshalb ein Trigger.
--
-- Spaltenrechte (revoke update (role) ...) waeren die andere Loesung, sie scheitern hier:
-- Admins sind ebenfalls `authenticated` und muessen Rollen setzen duerfen.
--
-- Es wird laut abgewiesen, nicht still zurueckgesetzt. Die Bedingung greift nur bei einer
-- echten Aenderung (`is distinct from`), ein Client, der die unveraenderte Zeile
-- zuruecksendet, laeuft also nicht hinein.

create or replace function public.schuetze_rolle_und_status()
  returns trigger
  language plpgsql
  security definer
  set search_path = ''
as $$
begin
  if new.role is distinct from old.role and not public.is_admin() then
    raise exception 'Die Rolle darf nur ein Administrator aendern.'
      using errcode = '42501';
  end if;
  if new.status is distinct from old.status and not public.is_admin() then
    raise exception 'Den Status darf nur ein Administrator aendern.'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

revoke execute on function public.schuetze_rolle_und_status() from public;

drop trigger if exists profiles_schuetze_rolle_und_status on public.profiles;
create trigger profiles_schuetze_rolle_und_status
  before update on public.profiles
  for each row execute function public.schuetze_rolle_und_status();
