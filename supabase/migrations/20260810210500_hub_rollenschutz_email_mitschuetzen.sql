-- Die E-Mail-Adresse gehoert zu den Spalten, die nur ein Administrator aendert.
--
-- Befund 4 des Sicherheitsaudits vom 10.08.2026, und derselbe Fehler wie am 07.08. bei
-- `role`: **RLS kennt keine Spaltenbedingung.** Die Policy "Users can update own profile"
-- prueft nur, *welche* Zeile geschrieben wird, nicht *welche Spalten*. Der Trigger deckte
-- `role` und `status` ab, `email` blieb offen.
--
-- Warum das zaehlt: die Nutzerverwaltung zeigt `profiles.email` (die Edge Function reicht
-- die Profilzeile durch und ergaenzt nur `last_sign_in_at`). Ein Nutzer konnte sich dort
-- als jemand anderes darstellen, und der Administrator vergibt Rechte anhand dessen, was
-- er sieht. Keine Rechteausweitung, aber eine Taeuschung genau der Person, die entscheidet.
--
-- Nachgesehen, bevor die Regel kam: **niemand schreibt `profiles.email`.** Der Hub
-- schreibt `role` und `display_name`, die AAS Tools Platform nur `role` und
-- Freischaltungen, und auf `auth.users` sitzt allein `on_auth_user_created`, es gibt also
-- keine Synchronisierung, die dagegenliefe.
--
-- **SECURITY INVOKER bleibt.** Unter SECURITY DEFINER waere `current_user` der Eigentuemer
-- und nicht der Aufrufer; die Ausnahme "der Dienst darf" griffe dann immer und schaltete
-- den Schutz faktisch ab. Das ist die Stolperfalle vom 07.08.2026, sie gilt hier
-- unveraendert.

create or replace function public.schuetze_rolle_und_status()
returns trigger
language plpgsql
set search_path to ''
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
  if new.email is distinct from old.email and not darf then
    raise exception 'Die E-Mail-Adresse darf nur ein Administrator aendern.' using errcode = '42501';
  end if;
  return new;
end;
$$;
