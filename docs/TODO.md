# TODO

Stand: **2026-02-20**

> Dieses Dokument ist die **laufende Restliste**.  
> Alle Security-/Privacy-P1-Fixes aus den Screen-Reviews sind umgesetzt und Tests sind grün.  
> Unten stehen nur noch **Restpunkte / Quality-Backlog** (meist P2/P3).

## Aktuell (als Nächstes abarbeiten)

> Ziel: **alles was zu tun ist steht hier**, so dass man es stumpf abhaken kann.

### Patch 220 — KI-Model "Auto" entfernen ✅

- [x] Settings/AI: kein "Auto"-Model mehr anzeigen (bei allen Providern)
- [x] Migration: alte Config-Werte `selectedChatMode/selectedAgentMode = auto|auto-*` beim Laden auf konkrete Default-Modelle mappen
- [x] Defaults: neue Installationen starten direkt mit konkreten Default-Models (kein Auto)
- [x] Tests: AIContext Integration Test anpassen (Auto nicht mehr erwartet)

Akzeptanz:
- [x] In Settings taucht nirgends "Auto (...)" als Model auf
- [x] Bestehende Nutzer mit gespeicherter Auto-Config landen nach App-Start automatisch auf einem konkreten Model

### Patch 221 — Connections UX + Docs SoT-Polish (next)

**221-1 — GitHub Scopes UX verbessern**
- [ ] StatusCard: Scopes als Badges anzeigen (statt Fließtext)
- [ ] Missing required scopes klar markieren (mind. `repo`, `workflow`)
- [ ] Akzeptanz: Verbunden + Scopes → sofort erkennbar, ob PAT Rechte reichen

**221-2 — Shortcuts / Next Steps**
- [ ] StatusCard: Button `Build/CI` (Drawer Route `EnhancedBuild`) hinzufügen
- [ ] EAS Init/Link running: Hinweistext + "Check GitHub Actions (eas-link)"

**221-3 — Supabase Ref/Host Anzeige aufräumen**
- [ ] StatusCard: `supabaseRef` prominent anzeigen + Host in Detail
- [ ] SupabaseCard: Label `Supabase URL (auto)` → `Supabase URL (abgeleitet)`

**221-4 — Docs / TODO Alignment**
- [ ] `docs/TODO.md`: alte Patch-A/B/C Aufgaben (bereits erledigt) als ✅ markieren
- [ ] `docs/patches/patch_221.md` anlegen (Commands wie im Screenshot)
- [ ] `docs/patches/PATCHLOG_ROOT.md`, `PROJECT_CHECKLOG.md`, `README.md` aktualisieren
- [ ] Akzeptanz: niemand sucht mehr nach bereits gefixten TODOs

---


### Patch 217 — Connection Screen SoT ✅
- [x] Patch anwenden: `k1w1-a0style_patch_217_FIXED.zip` (enthält Code + Docs (MD) Updates)
- [x] Danach laufen lassen: `npm run typecheck && npm run lint:ci && npm run test:silent`
- [x] Wenn grün: TODO-Items **A1–A3**, **B1–B3**, **C1–C3** unten abhaken
- [x] Wenn rot: Fehlerlog ins Issue / Checklog kopieren (1:1), dann fixen


> Ziel: **alles was zu tun ist steht hier**, so dass man es stumpf abhaken kann.

### Patch 218 — Connections/SoT Feinschliff ✅

**218-1 — GitHub Scopes persistieren & anzeigen (best-effort)**
- [x] Laden (mount) liest `CONN_GITHUB_SCOPES` und zeigt „unknown“ wenn nicht verfügbar.

**218-2 — Connection-Lampen korrekt zurücksetzen wenn Token gelöscht wird**
- [x] Resets implementiert (GitHub/Expo/Supabase)

**218-3 — Stale-Closure Fix: `testSupabase` deps**
- [x] deps ergänzt
- [x] Akzeptanz: Service-Role nachträglich setzen → Test nutzt sicher den aktuellen Key.

**218-4 — StatusCard: Scopes-Detail auch ohne Header ✅**
- [x] Datei: `screens/ConnectionsScreen/components/StatusCard.tsx`
- [x] Wenn GitHub verbunden aber keine Scopes geliefert: `Scopes: unknown` anzeigen.
- [x] Akzeptanz: UI zeigt immer einen klaren Zustand, kein “leerer” Detailtext.

