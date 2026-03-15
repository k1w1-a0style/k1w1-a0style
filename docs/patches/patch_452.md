# Patch 452 — KI-/Chat-/Prompting Restfixes (konservativ)

## Ziel
Gezielte Härtung bestätigter Restprobleme im KI-/Chat-/Prompting-Block ohne Broad-Refactor oder neue KI-Architektur.

## Änderungen

### 1) Projektkontext relevanzbasiert priorisiert (`lib/promptEngine.ts`)
- Snapshot-Auswahl bleibt begrenzt, priorisiert aber Dateien anhand Nutzerfokus (Path-/Content-Treffer + leichte Domänen-Heuristik) statt starrer Array-Reihenfolge.
- Ergebnis: Größere Projekte liefern der KI häufiger die tatsächlich betroffenen Dateien im begrenzten Kontextfenster.

### 2) Builder-NonJSON-Fallback verständlich gemacht (`hooks/useChatAIFlow.ts`, `lib/normalizer.ts`)
- Neuer Detailed-Parser liefert Parse-Metadaten (`parseError`, `responseText`) zusätzlich zu Dateien.
- Wenn Builder keine gültige Dateiliste liefert, wird die reale KI-Antwort als gekürzte Vorschau transparent an den Nutzer zurückgemeldet (statt rein kryptischer Normalizer-Fehler).

### 3) Drift-Digest gehärtet (`lib/chatFlowStateGuards.ts`)
- Digest von schwachem `path:content.length` auf `sha256(path+content)` umgestellt.
- Same-Length-Inhaltsänderungen triggern jetzt korrekt Drift-Erkennung.

### 4) Flow-nahe Restpunkte (minimal)
- Planner-vs-Builder-Heuristik konservativ entschärft (explizite Datei-Tasks weniger fragil).
- Ownership-/Blocker-/Hinweistexte aus `applyFilesToProject` werden im Änderungs-Summary sichtbar gemacht.
- Validator-/Explain-Fehlerfälle werden nicht mehr nur geloggt, sondern zusätzlich als Systemhinweis im Chat kommuniziert.
- `k1w1-handler`: nur eingeordnet; kein clientseitiger Architekturumbau in diesem Patch.

## Tests
- Neue Regression: same-length-content Drift wird erkannt (`__tests__/chatFlowStateGuards.test.ts`).
- Neue Regression: Kontext-Priorisierung zieht relevante Dateien im Snapshot nach vorne (`__tests__/promptEngine.contextPriority.test.ts`).
- Normalizer-Erweiterung: Non-JSON-Text liefert Parse-Metadaten (`lib/__tests__/normalizer.test.ts`).

## Verifikation
- `bash scripts/check_workflow_template_drift.sh`
- `bash scripts/check_managed_workflows.sh`
- `bash scripts/check_workflow_edge_contracts.sh`
- `bash scripts/check_legacy_disabled_edges.sh`
- `bash scripts/check_patch_docs_sync.sh`
- `npm run typecheck`
- `npm run lint:ci`
- `npm run test:silent`
