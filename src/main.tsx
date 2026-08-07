import { StrictMode, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Navigate, Route, Routes } from "react-router";

import { AnmeldungRoute } from "@/routes/AnmeldungRoute";
import { BuehneRoute } from "@/routes/BuehneRoute";
import { PasswortSetzenRoute } from "@/routes/PasswortSetzenRoute";
import { ProfilRoute } from "@/routes/ProfilRoute";
import { NutzerRoute } from "@/routes/verwaltung/NutzerRoute";
import { BrauchtAdmin, BrauchtAnmeldung, NichtGesperrt } from "@/routes/Waechter";
import { ZustimmungRoute } from "@/routes/ZustimmungRoute";
import { beobachteSichtbarkeit } from "@/lib/supabase";
import { useSitzung } from "@/store/sitzung";
import "@/styles/tokens.css";

function App() {
  const starte = useSitzung((z) => z.starte);

  useEffect(() => {
    const endeSitzung = starte();
    const endeSichtbarkeit = beobachteSichtbarkeit();
    return () => {
      endeSitzung();
      endeSichtbarkeit();
    };
  }, [starte]);

  return (
    <Routes>
      <Route path="/anmeldung" element={<AnmeldungRoute />} />
      <Route path="/passwort-setzen" element={<PasswortSetzenRoute />} />
      {/*
        Die Zustimmungsseite steht bewusst ausserhalb von NichtGesperrt: sie prueft die
        Anmeldung selbst und leitet sonst mit der authorization_id zur Anmeldung, damit die
        Anfrage den Umweg ueberlebt.
      */}
      <Route path="/zustimmung" element={<ZustimmungRoute />} />

      <Route
        path="/"
        element={
          <BrauchtAnmeldung>
            <NichtGesperrt>
              <BuehneRoute />
            </NichtGesperrt>
          </BrauchtAnmeldung>
        }
      />
      <Route
        path="/profil"
        element={
          <BrauchtAnmeldung>
            <NichtGesperrt>
              <ProfilRoute />
            </NichtGesperrt>
          </BrauchtAnmeldung>
        }
      />
      <Route
        path="/verwaltung/nutzer"
        element={
          <BrauchtAnmeldung>
            <NichtGesperrt>
              <BrauchtAdmin>
                <NutzerRoute />
              </BrauchtAdmin>
            </NichtGesperrt>
          </BrauchtAnmeldung>
        }
      />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

const wurzel = document.getElementById("root");
if (!wurzel) throw new Error("Das Wurzelelement #root fehlt in index.html.");

createRoot(wurzel).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
