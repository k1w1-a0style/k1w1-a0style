# TODO

Stand: **2026-02-13**

> Dieses Dokument ist die **laufende Restliste**.  
> Alle Security-/Privacy-P1-Fixes aus den Screen-Reviews sind umgesetzt und Tests sind grün.  
> Unten stehen nur noch **Restpunkte / Quality-Backlog** (meist P2/P3).

## Status

### Patch 107 — Workflows/Templates
- [x] Workflows: `ref`-Fallback auf aktuellen Branch (manueller Run ohne `ref` baut den aktiven Branch)
- [x] Templates (sdk54 base/full) mit den korrigierten Workflows synchronisiert
- [ ] Optional: Entscheiden ob „auto-sync GitHub Secrets vor Build“ überhaupt gewünscht ist (opt-in Toggle), **nicht** default


- ✅ Screens/Reviews sind vollständig unter `docs/reviews/*_VERIFICATION.md` dokumentiert (siehe Index: `docs/reviews/SCREENS_VERIFICATION.md`).
- ✅ Supabase Edge Functions & DB-Migration wurden gehärtet (RLS + Error-Sanitization), siehe `docs/reviews/SUPABASE_MIGRATION_VERIFICATION.md`.

## Backlog (noch offen)

> Quelle: kritisches Review (zusammengeführt).  
> **P2 = sollte**, **P3 = nice-to-have**.

### GitHubReposScreen

- [x] **RS-004 (P2)** Unmount-Guard / Abort für `onRefresh` (Race: setState nach unmount)  ✅ *(patch 91)*
  _Ort_: `screens/GitHubReposScreen/hooks/useGitHubReposScreen.ts`
- [x] **RS-005 (P2)** Striktere `owner/repo`-Validierung + Tests (`splitFullName`/Parsing)  ✅ *(patch 91)*
  _Ort_: `screens/GitHubReposScreen/utils/repos.ts` (+ Tests in `__tests__/`)
- [x] **RS-006 (P3)** Repo-Liste virtualisieren (FlatList) ohne VirtualizedList-Warnungen ✅ *(patch 94)*  
  _Ort_: `screens/GitHubReposScreen/index.tsx`
- [x] **RS-008 (P2/P3)** Tests: Selection-Consistency, Branch-Race, Modal-Idempotency ✅ *(patch 79, 91, 92, 94-96)*  
  _Ort_: `__tests__/` (Screen-/Hook-Tests)

### ConnectionsScreen

- [x] **CS-006 (P2)** Security-/Regression-Tests für Masking/Validation (Tokens/Keys) ✅ *(patch 97)*  
  _Ort_: `screens/ConnectionsScreen/utils/validation.ts` + `__tests__/connectionsScreen.validation.test.ts`

### Supabase (Audit / Ops)

- [x] **SB-RLS-002 (P2)** RLS/Policies auditieren (least privilege) ✅ *(patch 98/99)*  
  _Ort_: `supabase/migrations/*` + `docs/reviews/SUPABASE_MIGRATION_VERIFICATION.md`
- [x] **SB-FN-003 (P2)** Edge error sanitization: sicherstellen, dass **alle** Functions den shared sanitizer nutzen ✅ *(patch 98/99)*  
  _Ort_: `supabase/functions/*`
- [x] **SB-MIG-001 (P2)** Migration-Runbook ergänzen (Roll-forward/Rollback, smoke checks) ✅ *(patch 98)*  
  _Ort_: `docs/runbooks/SUPABASE_DEPLOY_AND_MIGRATIONS.md`
- [x] **SB-DEPLOY-004 (P1/P2)** Edge Deploy: Deno-Imports müssen `.ts` haben (sonst "Module not found" bei `supabase functions deploy`) ✅ *(patch 100)*
  _Ort_: `supabase/functions/_shared/cors.ts` + Functions, die `errorSanitization` importieren
- [x] **SB-TEST-001 (P2)** Unit-Tests für Error-Sanitizer (Transport-Sanitization) ✅ *(patch 98/99)*  
  _Ort_: `__tests__/supabaseErrorSanitization.test.ts`

- [x] **SB-STORAGE-005 (P2)** Storage Bucket `signing`: Migration hat Guard für `insufficient_privilege`, Runbook dokumentiert Troubleshooting ✅ *(bereits implementiert)*
  _Ort_: `supabase/migrations/20260213000000_rls_audit_hardening.sql` (Zeilen 75-78) + `docs/runbooks/SUPABASE_DEPLOY_AND_MIGRATIONS.md` (Zeilen 82-88)

## Abgeschlossen (Kurzlog)

