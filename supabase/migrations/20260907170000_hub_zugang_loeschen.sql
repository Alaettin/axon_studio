/*
 * Zugaenge vollstaendig loeschen (07.09.2026).
 *
 * Das Loeschen ist hier kein `delete`, sondern ein Lawinenabgang: **dreizehn Tabellen** haengen
 * mit `on delete cascade` an `auth.users`, und zwoelf davon gehoeren der AAS Tools Platform, die
 * diese Anwendung ausdruecklich nicht anfasst. Eine Tabelle sperrt zudem
 * (`doc_manuals.created_by` steht auf `no action`), und ihr Fehler wird in GoTrue zu einem
 * unverstaendlichen Datenbankfehler.
 *
 * Deshalb zuerst eine Vorschau, und zwar eine **abgeleitete**: die Fremdschluessel sind genau
 * das, was beim Loeschen passiert. Eine gepflegte Liste im Code waere schon falsch, sobald die
 * Tools-Plattform eine Tabelle ergaenzt, und sie waere still falsch.
 */

alter table public.hub_invitations
  add column if not exists geloescht_am timestamptz,
  add column if not exists geloescht_von uuid references auth.users(id) on delete set null;

comment on column public.hub_invitations.geloescht_am is
  'Wann der Zugang entfernt wurde. Die Tabelle fuehrt damit die Geschichte eines Zugangs von der Anlage bis zum Ende.';

/*
 * Was haengt an diesem Zugang?
 *
 * `faellt_weg` sind die Cascade-Fremdschluessel: diese Zeilen verschwinden mit. Das Schema `auth`
 * bleibt draussen, Sitzungen und Identitaeten sind Innenleben und keine Daten, ueber die jemand
 * entscheiden will.
 * `blockiert` sind die uebrigen (`no action`, `restrict`): solange dort Zeilen stehen, weist
 * Postgres das Loeschen ab.
 *
 * SECURITY DEFINER, weil sie ueber Tabellen zaehlt, die anderen gehoeren. Die Rechtepruefung
 * kann deshalb **nicht** ueber `current_user` laufen, der ist hier drin der Eigentuemer; sie
 * liest die Rolle aus dem Token. Das ist derselbe Fehler, der schon einmal einen Schutz
 * wirkungslos gemacht hat, siehe `20260807131500_hub_rollenschutz_security_invoker.sql`.
 */
create or replace function public.hub_loeschvorschau(kennung uuid)
  returns jsonb
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  faellt_weg jsonb := '[]'::jsonb;
  blockiert jsonb := '[]'::jsonb;
  zeile record;
  anzahl bigint;
begin
  /*
   * Wer darf fragen: ein Administrator, der Dienst, oder eine Sitzung an der Datenbank selbst
   * (`auth.role()` ist dann leer, und wer dort sitzt, kann ohnehin alles). Die eigentliche
   * Schranke ist das EXECUTE-Recht unten, das hier ist die zweite Reihe.
   */
  if not public.is_admin() and coalesce(auth.role(), 'direkt') not in ('service_role', 'direkt') then
    raise exception 'Nur fuer Administratoren.' using errcode = '42501';
  end if;

  for zeile in
    select n.nspname as schema, c.relname as tabelle, a.attname as spalte, con.confdeltype as art
    from pg_constraint con
    join pg_class c on c.oid = con.conrelid
    join pg_namespace n on n.oid = c.relnamespace
    join lateral unnest(con.conkey) as k(attnum) on true
    join pg_attribute a on a.attrelid = con.conrelid and a.attnum = k.attnum
    where con.contype = 'f'
      and con.confrelid = 'auth.users'::regclass
      and array_length(con.conkey, 1) = 1
      and n.nspname <> 'auth'
    order by c.relname
  loop
    -- `format` mit %I, nicht Zeichenketten aneinandergehaengt: der Name kommt zwar aus dem
    -- Katalog und nicht von aussen, aber die Gewohnheit ist die halbe Miete.
    execute format('select count(*) from %I.%I where %I = $1', zeile.schema, zeile.tabelle, zeile.spalte)
      into anzahl using kennung;

    if anzahl = 0 then
      continue;
    elsif zeile.art = 'c' then
      faellt_weg := faellt_weg || jsonb_build_object('tabelle', zeile.tabelle, 'anzahl', anzahl);
    elsif zeile.art in ('a', 'r') then
      blockiert := blockiert || jsonb_build_object('tabelle', zeile.tabelle, 'anzahl', anzahl);
    end if;
  end loop;

  return jsonb_build_object('faellt_weg', faellt_weg, 'blockiert', blockiert);
end;
$$;

/*
 * Aufrufen darf sie nur der Dienst, also die Edge Function. Der Entzug muss `from public` lauten:
 * Postgres vergibt EXECUTE an PUBLIC, und `anon` wie `authenticated` erben davon. Nur diesen
 * beiden das Recht zu nehmen, laesst es stehen (gemessen am 07.08.2026 am Advisor).
 */
revoke execute on function public.hub_loeschvorschau(uuid) from public;
grant execute on function public.hub_loeschvorschau(uuid) to service_role;