**218-5 — Docs Alignment**
- [ ] `docs/patches/patch_218.md` anlegen (Commands wie im Screenshot)
- [ ] `docs/patches/PATCHLOG_ROOT.md`, `PROJECT_CHECKLOG.md`, `README.md` aktualisieren
- [ ] Akzeptanz: Doku spiegelt realen Stand wider (217 done, 218 next).

---

### Patch A — CI Lite Bugfix ✅ (Patch 217)
**A1 — Dead Code entfernen: `topContent` wird nie gerendert**
- [x] Datei: `components/CiLiteHeaderButton.tsx`
- [x] Entferne `const topContent = useMemo(...)` komplett **oder** rendere es bewusst (aktuell: nicht benutzt).
- [x] Entferne zugehörige ungenutzte Styles (mindestens `styles.ciBtn`).
- [x] Akzeptanz: Typecheck/Lint grün, kein `{topContent}` missing (weil es nirgendwo existiert), kein unnötiges Memo.

**A2 — Stale-Closure Fix: `applyPatchFromText` Dependencies**
- [x] Datei: `components/CiLiteHeaderButton.tsx`
- [x] `applyPatchFromText` nutzt u.a. `githubRepo`, `branch`, `getDefaultBranch`, `pushFilesToRepo`, `deleteRepoFile`, `getGitHubToken`.
- [x] Lösung (minimal): fehlende Werte in deps aufnehmen.
- [x] Lösung (robuster): `useRef` für `githubRepo/branch` oder für „current selection“ und Callback deps schlank halten.
- [x] Akzeptanz: Repo/Branch wechseln → Apply Patch pusht garantiert in das aktuelle Ziel.

**A3 — Unmount Cleanup: Polling Timer**
- [x] Datei: `components/CiLiteHeaderButton.tsx`
- [x] Ergänze `useEffect(() => () => stopPolling(), [stopPolling])` (oder äquivalenter Cleanup).
- [x] Akzeptanz: Navigation/unmount während Polling → kein weiterlaufender Timer, keine setState-after-unmount Warnungen.

### Patch B — Supabase Edge Function Names: echte SoT ✅ (Patch 217)
**B1 — Constants vervollständigen**
- [x] Datei: `shared/constants/supabase.ts`
- [x] Ergänze fehlende Functions:
  - [x] `CHECK_EAS_BUILD` (`check-eas-build`)
  - [x] `SAVE_PREVIEW` (`save_preview`)

**B2 — Hardcodes entfernen (alle Call-Sites)**
- [x] `components/CiLiteHeaderButton.tsx`: `github-workflow-runs`, `github-workflow-dispatch` → Constants
- [x] `project/services/buildStartService.ts`: `trigger-eas-build` → Constant
- [x] `project/services/buildPollingService.ts`: `check-eas-build` → Constant
- [x] `hooks/usePreview.ts`: `save_preview` → Constant
- [x] Akzeptanz: keine `fetch(.../github-workflow-...)` oder `invoke("trigger-eas-build")` Strings mehr.

**B3 — Duplicate Helper entfernen**
- [x] Datei: `project/services/buildPollingService.ts`
- [x] Entferne lokale `getSupabaseEdgeUrl()` (Duplikat)
- [x] Nutze `lib/supabaseEdge.ts` als einzige Quelle.

### Patch C — Storage Keys: SoT ✅ (Patch 217)
**C1 — `diagnostic_last_ok` zentralisieren**
- [x] Datei: `shared/constants/storage.ts` oder `shared/constants/diagnostics.ts` (je nach bestehender Struktur)
- [x] Update:
  - [x] `screens/EnhancedBuildScreen/hooks/useBuildPreconditions.ts`
  - [x] `screens/DiagnosticScreen/hooks/useDiagnosticScreen.ts`

### Patch D — TokenStore Konsistenz ✅ (Patch 217)
**D1 — SecureStore Error-Handling vereinheitlichen**
- [x] Datei: `infra/github/tokenStore.ts`
- [x] Admin/Signing/ServiceRole Keys nutzen aktuell direkte `SecureStore.*Async` Calls.
- [x] Umstellen auf die gleichen Wrapper/Pattern wie GitHub/Expo (try/catch + konsistente Fehlermeldung).

---

## Status

### Patch 138 — CI Lite (Lint + Typecheck)
- [x] Globaler Header-Button (✅) zum Triggern von GitHub CI Lite + Logs in-app

### Patch 139 — CI Lite Upgrade
- [x] Workflow robuster (Fallback auf `npx eslint` / `npx tsc`) + Log-Artifact
- [x] In-App: Apply Patch (JSON) Panel im CI Lite Modal
- [x] Neuer Workflow `.github/workflows/k1w1-ci-lite.yml` (read-only checks)

