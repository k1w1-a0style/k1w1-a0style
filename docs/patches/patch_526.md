# Patch 526 — Remote-Preview-Payload im App-Pfad repariert

## Ziel

Der echte Remote-Preview-Bug wird klein und gezielt im App-Request-Pfad behoben: normale
Projekte sollen fuer `save_preview` wieder einen gueltigen, nicht-leeren `files`-Payload senden,
Remote-/WebView-Preview bleibt der primaere Produktpfad, und leer/weggefilterte Projekte muessen
einen ehrlichen Datei-/Payload-Hinweis statt eines vermischten Auth-/Unknown-Fehlers bekommen.

## Root Cause

- Die gesicherte Laufzeit-Erkenntnis zeigte: `save_preview` ist mit lokalem Edge Admin Key
  serverseitig erreichbar; direkter `curl` liefert fuer denselben Key fachlich korrekt entweder
  HTTP 200 (`android-keystore-status`) oder bei leerem Preview-Body den ehrlichen `400 files fehlt/leer`.
- Im App-Code lief `usePreview` fuer `save_preview` noch ueber `supabase.functions.invoke(...)`,
  waehrend die funktionierenden lokalen Admin-Key-Edge-Pfade bereits einen expliziten JSON-`fetch`
  mit `x-k1w1-admin-key` und `JSON.stringify(...)` nutzen.
- Daraus folgt als engste, durch Code + Laufzeit gestuetzte Ursache: nicht Auth, sondern der
  appseitige Preview-Request-/Payload-Pfad lieferte serverseitig kein verlaesslich gueltiges
  `files`-Objekt; zugleich fehlte fuer wirklich leer/weggefilterte Projekte ein ehrlicher
  Datei-/Payload-Grund.

## Umsetzung

1. `hooks/previewHelpers.ts`
   - neuer helper `invokeSavePreview(...)` sendet den Preview-Request explizit per `fetch` an
     `/functions/v1/save_preview`
   - Request wird mit JSON-Body, `x-k1w1-admin-key` und hartem Timeout gebaut
   - `files fehlt/leer` / `No valid files` werden als ehrliche Datei-/Payload-Ursache klassifiziert
   - neuer Helper beschreibt den echten Leerfall fuer komplett leere bzw. komplett weggefilterte
     Projektdateien
2. `hooks/usePreview.ts`
   - Remote-Preview nutzt weiter den primaeren Supabase-/WebView-Pfad, aber mit dem neuen
     expliziten JSON-Request statt dem alten Invoke-Weg
   - Remote wird nur noch versucht, wenn echte zulaessige Projektdateien vorhanden sind
   - fuer normale Projekte bleibt der Payload nicht leer; fuer leer/weggefiltert wird klar
     `Keine zulaessigen Projektdateien fuer Remote-Preview gefunden ...` gemeldet
   - lokaler HTML-/Eval-Fallback bleibt unveraendert sekundaer
3. `__tests__/usePreview.serverContract.test.tsx`
   - Header-/Happy-Path auf den neuen Fetch-Request umgestellt
   - neue Regression: normaler Projektstand sendet nicht-leeres `files`-Objekt
   - neue Regression: komplett weggefilterter Projektstand meldet ehrlichen Datei-/Payload-Grund
     und faellt erst danach lokal zurueck

## Tests / Checks

- `npm test -- --runInBand __tests__/usePreview.serverContract.test.tsx`
- `bash scripts/check_patch_docs_sync.sh`
- `npm run typecheck`
- `npm run lint:ci`
- `npm run test:silent`

## Risiko / Scope

- Kein Scope auf Admin-Key-/Wizard-/CI-Lite-/Workflow-/ZIP-Themen.
- Kein Umbau der Preview-Architektur; Remote bleibt Produkt-SoT, lokaler HTML-Fallback bleibt
  bewusst nur Best-Effort-Sekundaerpfad.
- Keine Server- oder Migrationsaenderung noetig, weil der belegte Fehler im appseitigen
  Request-/Payload-Aufbau lag.
