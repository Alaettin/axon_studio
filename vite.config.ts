import { fileURLToPath, URL } from "node:url";

import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

import pkg from "./package.json" with { type: "json" };

export default defineConfig({
  // Die Fassung steht in genau einer Datei. Ein Import der package.json im
  // Komponentencode buendelte die ganze Abhaengigkeitsliste mit.
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  plugins: [react(), tailwindcss()],
  build: { target: "es2022" },
  server: { port: 5274 },
});
