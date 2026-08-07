-- Postgres vergibt EXECUTE auf jede neue Funktion an PUBLIC. Ein Entzug an `anon` und
-- `authenticated` allein wirkt deshalb nicht: beide erben von PUBLIC. Der Advisor meldete
-- handle_new_user danach unveraendert.
--
-- handle_new_user ist eine Triggerfunktion. Trigger laufen nicht mit dem EXECUTE-Recht des
-- Aufrufers, der Entzug ist folgenlos und schliesst den Weg ueber /rest/v1/rpc.
revoke execute on function public.handle_new_user() from public;

-- is_admin() bleibt bewusst offen. RLS-Ausdruecke werden mit der Rolle des Fragenden
-- ausgewertet, und die bestehenden Policies der Tools-Plattform stehen auf der Rolle
-- `public`, also einschliesslich `anon`. Ein Entzug machte aus einer leeren Antwort einen
-- Fehler, und zwar in einer Anwendung, die hier ausdruecklich nicht angefasst wird.
-- Preisgegeben wird nichts: ohne Anmeldung ist auth.uid() null und die Funktion liefert
-- false. Der Advisor bleibt an dieser Stelle also mit Absicht gelb.
