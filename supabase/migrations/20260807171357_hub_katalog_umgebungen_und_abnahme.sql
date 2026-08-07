-- Runde 3: der Katalog wird pflegbar, und ein Programm bekommt mehrere Umgebungen.
--
-- Bis heute entstand ein Eintrag nur per Migration und sein OAuth-Client nur ueber einen
-- Direktaufruf der Edge Function. Ein Hub, dessen Verwaltung an einer
-- Entwicklungsumgebung haengt, ist keine Verwaltung.

-- --- hub_apps waechst -------------------------------------------------------------
alter table public.hub_apps
  -- Fuer die Abnahme: unter welcher Adresse laeuft der Dienst, und wo meldet er sich
  -- gesund. Getrennt vom Kachelziel `url`, weil das auch auf eine Unterseite zeigen darf.
  add column if not exists basis_adresse text,
  add column if not exists gesundheitspfad text not null default '/api/health',
  /*
   * Was das Programm anfordern darf. Durchgesetzt wird das auf **unserer**
   * Zustimmungsseite, nicht am Server: `createClient` kennt kein Scope-Feld, ein Client
   * kann also technisch jeden der fuenf unterstuetzten Scopes verlangen. Der Katalog sagt,
   * was verabredet war, und die Zustimmungsseite zeigt Abweichungen.
   */
  add column if not exists scopes text[] not null default '{openid,email,profile}',
  -- Nur fuer eigene Programme aus diesem Haus. Kein Merkmal von Supabase: die
  -- Zustimmungsseite gehoert uns und kann selbst durchwinken.
  add column if not exists zustimmung_ueberspringen boolean not null default false,
  add column if not exists status text not null default 'entwurf',
  -- Was die Abnahme zuletzt gemessen hat.
  add column if not exists fassung text,
  add column if not exists zuletzt_geprueft timestamptz;

alter table public.hub_apps drop constraint if exists hub_apps_status_check;
alter table public.hub_apps
  add constraint hub_apps_status_check check (status in ('entwurf', 'aktiv', 'pruefen'));

-- Nur die fuenf, die der Server kennt. Gemessen am 07.08.2026: ein eigener Scope wird mit
-- `unsupported scope: ...` abgewiesen, die Anmeldung scheitert dann komplett.
alter table public.hub_apps drop constraint if exists hub_apps_scopes_check;
alter table public.hub_apps
  add constraint hub_apps_scopes_check
  check (scopes <@ array['openid', 'profile', 'email', 'phone', 'offline_access']::text[]);

-- --- hub_app_clients: je Umgebung ein eigener Client --------------------------------
/*
 * Ein Client je Umgebung, jeder mit eigenem Geheimnis. So empfiehlt es Supabase, und wir
 * brauchen es selbst schon: der AXON Editor hat einen Client fuer den Betrieb und einen
 * fuer die Entwicklung.
 *
 * Das **Geheimnis steht nicht hier**. Es wird beim Anlegen einmal ausgegeben und lebt
 * danach nur in den Diensteinstellungen des Unterprogramms.
 */
create table if not exists public.hub_app_clients (
  id uuid primary key default gen_random_uuid(),
  app_id text not null references public.hub_apps (id) on delete cascade,
  umgebung text not null check (umgebung in ('produktion', 'test', 'lokal')),
  oauth_client_id text not null unique,
  redirect_uri text not null,
  created_at timestamptz not null default now(),
  -- Eine Umgebung je Programm nur einmal: zwei "Produktion" waeren nicht zu unterscheiden.
  unique (app_id, umgebung)
);

create index if not exists hub_app_clients_app on public.hub_app_clients (app_id);

alter table public.hub_app_clients enable row level security;

-- Angemeldete duerfen lesen: die Zustimmungsseite schlaegt hier nach, wer da fragt, und
-- das muss jeder koennen, der gerade zustimmen soll.
create policy "Angemeldete lesen die Clients"
  on public.hub_app_clients for select to authenticated using (true);

create policy "Admins legen Clients an"
  on public.hub_app_clients for insert to authenticated
  with check ((select public.is_admin()));

create policy "Admins aendern Clients"
  on public.hub_app_clients for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

create policy "Admins loeschen Clients"
  on public.hub_app_clients for delete to authenticated
  using ((select public.is_admin()));
