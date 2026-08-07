-- AXON Studio, M1b: die eigenen Tabellen des Hubs.
--
-- Der Hub sattelt auf diesem Projekt auf (Entscheidung 07.08.2026, Free-Plan gewaehrt nur
-- zwei Projekte). Bestehende Tabellen bleiben unveraendert; das Praefix `hub_` haelt die
-- Grenze sichtbar, so wie dort `dti_`, `ucc_`, `doc_`, `excel_` und `aas_`.
--
-- Freischaltungen wohnen weiter in `user_tool_access`. Bewusst KEIN nachtraeglicher
-- Fremdschluessel von dort auf hub_apps: die Tools-Plattform schreibt in diese Tabelle,
-- und ein Fremdschluessel koennte ihre Schreibvorgaenge brechen. Die Kopplung ist
-- Verabredung, nicht Zwang.

-- --- profiles: gesperrt oder nicht ------------------------------------------------
alter table public.profiles
  add column if not exists status text not null default 'aktiv';

alter table public.profiles drop constraint if exists profiles_status_check;
alter table public.profiles
  add constraint profiles_status_check check (status in ('aktiv', 'gesperrt'));

-- --- hub_apps: der Katalog der Unterprogramme --------------------------------------
create table if not exists public.hub_apps (
  id text primary key,
  name text not null,
  kuerzel text not null,
  -- Mehr als 60 Zeichen bricht die Kachel um, deshalb steht die Grenze in der Datenbank.
  kurz text not null check (char_length(kurz) <= 60),
  akzent text not null default '#00A386' check (akzent ~ '^#[0-9A-Fa-f]{6}$'),
  -- Nullbar: die sieben Werkzeuge der Tools-Plattform haben heute keine eigene Adresse.
  url text,
  sortierung integer not null default 100,
  aktiv boolean not null default true,
  erstellt_am timestamptz not null default now(),
  geaendert_am timestamptz not null default now()
);

create trigger hub_apps_geaendert_am
  before update on public.hub_apps
  for each row execute function public.handle_updated_at();

-- --- hub_invitations: wer eingeladen wurde -----------------------------------------
create table if not exists public.hub_invitations (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  rolle text not null default 'user' check (rolle in ('user', 'admin')),
  apps text[] not null default '{}',
  eingeladen_von uuid references auth.users (id) on delete set null,
  eingeladen_am timestamptz not null default now(),
  angenommen_am timestamptz
);

create unique index if not exists hub_invitations_offen_je_email
  on public.hub_invitations (lower(email)) where angenommen_am is null;
create index if not exists hub_invitations_eingeladen_am
  on public.hub_invitations (eingeladen_am desc);

-- --- RLS ---------------------------------------------------------------------------
alter table public.hub_apps enable row level security;
alter table public.hub_invitations enable row level security;

create policy "Angemeldete lesen den Katalog"
  on public.hub_apps for select to authenticated using (true);

create policy "Admins verwalten Einladungen"
  on public.hub_invitations for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
