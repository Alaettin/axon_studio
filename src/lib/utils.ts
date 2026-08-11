import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Ein Weg aus der Adresszeile, auf das eigene Programm eingegrenzt.
 *
 * `?weiter=` sagt der Anmeldung, wohin es danach geht, und der Wert kommt aus der Adresse,
 * also von aussen. React Router behandelt eine vollstaendige Adresse als Pfad, **aber zwei
 * fuehrende Schraegstriche ergeben einen protokollrelativen Pfad**, den der Browser als
 * fremde Adresse aufloest: `/anmeldung?weiter=//boesewicht.invalid` fuehrte nach
 * erfolgreicher Anmeldung auf eine fremde Seite, die dieselbe Maske nachbaut.
 *
 * Geprueft wird beim **Verbrauchen**, nicht an den Stellen, die den Wert setzen. Wer ihn
 * setzt, kann wechseln; wer ihn benutzt, ist die eine Stelle, an der er wirkt.
 */
export function nurEigenerPfad(wert: string | null | undefined): string {
  if (!wert?.startsWith("/")) return "/";
  // `//host` ist protokollrelativ, `/\host` behandeln Browser genauso. Beides ist kein
  // eigener Weg mehr.
  if (wert.startsWith("//") || wert.startsWith("/\\")) return "/";
  return wert;
}
