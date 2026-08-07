-- Zwei Nachbesserungen am Rollenschutz, beide am selben Tag, beide durch Nachmessen
-- gefunden. Diese Datei traegt die Endfassung; der Weg dahin gehoert in die Akte.
--
-- 1. Die erste Fassung prueft nur `is_admin()`. Diese Funktion liest `auth.uid()`, und die
--    ist leer, sobald nicht ein angemeldeter Mensch schreibt, sondern der Server: der
--    `service_role`-Client der Edge Function `verwaltung`, eine Migration, ein Skript. Der
--    Schutz haette damit genau den Weg blockiert, ueber den eine Einladung mit der Rolle
--    `admin` angelegt wird, und zwar erst zur Laufzeit. Aufgefallen beim Anlegen der
--    Probezugaenge: `execute_sql` laeuft als `postgres` und lief in dieselbe Sperre.
--
-- 2. Die Abhilfe, `current_user` abzufragen, war unter SECURITY DEFINER wirkungslos: dort
--    ist `current_user` der **Eigentuemer** (postgres), nicht der Aufrufer. Die Ausnahme
--    griff immer, und der Schutz war faktisch abgeschaltet. Nachgemessen: ein normaler
--    Nutzer konnte sich wieder selbst zum Admin machen.
--
-- SECURITY INVOKER loest beides. Die Funktion braucht kein DEFINER: sie liest keine
-- Tabelle, sondern nur OLD und NEW; die Rollenfrage beantwortet `public.is_admin()`, das
-- seinerseits DEFINER ist. Damit ist `current_user` der wirkliche Aufrufer, und die Grenze
-- verlaeuft dort, wo sie hingehoert.
--
-- Belegt mit vier Faellen: Nutzer abgewiesen, Nutzer darf weiter seinen Namen aendern,
-- Admin darf, Dienst darf.
create or replace function public.schuetze_rolle_und_status()
  returns trigger
  language plpgsql
  security invoker
  set search_path = ''
as $$
declare
  darf boolean := public.is_admin()
    or current_user in ('postgres', 'supabase_admin', 'supabase_auth_admin', 'service_role');
begin
  if new.role is distinct from old.role and not darf then
    raise exception 'Die Rolle darf nur ein Administrator aendern.' using errcode = '42501';
  end if;
  if new.status is distinct from old.status and not darf then
    raise exception 'Den Status darf nur ein Administrator aendern.' using errcode = '42501';
  end if;
  return new;
end;
$$;
