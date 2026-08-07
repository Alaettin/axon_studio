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
FROM nginx:1.29-alpine AS laufzeit

# Die Vorgabekonfiguration lauscht auf 80 und kennt keinen SPA-Rueckfall.
RUN rm /etc/nginx/conf.d/default.conf
COPY docker/nginx.conf /etc/nginx/conf.d/hub.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 8080

# nginx im Vordergrund, sonst beendet sich der Container sofort.
CMD ["nginx", "-g", "daemon off;"]
