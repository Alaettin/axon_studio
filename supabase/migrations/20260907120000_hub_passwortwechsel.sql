/*
 * Zugang mit Startpasswort statt Einladungslink (07.09.2026).
 *
 * Der Einladungslink hing an der Site URL des Projekts, und die gehoert der AAS Tools
 * Platform: fiel Supabase darauf zurueck, landete der Eingeladene in einer fremden
 * Anwendung. Ein Konto entsteht jetzt sofort, mit einem Startpasswort, das der Nutzer bei
 * der ersten Anmeldung wechseln muss.
 *
 * `profiles` ist mit der Tools Platform geteilt, deshalb additiv mit Vorgabewert: eine
 * Spalte, die niemand kennt, aendert dort nichts.
 */

alter table public.profiles
  add column if not exists passwortwechsel_faellig boolean not null default false;

comment on column public.profiles.passwortwechsel_faellig is
  'Der Nutzer traegt noch sein Startpasswort. Gesetzt beim Anlegen und beim Zuruecksetzen, geloescht von der Edge Function `konto`, wenn das Passwort wirklich gewechselt wurde.';

/*
 * Die Marke gehoert zu den Spalten, die ihr Traeger nicht selbst anfassen darf.
 *
 * RLS kennt keine Spaltenbedingung: "Users can update own profile" prueft nur, welche
 * Zeile geaendert wird. Ohne diese Zeile raeumte der Nutzer den Zwang mit einem
 * `PATCH /profiles?id=eq.<self> {"passwortwechsel_faellig":false}` selbst weg.
 *
 * SECURITY INVOKER bleibt, und zwar zwingend: unter DEFINER ist `current_user` der
 * Eigentuemer der Funktion, und die Ausnahme fuer den Dienst waere wirkungslos. Das war
 * schon einmal der Fehler, siehe `20260807131500_hub_rollenschutz_security_invoker.sql`.
 */
create or replace function public.schuetze_rolle_und_status()
  returns trigger
  language plpgsql
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
  if new.email is distinct from old.email and not darf then
    raise exception 'Die E-Mail-Adresse darf nur ein Administrator aendern.' using errcode = '42501';
  end if;
  if new.passwortwechsel_faellig is distinct from old.passwortwechsel_faellig and not darf then
    raise exception 'Den Passwortwechsel darf nur ein Administrator aendern.' using errcode = '42501';
  end if;
  return new;
end;
$$;

/*
 * Der Index beschreibt eine offene Einladung, und die gibt es nicht mehr: das Konto steht
 * mit dem Anlegen. Solange er da war, blockierte er jede zweite Zeile je Adresse, und weil
 * der Insert-Fehler in der Edge Function verschluckt wurde, fiel das nie auf.
 * `hub_invitations` ist damit reine Historie und darf je Adresse mehrere Zeilen tragen.
 */
drop index if exists public.hub_invitations_offen_je_email;
