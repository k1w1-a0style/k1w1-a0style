# Patch 448

Datum: 2026-03-15

## Ziel
Bestätigte Restprobleme im DiagnosticScreen konservativ schließen: funktionale Progress-/UX-Bugs zuerst, dazu nur flow-nahe Typing-/Hook-Cleanup-Punkte — ohne Broad-Refactor.

## Änderungen
- **`screens/DiagnosticScreen/hooks/diagnosticRunners.ts`**
  - Progress-Stage-Fix: nutzt bei progressiven Preflight-Updates jetzt korrekt `stage.stage` statt des falschen `stage.priority`, damit die Severity im Fortschrittstext sichtbar ist.
  - `runLocalChecks`/`runPipelineChecks` auf `ProjectFile[]` typisiert (`files: any` entfernt).
  - Tote Imports aus dem Runner entfernt (Datei ist jetzt auf ihre tatsächlichen Runtime-Abhängigkeiten reduziert).

- **`screens/DiagnosticScreen/index.tsx`**
  - Unnötige `projectData as any`-Casts für `linkedRepo`/`linkedBranch` entfernt.
  - `PreflightStatus` statt `as any` für Severity-Mapping genutzt.
  - UX-Fix: „KI-Fix verfuegbar“ wird nur noch für `warn`/`fail` ohne Auto-Fix angezeigt; `pass`-Checks zeigen keinen irreführenden Fix-Hinweis mehr.

- **`screens/DiagnosticScreen/hooks/useDiagnosticScreen.ts`**
  - `updateProjectFiles` / `deleteFile` in den Hook-Optionen eng typisiert (statt `any`).
  - Unnötigen Cast bei `preferredBuildProfile` entfernt.
  - `clearSelection` in die `runDiagnostics`-Dependency-Liste aufgenommen.
  - Tote Imports aus vorherigem Runner-Refactor bereinigt.

- **Tests**
  - `__tests__/diagnosticRunners.repoSync.test.ts`: Regression ergänzt, die verifiziert, dass der Progress-Text die progressive Severity-Stufe enthält.
  - `__tests__/diagnosticScreen.sorting.test.tsx`: Regression ergänzt, dass `pass`-Items keinen „KI-Fix verfuegbar“-Hinweis rendern.

## Verifikation
- `bash scripts/check_workflow_template_drift.sh`
- `bash scripts/check_managed_workflows.sh`
- `bash scripts/check_workflow_edge_contracts.sh`
- `bash scripts/check_legacy_disabled_edges.sh`
- `bash scripts/check_patch_docs_sync.sh`
- `npm run typecheck`
- `npm run lint:ci`
- `npm run test:silent`

## Hinweis
Bewusst kein Architekturumbau: nur bestätigte, flow-nahe DiagnosticScreen-Restpunkte (Progress, Fix-Hinweis, Typing-/Hook-Lücken) wurden minimal korrigiert; übrige nicht-kritische Altlasten bleiben selektive Follow-ups.
