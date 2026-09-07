import { StrictMode, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Navigate, Route, Routes } from "react-router";

import { AnmeldungRoute } from "@/routes/AnmeldungRoute";
import { BuehneRoute } from "@/routes/BuehneRoute";
import { PasswortSetzenRoute } from "@/routes/PasswortSetzenRoute";
import { ProfilRoute } from "@/routes/ProfilRoute";
import { AufnahmeRoute } from "@/routes/verwaltung/aufnahme/AufnahmeRoute";
import { KatalogRoute } from "@/routes/verwaltung/KatalogRoute";
import { NutzerRoute } from "@/routes/verwaltung/NutzerRoute";
import { OrganisationenRoute } from "@/routes/verwaltung/OrganisationenRoute";
import {
  BrauchtAdmin,
  BrauchtAnmeldung,
  BrauchtPasswortwechsel,
  NichtGesperrt,
} from "@/routes/Waechter";
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
              <BrauchtPasswortwechsel>
                <BuehneRoute />
              </BrauchtPasswortwechsel>
            </NichtGesperrt>
          </BrauchtAnmeldung>
        }
      />
      <Route
        path="/profil"
        element={
          <BrauchtAnmeldung>
            <NichtGesperrt>
              <BrauchtPasswortwechsel>
                <ProfilRoute />
              </BrauchtPasswortwechsel>
            </NichtGesperrt>
          </BrauchtAnmeldung>
        }
      />
      <Route
        path="/verwaltung/nutzer"
        element={
          <BrauchtAnmeldung>
            <NichtGesperrt>
              <BrauchtPasswortwechsel>
                <BrauchtAdmin>
                  <NutzerRoute />
                </BrauchtAdmin>
              </BrauchtPasswortwechsel>
            </NichtGesperrt>
          </BrauchtAnmeldung>
        }
      />

      {/*
        Katalog und Assistent teilen sich einen Pfad: `/verwaltung/katalog/aufnehmen` legt
        neu an, `/verwaltung/katalog/:id` bearbeitet. Dieselben fuenf Schritte, damit es
        nicht zwei Masken gibt, die auseinanderlaufen.
      */}
      <Route
        path="/verwaltung/organisationen"
        element={
          <BrauchtAnmeldung>
            <NichtGesperrt>
              <BrauchtPasswortwechsel>
                <BrauchtAdmin>
                  <OrganisationenRoute />
                </BrauchtAdmin>
              </BrauchtPasswortwechsel>
            </NichtGesperrt>
          </BrauchtAnmeldung>
        }
      />

      <Route
        path="/verwaltung/katalog"
        element={
          <BrauchtAnmeldung>
            <NichtGesperrt>
              <BrauchtPasswortwechsel>
                <BrauchtAdmin>
                  <KatalogRoute />
                </BrauchtAdmin>
              </BrauchtPasswortwechsel>
            </NichtGesperrt>
          </BrauchtAnmeldung>
        }
      />
      <Route
        path="/verwaltung/katalog/:id"
        element={
          <BrauchtAnmeldung>
            <NichtGesperrt>
              <BrauchtPasswortwechsel>
                <BrauchtAdmin>
                  <AufnahmeRoute />
                </BrauchtAdmin>
              </BrauchtPasswortwechsel>
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
