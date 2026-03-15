# Patch 439 — Insert-Diagnostic-Upload History Invariant-Härtung

## Ziel
Den bereits finalisierten `insert_diagnostic_upload`-Vertrag weiter absichern, indem die historische UUID-/Spalten-Drift explizit auf die bekannten Altmigrationen begrenzt und gegen Re-Intro geschützt wird.

## Gefundener Restpunkt
- Patch 436 hat den finalen `jsonb -> bigint`-Vertrag bereits sauber reassertet.
- Es fehlte aber noch ein expliziter Invariant-Guard, der sicherstellt, dass
  - UUID-Rückgaben für `insert_diagnostic_upload(payload jsonb)` nur in den zwei bekannten Drift-Migrationen vorkommen,
  - und dass die Legacy-Spalten (`repo/branch/mode/platform/report/meta`) nicht versehentlich wieder im finalen Vertrag landen.

## Minimaler Fix
- Neuer Invariant-Test: `__tests__/patch439.insertDiagnosticUploadHistory.invariants.test.ts`
  - prüft kanonisches Basisschema der `diagnostic_uploads`-Tabelle,
  - begrenzt UUID-Vertragsvorkommen auf die zwei historischen Drift-Dateien,
  - erzwingt, dass die Finalize-Migration (`20260315000100`) `returns bigint` bleibt und keine Legacy-Spalten referenziert.

## Ehrliche Einordnung
- Die fehlerhafte Zwischenphase bleibt weiterhin als historischer Zustand in der append-only Migrationshistorie sichtbar.
- Sie wird nicht nachträglich umgeschrieben, sondern per finalem Vertrag + Invariants klar begrenzt und regressionssicher dokumentiert.
