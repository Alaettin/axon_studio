/*
 * Organisationen (07.09.2026).
 *
 * Der Hub kannte bisher nur einzelne Nutzer, und die Unterprogramme muessen daraus schliessen,
 * dass jeder fuer sich arbeitet: der AXON Connector legt bei der ersten Anmeldung einen
 * Arbeitsbereich je Nutzer an. Wer gehoert zusammen, ist aber eine Aussage ueber Identitaet und
 * gehoert damit hierher, nicht in jedes Programm.
 *
 * **`profiles` bleibt unberuehrt**, und das ist der Grund fuer die Mitgliedertabelle statt einer
 * Spalte am Profil: die Tabelle ist mit der AAS Tools Platform geteilt, und die Policy „Nutzer
 * duerfen ihre eigene Zeile aendern" gilt fuer jede Spalte darin. Eine Zugehoerigkeit dort waere
 * Selbstbedienung, und der Trigger muesste sie wieder einfangen. Hier schreibt von vornherein
 * nur ein Administrator.
 */

create table if not exists public.hub_organisationen (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  angelegt_am timestamptz not null default now(),
  angelegt_von uuid references auth.users (id) on delete set null
);

-- Zweimal "Neoception" mit unterschiedlicher Schreibweise waeren zwei Organisationen, die
-- aussehen wie eine. Der Index entscheidet das, nicht die Oberflaeche.
create unique index if not exists hub_organisationen_name_eindeutig
  on public.hub_organisationen (lower(name));

/*
 * Der Fremdschluessel auf den Urheber braucht einen eigenen Index. Nicht fuers Lesen: er wird
 * gebraucht, wenn ein Nutzer geloescht wird und Postgres alle Zeilen sucht, die auf ihn zeigen.
 * Ohne ihn meldet der Advisor einen ungedeckten Fremdschluessel, und der hat recht.
 */
create index if not exists hub_organisationen_urheber
  on public.hub_organisationen (angelegt_von);

create table if not exists public.hub_organisation_mitglieder (
  organisation_id uuid not null references public.hub_organisationen (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  rolle text not null default 'mitglied' check (rolle in ('mitglied', 'verwalter')),
  seit timestamptz not null default now(),
  primary key (organisation_id, user_id)
);

/*
 * Der Primaerschluessel deckt die Suche nach der Organisation ab, nicht die nach dem Nutzer.
 * Genau die laeuft aber bei jeder Anmeldung eines Unterprogramms.
 */
create index if not exists hub_organisation_mitglieder_nutzer
  on public.hub_organisation_mitglieder (user_id);

alter table public.hub_organisationen enable row level security;
alter table public.hub_organisation_mitglieder enable row level security;

-- Namen von Organisationen sind im Hub keine Verschlusssache: wer angemeldet ist, darf sie
-- lesen. Anlegen, umbenennen und loeschen bleibt bei den Administratoren.
create policy "Angemeldete lesen Organisationen"
  on public.hub_organisationen for select to authenticated using (true);

create policy "Admins legen Organisationen an"
  on public.hub_organisationen for insert to authenticated
  with check ((select public.is_admin()));

create policy "Admins aendern Organisationen"
  on public.hub_organisationen for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

create policy "Admins loeschen Organisationen"
  on public.hub_organisationen for delete to authenticated
  using ((select public.is_admin()));

/*
 * Beim Lesen der Mitgliedschaften bewusst **nur die eigenen Zeilen** oder alles fuer
 * Administratoren. Eine Policy „alle Zeilen meiner Organisation" fragte dieselbe Tabelle ab,
 * ueber die sie entscheidet, und blockierte sich; das ist derselbe Grund, aus dem `is_admin()`
 * eine SECURITY-DEFINER-Funktion ist. Wer die Mitglieder einer Organisation braucht, bekommt sie
 * ueber die Edge Function.
 */
create policy "Eigene Mitgliedschaften und Admins"
  on public.hub_organisation_mitglieder for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));

/*
 * Schreiben in drei Policies statt in einem `for all`. Ein `for all` deckt auch SELECT ab, und
 * zwei permissive Policies auf derselben Handlung werden bei jeder Zeile beide ausgewertet.
 * Genau das stand am 07.08.2026 schon einmal im Advisor.
 */
create policy "Admins nehmen Mitglieder auf"
  on public.hub_organisation_mitglieder for insert to authenticated
  with check ((select public.is_admin()));

create policy "Admins aendern Mitgliedschaften"
  on public.hub_organisation_mitglieder for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

create policy "Admins entfernen Mitglieder"
  on public.hub_organisation_mitglieder for delete to authenticated
  using ((select public.is_admin()));

comment on table public.hub_organisation_mitglieder is
  'Wer gehoert zusammen. Die Unterprogramme fragen das ueber die Edge Function `konto`, Handlung `organisationen`.';
