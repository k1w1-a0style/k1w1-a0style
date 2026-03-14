# Patch 434 — Supabase E2E Contract Audit (Abschluss + SoT-Hardening)

## Kontext

Der große End-to-End-Check über produktiv relevante Supabase-Edge-Flows wurde finalisiert, mit Fokus auf:

- Preview (`save_preview` / `preview_page`)
- GitHub Dispatch/Runs/Logs/Artifact (`github-workflow-dispatch`, `github-workflow-runs`, `github-workflow-logs`, `github-run-artifact-json`)
- Signing/Keystore (`android-keystore-status`, `android-keystore-generate`, `android-keystore-export`)
- Build Trigger/Polling (`trigger-eas-build`, `check-eas-build`)
- AI-Flow (`k1w1-handler`)

Ziel war, verbleibenden Contract-Drift minimal zu schließen, ohne Architekturumbau.

## Gefundener echter Rest-Drift

1. **Function-Name-SoT unvollständig auf Client-Seite**
   - Die zentralen Edge-Konstanten enthielten die workflow-/build-/preview-Hauptpfade,
     aber nicht alle produktiv genutzten Signing-/Preview-/AI-Endpunkte.
   - Im Credentials-Wizard wurden dadurch weiterhin String-Literale für Keystore-Functions verwendet.

2. **Operator-/E2E-Transparenz war als offener Punkt weiterhin korrekt**
   - Technisch sind die lokalen Request/Response-Mappings weitgehend konsistent,
     aber produktiver Betrieb bleibt an Secrets/DB/Storage/Deploy-Reihenfolge gebunden.
   - Dieser Restpunkt bleibt bewusst als Operator-Runbook-Aufgabe offen.

## Minimaler Fix

- `shared/constants/supabase.ts`
  - um fehlende produktive Endpunkte erweitert:
    - `PREVIEW_PAGE`
    - `ANDROID_KEYSTORE_STATUS`
    - `ANDROID_KEYSTORE_GENERATE`
    - `ANDROID_KEYSTORE_EXPORT`
    - `K1W1_HANDLER`
- `screens/CredentialsWizardScreen/hooks/useCredentialsWizardScreen.ts`
  - Keystore-Status/Generate-Aufrufe auf `SUPABASE_EDGE_FUNCTIONS.*` umgestellt
  - String-Literale entfernt
- Tests:
  - `__tests__/edgeFunctionContracts.test.ts`
    - Invariant ergänzt: SoT enthält produktiv genutzte Signing/Preview/AI-Endpoints
  - `__tests__/credentialsWizardInvokeEdgeJson.test.ts`
    - Invariant ergänzt: Wizard verwendet zentrale SoT-Konstanten statt Hardcodes

## E2E-Audit-Fazit (ehrlich)

- **Sauber passend**:
  - Build Trigger/Polling (`trigger-eas-build` ↔ `check-eas-build`) inkl. positiver numerischer `jobId`
  - Preview (`save_preview`) mit kontrolliertem Fallback auf lokalen HTML-Preview
  - Workflow Runs/Logs inkl. Soft-State `not_ready` und kompatiblem Run-Meta-Mapping (`run`/`workflowRun`)
- **Jetzt zusätzlich SoT-konsistent**:
  - Signing-Aufrufer im Credentials-Wizard
- **Weiterhin operator-abhängig** (nicht automatisch ausgeführt):
  - Supabase Edge Secrets vollständig setzen
  - DB-/Storage-Objekte vorhanden (z. B. `signing_android`, `signing_audit_log`, `previews`, Bucket)
  - Edge-Deploy-Reihenfolge + Migrationsstand

## Verifikation

- `bash scripts/check_workflow_template_drift.sh`
- `bash scripts/check_managed_workflows.sh`
- `bash scripts/check_workflow_edge_contracts.sh`
- `bash scripts/check_legacy_disabled_edges.sh`
- `bash scripts/check_patch_docs_sync.sh`
- `npm run typecheck`
- `npm run lint:ci`
- `npm run test:silent`
