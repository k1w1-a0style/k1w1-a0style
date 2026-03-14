# Patch 426 – Chat/KI-Änderungsfluss gegen Zustandsdrift gehärtet

## Ziel

Sicherstellen, dass bestätigte KI-Änderungen nicht auf einem veralteten Zwischenzustand landen,
sondern vor Persistenz auf den **aktuellsten Projektzustand** rebased werden.

## Änderungen

- Neuer Guard-Helfer `lib/chatFlowStateGuards.ts`:
  - `buildProjectStateDigest(files)` erzeugt einen stabilen Zustands-Fingerprint des aktuellen Projekts.
  - `rebasePendingChangeOnLatest(latestFiles, pending)` wendet vorgeschlagene Dateien vor Persistenz erneut auf den aktuellen Stand an und markiert Drift.
- `useChatAIFlow` konservativ gehärtet:
  - Beim Erzeugen von `pendingChange` werden nun `proposedFiles` (LLM-Vorschläge) und `baseProjectDigest` gespeichert.
  - Beim finalen Anwenden (`applyChanges`) wird nicht mehr blind der alte Pending-Snapshot geschrieben,
    sondern gegen `projectFilesRef.current` neu gemerged.
  - Bei erkannten Zustandsänderungen zwischen Vorschlag und Bestätigung wird eine transparente Systemmeldung im Chat geschrieben.
- Typen erweitert (`hooks/chatAIFlowTypes.ts`): `PendingChange` trägt jetzt optionale Felder für Rebase/Drift-Erkennung.
- Jest-Regressionen ergänzt: `__tests__/chatFlowStateGuards.test.ts`.

## Warum minimal

- Kein Umbau der Chat-Architektur.
- Kein neuer State-Store, keine parallele Source-of-Truth.
- Nur Guard-/Persistenzhärtung in genau dem kritischen Confirm→Apply-Pfad.

## Verifikation

- `bash scripts/check_workflow_template_drift.sh`
- `bash scripts/check_managed_workflows.sh`
- `bash scripts/check_workflow_edge_contracts.sh`
- `bash scripts/check_legacy_disabled_edges.sh`
- `bash scripts/check_patch_docs_sync.sh`
- `npm run typecheck`
- `npm run lint:ci`
- `npm run test:silent`
