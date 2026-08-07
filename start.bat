@echo off
setlocal
cd /d "%~dp0"

echo ====================================
echo  AXON Studio: Entwicklungsumgebung
echo ====================================
echo.

where pnpm >nul 2>&1
if errorlevel 1 (
  echo FEHLER: pnpm wurde nicht gefunden. Erst "corepack enable" ausfuehren.
  pause
  exit /b 1
)

rem Die .env traegt Adresse und oeffentlichen Schluessel des Supabase-Projekts. Die Vorlage
rem enthaelt nur Platzhalter: damit startet die Anwendung zwar, aber jede Abfrage laeuft ins
rem Leere, und das sieht nach einem Netzwerkproblem aus. Deshalb hier anhalten statt
rem weiterlaufen.
if not exist ".env" (
  copy /y ".env.example" ".env" >nul
  echo .env hat gefehlt und wurde aus .env.example angelegt.
  echo.
  echo Darin muessen jetzt zwei Werte stehen, beide aus dem Supabase-Projekt
  echo acbkhrfzeyixxdbcbnah ^(Settings, API^):
  echo.
  echo   VITE_SUPABASE_URL
  echo   VITE_SUPABASE_PUBLISHABLE_KEY
  echo.
  echo Der service_role-Schluessel gehoert NICHT hierher. Er lebt in den Secrets
  echo der Edge Function und wuerde als VITE_-Variable mit ausgeliefert.
  echo.
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo Abhaengigkeiten werden installiert, das dauert einen Moment ...
  call pnpm install
  if errorlevel 1 (
    echo FEHLER: pnpm install ist fehlgeschlagen.
    pause
    exit /b 1
  )
  echo.
)

rem Der Hub sattelt auf dem Projekt der AAS Tools Platform auf. Es gibt keine lokale
rem Datenbank und keinen eigenen Server: eine Flaeche, ein Port.
echo Hinweis: die Anwendung spricht mit dem echten Supabase-Projekt.
echo Aenderungen an Rollen und Freischaltungen wirken sofort und fuer alle.
echo.

echo Anwendung startet auf http://localhost:5274
start "AXON Studio" cmd /k "cd /d "%~dp0" && pnpm dev"

echo.
echo Das Fenster laeuft weiter. Zum Beenden dort Strg+C.
echo Der Browser oeffnet gleich die Anmeldung.
rem Fuenf Sekunden warten. Bewusst ping und nicht "timeout /t": timeout bricht mit
rem "Die Eingabeumleitung wird nicht unterstuetzt" ab, sobald stdin umgeleitet ist,
rem also aus jedem Skript heraus. Beim Doppelklick faellt das nie auf.
ping -n 6 127.0.0.1 >nul
start "" "http://localhost:5274"

endlocal
