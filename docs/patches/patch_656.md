# Patch 656: kleine Semantik-/UI-Kanten bei Dateiaktionen und KI-Confirm bereinigt

## Ziel

Nur kleine Restinkonsistenzen schliessen, ohne grosse Flows umzubauen:

1. Dateiaktions-Ergebnisse (`success`/`noop`/`rejected`/`error`) in direkt betroffenen UI-Pfaden sauber auswerten.
2. Marker-/Nebenstatus nicht als authoritative Wahrheit wirken lassen.
3. Explain-/Summary-/Confirm-Kanten bei KI-Dateiaenderungen klarer und wahrheitsgemaess halten.

## Umsetzung

### 1) Strukturierte Dateiaktions-Resultate

- `ProjectContext` liefert fuer `createFile`, `deleteFile`, `deleteFiles`, `renameFile` jetzt strukturierte Resultate:
  - `success`
  - `noop`
  - `rejected`
  - `error` (reserved)
- Ergebnis-Meldungen werden als `message` transportiert.

Damit koennen aufrufende UIs Folgeaktionen nur bei fachlichem Erfolg ausfuehren.

### 2) CodeScreen-FileActions: Folgeaktionen nur bei echtem Erfolg

- In `useFileActions` werden Auswahlwechsel, Editor-Clears und Erfolgs-Alerts jetzt nur noch bei `success` ausgefuehrt.
- Bei `noop`/`rejected`/`error` werden keine irrefuehrenden Erfolgswirkungen mehr erzeugt.
- Speziell:
  - `handleCreateFile`: kein auto-select/edit bei no-op/reject.
  - `handleDeleteFile`: selected file/editor bleibt unangetastet bei no-op/reject.
  - `handleRenameFile`/`handleMoveFile`: kein Pfadwechsel im UI bei no-op/reject.
  - `handleDuplicateFile`/`handleCreateFolder`: Erfolgsmeldung nur bei echtem Write.

### 3) KI-Confirm-Provenance klarer

- `ConfirmChangesModal` benennt den Validator-Pfad nicht mehr missverstaendlich als nur advisory, wenn die finale Liste tatsaechlich vom Validator uebernommen wurde.
- Die finale Quellenzeile stellt explizit klar: Builder ist dann Ausgangsvorschlag, nicht finale Wahrheit.

## Tests

- Regressionen in `useFileActions.regression.test.tsx` erweitert:
  - no-op create -> kein Selection-/Editor-Switch
  - no-op delete -> kein Editor-Clear
- Bestehende Confirm-Review-Tests laufen weiterhin gruen.

## Ergebnis

- Dateiaktionen mit `noop`/`rejected`/`error` verhalten sich in den direkt betroffenen UI-Pfaden nicht mehr wie Erfolg.
- Nebenstatus/Marker bleiben semantisch Nebenstatus.
- KI-Confirm-Provenance bleibt in den angrenzenden Anzeige-Pfaden wahrheitsgemaess.
