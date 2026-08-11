# syntax=docker/dockerfile:1

# Bauen und Ausliefern getrennt: das Ergebnis sind statische Dateien, Node wird nur zum
# Bauen gebraucht und hat im laufenden Abbild nichts zu suchen.

FROM node:22-alpine AS build
RUN corepack enable
WORKDIR /app

# Erst die Manifeste, dann der Rest: solange sich die Abhaengigkeiten nicht aendern, kommt
# diese Schicht aus dem Zwischenspeicher.
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .

# Die beiden VITE_-Werte muessen **zur Bauzeit** dastehen: Vite setzt sie fest ein, es gibt
# zur Laufzeit nichts mehr zu ersetzen. Sie stehen in `.env.production` im Repo, und das
# ist kein Versehen: die Adresse und der publizierbare Schluessel liegen ohnehin in jedem
# ausgelieferten Buendel. Der `service_role`-Schluessel ist nicht dabei und darf es nie
# sein, er lebt in den Secrets der Edge Function.
RUN pnpm build

# --- Auslieferung ---
#
# **nginx-unprivileged, nicht nginx.** Das gewoehnliche Abbild startet seinen Hauptprozess
# als root; dieses laeuft durchgehend als uid 101 und lauscht von Haus aus auf 8080, also
# genau dem Port, den die Konfiguration ohnehin setzt. Ein Abbild, das nur statische
# Dateien ausliefert, braucht keine Rechte.
FROM nginxinc/nginx-unprivileged:1.29-alpine AS laufzeit

# Die Vorgabekonfiguration kennt keinen SPA-Rueckfall. `-f`, weil sie je nach Abbild
# fehlen darf und ein fehlender Loeschversuch kein Baufehler sein soll.
RUN rm -f /etc/nginx/conf.d/default.conf
COPY docker/nginx.conf /etc/nginx/conf.d/hub.conf
# **Nicht** nach conf.d: alles dort wird von nginx selbst in den http-Block eingebunden,
# und die Koepfe stuenden dann zweimal an zwei Ebenen.
COPY docker/sicherheitskopf.conf /etc/nginx/sicherheitskopf.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 8080

# Das Abbild setzt uid 101 bereits selbst, und `docker exec … id` bestaetigt es. Die Zeile
# steht trotzdem hier: sie ist die einzige Stelle, an der **im Text** steht, dass hier
# nichts als root laeuft. Ohne sie ist die Aussage nur eine Messung, die niemand
# wiederholt, und semgrep meldet die Datei weiter.
USER nginx

# nginx im Vordergrund, sonst beendet sich der Container sofort.
CMD ["nginx", "-g", "daemon off;"]
