/*
 * Die Rolle in einer Organisation faellt weg (07.09.2026).
 *
 * Es gab `mitglied` und `verwalter`. Ausgewertet hat sie niemand: fuenf Fundstellen im Repo,
 * alle Anzeige oder Pruefbedingung. Eine Oberflaeche, die eine Unterscheidung anbietet, die
 * keine ist, verspricht mehr, als der Hub haelt, und die Unterprogramme bekaemen ein Feld
 * geliefert, auf das sie nichts stuetzen koennen.
 *
 * Sie kommt wieder, wenn ein Programm ihr eine Bedeutung gibt. Bis dahin gilt: wer in einer
 * Organisation ist, ist darin, ohne Abstufung.
 *
 * **Reihenfolge beim Ausrollen:** erst die Edge Functions `konto` und `verwaltung` ohne
 * `rolle`, dann diese Migration. Andersherum liest eine laufende Funktion eine Spalte, die es
 * nicht mehr gibt, und die Nutzerliste faellt aus.
 */

alter table public.hub_organisation_mitglieder drop column if exists rolle;