- **Patch 75–78**: TerminalScreen privacy/perf + Secret-Redaction + Tests  
- **Patch 79**: GitHubReposScreen selection consistency + race guard  
- **Patch 80**: Jest open handles fix (ChatScreen cleanup/unref)  
- **Patch 81**: SettingsScreen API-Key masking + validation  
- **Patch 82–84**: ConnectionsScreen masking/validation/sanitization  
- **Patch 85–86**: EnhancedBuildScreen hardening (Status union + guards)  
- **Patch 87**: Supabase hardening (RLS + Edge error sanitization + migration)
- **Patch 91–92**: GitHubReposScreen strict parsing + whitespace rejection + tests
- **Patch 93**: Docs/status refresh + consolidated review notes
- **Patch 94–96**: GitHubReposScreen list virtualization + list flow tests + jest mock hardening
- **Patch 97**: ConnectionsScreen extract validation utils + security/regression tests
- **Patch 98/99**: Supabase RLS audit hardening + sanitizer everywhere + runbook + tests (+ TS fixes + unified redaction marker)
- **Patch 100**: Supabase deploy fix (Deno import extensions) + migration guard for `storage.objects` privileges
- **Patch 101**: Supabase preview_page safe logging (sanitize alle Error-Logs) + create_codesandbox Template-Fix + Docs (TODO/Verification/Checklog)
- **Patch 102**: ChatScreen: Legacy Chat-History Migration (fehlende `id`/`timestamp`) + tolerant keyExtractor + Tests
- **Patch 103**: ChatScreen/Privacy: Fix default Retention (missing setting key no longer wipes Chat-History)
- **Patch 104**: ChatScreen Hardening
- **Patch 108**: Connections/Supabase: RLS-aware Supabase-Test + LayoutAnimation Warnungen im New Architecture unterdrückt
- **Patch 109**: Build: GitHub Actions Logs – status-genaue Fehlermeldungen + Edge Function github-workflow-logs Auth/RateLimit Fix (AI-flow stale-closure fix via refs, bounded AutoFix queue, debounced scroll+one retry, modal summary truncation, confirm dialogs)



### CodeScreen

- [x] **CODE-105 (P1/P2)** CodeScreen: Save await + Folder-Delete deterministisch + selectedFile cleanup ✅ *(patch 105)*  
  _Ort_: `screens/CodeScreen/hooks/useFileEditor.ts`, `screens/CodeScreen/hooks/useFileActions.ts`  
- [x] **CODE-105 (P2/P3)** CodeScreen UX/Consistency: Modal/Dialog reset, selectAll scoped, ImageViewer size fix, FileTree empty-folder fix ✅ *(patch 105)*  
  _Ort_: `components/*`, `screens/CodeScreen/*`, `utils/syntaxValidator.ts`

### DiagnosticScreen

- [x] **DIAG-106 (P1)** `applyPatch`: Delete-Fehler nicht schlucken (keine File-Leichen / kein projectRef-Phantom-State) ✅ *(patch 106)*  
  _Ort_: `screens/DiagnosticScreen/hooks/useDiagnosticFixRunner.ts`
- [x] **DIAG-106 (P2)** Batch-Progress: `setFixStepIndex` auch für Apply-Steps ✅ *(patch 106)*  
  _Ort_: `screens/DiagnosticScreen/hooks/useDiagnosticFixRunner.ts`
- [x] **DIAG-106 (P2)** `undoAll`: Busy-Guard + `finally` Cleanup (kein Doppel-Undo) ✅ *(patch 106)*  
  _Ort_: `screens/DiagnosticScreen/hooks/useDiagnosticFixRunner.ts`
- [x] **DIAG-106 (P2)** HeaderStats: Projektname hängt von `projectData?.name` ab (kein stale Name) ✅ *(patch 106)*  
  _Ort_: `screens/DiagnosticScreen/hooks/useDiagnosticScreen.ts`
- [x] **DIAG-106 (P3)** Preferences: AsyncStorage Fehler loggen statt still schlucken ✅ *(patch 106)*  
  _Ort_: `screens/DiagnosticScreen/hooks/useDiagnosticPreferences.ts`
- [x] **DIAG-106 (P3)** `AUTOFIX_MAX` Single-Source (kein Duplikat in UI) ✅ *(patch 106)*  
  _Ort_: `screens/DiagnosticScreen/hooks/useDiagnosticFixRunner.ts`, `screens/DiagnosticScreen/components/NonIssuesTabSection.tsx`
- [x] **BUILD-110 (P1)** GitHub Actions Logs: 404 (logs zip) wird als "not ready" behandelt + klarer Hinweis run-id vs run-number ✅ *(patch 110)*
  _Ort_: `supabase/functions/github-workflow-logs`, `hooks/useGitHubActionsLogs.ts`


- [x] Patch 112: Workflow YAML fix + managed workflow updates
- [x] Patch 112: Managed workflow updates + YAML colon-in-name fix for k1w1-triggered-build
