-- Zwei Hinweise des Performance-Advisors, beide selbst verursacht.
--
-- 1. `Admins pflegen den Katalog` stand auf FOR ALL und deckte damit auch SELECT ab. Zusammen
--    mit der Lesepolicy waren das zwei permissive Policies fuer dieselbe Aktion, die Postgres
--    bei jeder Zeile beide auswertet. Lesen darf ohnehin jeder Angemeldete, also braucht der
--    Admin dort keine eigene Policy: sie deckt nur noch das Schreiben ab.
drop policy if exists "Admins pflegen den Katalog" on public.hub_apps;

create policy "Admins legen Programme an"
  on public.hub_apps for insert to authenticated
  with check ((select public.is_admin()));

create policy "Admins aendern Programme"
  on public.hub_apps for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

create policy "Admins loeschen Programme"
  on public.hub_apps for delete to authenticated
  using ((select public.is_admin()));

-- 2. Der Fremdschluessel auf auth.users hatte keinen deckenden Index. Ohne ihn wird das
--    Loeschen eines Nutzers zu einem Full Scan ueber die Einladungen.
create index if not exists hub_invitations_eingeladen_von
  on public.hub_invitations (eingeladen_von);
