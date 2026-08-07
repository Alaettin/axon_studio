-- AXON Studio, M1a: die drei bestehenden Funktionen bekommen einen festen search_path.
--
-- Anlass: der Hub stellt seine ganze Rechtepruefung auf public.is_admin(). Eine
-- SECURITY-DEFINER-Funktion ohne festen search_path ist ein Weg zur Rechteausweitung:
-- wer den search_path des Aufrufers setzt, kann bestimmen, welche "profiles" die
-- Funktion liest. Der Advisor meldete das seit jeher als function_search_path_mutable.
--
-- Kein Verhaltenswechsel: die Rumpfe sind identisch, nur vollstaendig schemaqualifiziert.
-- Die EXECUTE-Rechte von is_admin() bleiben, wie sie sind: RLS-Ausdruecke werden mit der
-- Rolle des Fragenden ausgewertet, ein Entzug von `authenticated` braeche jede Policy,
-- die die Funktion benutzt.

create or replace function public.is_admin()
  returns boolean
  language sql
  security definer
  set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'admin'
  );
$$;

create or replace function public.handle_updated_at()
  returns trigger
  language plpgsql
  set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.handle_new_user()
  returns trigger
  language plpgsql
  security definer
  set search_path = ''
as $$
begin
  insert into public.profiles (id, email, display_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)),
    case when new.email = 'alaettin87@gmail.com' then 'admin' else 'user' end
  );
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from anon, authenticated;
