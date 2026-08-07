-- Die acht Programme aus src/tools/registry.ts der AAS Tools Platform. Die Kennungen sind
-- genau die tool_ids, die in user_tool_access stehen, sonst faenden die 37 Freischaltungen
-- keine Kachel.
--
-- Akzente aus der AXON-Farbwelt statt der Tailwind-Klassen der Vorlage. Sechs Farben auf
-- acht Programme: Cyan und das helle Gruen kommen doppelt vor. Zulaessig, weil der Akzent
-- Wiedererkennung ist und keine Bedeutung traegt (die eine Aktionsfarbe bleibt Gruen).
--
-- `url` ist nur beim AAS Editor gesetzt. Die uebrigen sieben leben heute innerhalb der
-- Tools-Plattform und haben keine eigene oeffentliche Adresse.

insert into public.hub_apps (id, name, kuerzel, kurz, akzent, url, sortierung) values
  ('aas-editor',       'AAS Editor',       'AAS', 'AAS-Dokumente visuell erstellen und bearbeiten.',        '#E0B0E0', 'https://axon-studio.sliplane.app', 10),
  ('dti-connector',    'SQL Connector',    'SQL', 'Daten verwalten: Hierarchien, Modelle, Dateien, Assets.', '#00A386', null, 20),
  ('excel-connector',  'Excel Connector',  'XLS', 'Excel-Dateien als Live-Datenquelle für die API.',        '#1EB095', null, 30),
  ('global-connector', 'Global Connector', 'GLB', 'Globale Werte als Live-Datenquelle für die API.',        '#F06A38', null, 40),
  ('connector-proxy',  'Connector Proxy',  'PRX', 'Leitet Anfragen an einen anderen Connector weiter.',     '#8838C0', null, 50),
  ('aas-mcp',          'MCP Server',       'MCP', 'AAS-Repository als MCP-Server für andere Clients.',      '#00FDFD', null, 60),
  ('use-case-checker', 'Use Case Checker', 'UCC', 'AAS gegen definierte Use Cases evaluieren.',             '#1EB095', null, 70),
  ('iec-61406-qr',     'IEC 61406 QR',     'QR',  'Normkonforme QR-Codes mit ID-Link-Dreieck erzeugen.',    '#00FDFD', null, 80)
on conflict (id) do update set
  name = excluded.name, kuerzel = excluded.kuerzel, kurz = excluded.kurz,
  akzent = excluded.akzent, sortierung = excluded.sortierung;