### Patch 140 — CI Lite Autofix Split
- [x] Neuer Workflow `.github/workflows/k1w1-ci-lite-autofix.yml` (ESLint --fix + guarded writeback + verify)
- [x] In-App Autofix Button triggert separaten Workflow

### Patch 141 — CI Lite Chain-Run + UI Polish
- [x] Autofix → automatisch CI Lite Chain-Run (gleiche `job_id`)

### Patch 145 — CI Lite Compact Modal + Drawer Cleanup
- [x] CI Lite als zentriertes Modal (errors-only, minimal Actions)
- [x] Header Icons konsistent neon
- [x] Drawer: keine doppelten Menüs, Card/Plate Look
- [x] Header-Optik/Neon-Dark: Status-Lämpchen + Running-Pulse

### Patch 142 — Selection Sync + Glow (WICHTIG)
- [x] **Single Source of Truth**: `projectData.linkedRepo/linkedBranch` wird in `GitHubContext` gespiegelt
- [x] **Selection Glow**: ausgewähltes Repo/Branch/Profile bekommt Neon-Rand/Glow + Lamp
- [x] Fix: Patch 141 TypeScript-Order (`stopPolling`/`findRunByJobId`) – Typecheck wieder grün

### Patch 143 — Drawer UI Neon Polish
- [x] Drawer/Sidebar optisch angepasst (Neon Dark + Quick Actions + Chips)
- [x] Cleanup-Note: Backup-Dateien nicht im Repo lassen

### Patch 144 — Drawer UI Grafisch Rund
- [x] Grafische Overlays + Section Icons/Lines
- [x] Pulse-Lämpchen + aktiver Gradient-Rail
- [x] Remove old backup file (`components/ChatHeaderActions.tsx.bak.ui-polish`)

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
- **Patch 134**: ConnectionsScreen Hook Hotfix (duplicate effectiveRepo Declaration entfernt)
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


### Patch 217 — Connection Screen SoT ✅

**E1 — EAS Link Workflow = Source of Truth (persistent)**
- [x] Screen: `screens/ConnectionsScreen/*`
- [x] Wenn EAS Project ID leer: Confirm-Dialog "Keine EAS ID vorhanden! Soll eine erstellt werden?" mit `[Abbrechen] [OK]`
- [x] Bei OK: starte `eas-link.yml` ohne `eas_project_id` (Workflow erstellt/verlinkt und committed `eas-project.json`)
- [x] Akzeptanz: Nach erfolgreichem Workflow wird Status-Lampe **grün** und bleibt persistent (`STORAGE_KEYS.CONN_EAS_OK`).

**E2 — Repo/Supabase/Expo Status persistent**
- [x] Persistente Lampen über `lib/storageKeys.ts` (`CONN_REPO_*`, `CONN_SUPABASE_OK`, `CONN_SUPABASE_REF`, `CONN_EXPO_OK`, `CONN_EXPO_USER`)
- [x] Akzeptanz: App neu starten → Status bleibt korrekt.

**E3 — GitHub: Username + optional Scopes anzeigen**
- [x] Nach GitHub-Test: Username speichern + anzeigen (`CONN_GITHUB_USER`)
- [x] Optional: Token-Scopes aus `x-oauth-scopes` speichern + anzeigen (`CONN_GITHUB_SCOPES`)
- [x] Akzeptanz: Wenn Header fehlt → UI zeigt nichts kaputt, nur keine Scopes.


### Patch 219 — AI Provider Hardening + Docs/Examples SoT + Connections Polish

- [x] Remove phantom model defaults (OpenAI/Anthropic) → use real model IDs
- [x] OpenAI request payload: remove unsupported fields (verbosity)
- [x] Gemini: send multi-turn contents + systemInstruction (no flat prompt string)
- [x] SecureKeyManager: rotation listener instead of monkey-patching in AIContext
- [x] FileWriter: remove overly-aggressive substring reference check (avoid false positives)
- [x] ProjectContext: replace console.log spam with logger
- [x] Docs: update .github/workflows/README.md examples to use SUPABASE_EDGE_FUNCTIONS constants
- [x] Connections: show GitHub scopes cleaner + show Supabase ref (if available)


### Patch 222 — Android-only + CI Lite Persistence

- [x] Diagnostics/Preflight: Text auf Android-only umstellen; `ios/` bleibt als Risiko-Guard.
- [x] CI Lite: Lint/Typecheck Ergebnis persistieren (AsyncStorage) + Build Checklist zeigt optionalen grünen Status.

