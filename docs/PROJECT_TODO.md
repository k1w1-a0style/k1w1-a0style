# PROJECT TODO

> Stand: 2026-02-19

## ✅ Erledigt (aktueller Stand)

### Preview-System
- [x] Supabase `previews` Tabelle + Indizes + Expiry Support
- [x] Edge Function `save_preview` deployed
- [x] Edge Function `preview_page` deployed
- [x] `PreviewScreen` lädt Preview URL (WebView + Hot-Reload)
- [x] `PreviewFullscreenScreen` mit Crash-Recovery, Navigation-Guards, Share
- [x] Gemeinsame WebView-Logik extrahiert (`useWebViewNavigation`, `useWebViewCrashRecovery`)
- [x] Kritischer Bug in `PreviewFullscreenScreen` behoben (dead-code Guard, Patch 200)

### Architektur / Refactoring
- [x] PR-2: Storage-Persistence → `infra/storage`
- [x] PR-3: Build-Polling → `project/services`
- [x] PR-4: GitHub-Service → `infra/github` (barrel exports)
- [x] PR-5: ProjectContext-Splits (template loader, archive, build trigger, polling)
- [x] PR-6: Template-Checklist modularisiert (patchers, defaults, barrel)
- [x] PR-7: Legacy-Facades entfernt, ESLint-Guardrails enforced
- [x] PR-8: Build-Typen vereinheitlicht (`shared/types/build` als single source of truth)
- [x] PR-9 Stage 1: PreviewScreen + PreviewFullscreenScreen refactored (Patch 200)
- [x] EnhancedBuildScreen: Helpers + Preconditions Hook extrahiert
- [x] Dead Code entfernt: `lib/previewBuild.ts`, `lib/previewSettings.ts`, `styles/previewScreenStyles.ts`
- [x] `lib/logger.ts` erstellt (zentraler Logger)
- [x] `contexts/types.ts` als Compatibility-Shim mit Deprecation-Kommentar

### Test-Infra
- [x] Jest global timeout auf 20s erhöht (Patch 199)
- [x] One-Click Deploy Tests stabilisiert

---

## 🔥 Offene Bugs / Tech-Debt

- [ ] **Logger / no-console (optional)** — `lib/logger.ts` existiert; wenn wir strengere Logs wollen: Hotspots von `console.*` → `logger` migrieren und ESLint `no-console` schärfen
- [ ] **`contexts/types.ts` Shim** — noch in Nutzung; schrittweise Migration auf `shared/types/*`, danach Shim löschen
- [ ] **382 `: any` Annotationen** — systematischer TS-Safety-Debt, besonders in `contexts/`, `lib/orchestrator.ts`

---

## 🚧 Nächste sinnvolle Schritte

### CI Lite / Build / SoT (Patch 216+)

> Diese Liste ist bewusst „exekutierbar“ geschrieben: Datei → Änderung → Done.

- [ ] **Patch A (Bugfix):** `components/CiLiteHeaderButton.tsx`
  - [ ] Dead code: `topContent` useMemo entfernen (oder bewusst rendern)
  - [ ] `applyPatchFromText` deps fixen (stale-closure vermeiden)
  - [ ] Polling unmount-cleanup (`stopPolling` in cleanup)

- [ ] **Patch B (SoT Supabase Functions):** `shared/constants/supabase.ts`
  - [ ] `CHECK_EAS_BUILD` + `SAVE_PREVIEW` ergänzen
  - [ ] Alle Hardcodes auf Constants umstellen:
    - [ ] `components/CiLiteHeaderButton.tsx` (github-workflow-*)
    - [ ] `project/services/buildStartService.ts` (trigger-eas-build)
    - [ ] `project/services/buildPollingService.ts` (check-eas-build)
    - [ ] `hooks/usePreview.ts` (save_preview)
  - [ ] Duplicate Helper löschen: `project/services/buildPollingService.ts` → `lib/supabaseEdge.ts`

- [ ] **Patch C (Storage Keys):** `diagnostic_last_ok` zentralisieren und beide Call-Sites umstellen

- [ ] **Patch D (Robustness):** `infra/github/tokenStore.ts` SecureStore Error-Handling vereinheitlichen

### PR-9 (Preview — weitere Stages)
- [ ] `PreviewScreen` Komponente weiter splitten: `DeviceFrame.tsx`, `PreviewToolbar.tsx`, `PreviewStatusBar.tsx`
- [x] `useWebViewCrashRecovery` auch in `PreviewScreen` (usePreviewScreen) einbinden
- [ ] In `preview_page` Edge Function: optionaler Toggle für „raw logs" / „runtime errors"
- [ ] In `PreviewScreen`: Anzeige von fileCount/size/skipped (was wurde gesendet)
- [ ] Auto-Cleanup-Cron in Supabase: `cleanup_expired_previews()` regelmäßig triggern

### Logger-Migration
- [ ] `lib/logger.ts` aktiv nutzen: console.log in `contexts/ProjectContext.tsx` (13x), `infra/storage/projectPersistence.ts` (10x), `lib/buildHistoryStorage.ts` (7x) ersetzen
- [ ] ESLint `no-console` Rule aktivieren (warn für bestehende, error für neue)

### API Key Masking
- [ ] `lib/apiKeyMasking.ts` Review: sicherstellen, dass alle UI-Callsites die lib-Implementierung nutzen (SettingsScreen keyMasking wurde entfernt)

### Stabilität
- [ ] Server-side Payload Limits (save_preview): harte max bytes + max files enforced
- [ ] Observability: Edge Function Logs + optionales `meta.debug` (minimal)

### TypeScript-Hygiene
- [ ] `any`-Annotationen reduzieren: Start mit `lib/orchestrator.ts` und `contexts/AIContext.tsx`
- [ ] `contexts/types.ts` Shim-Migration: 36 Imports schrittweise auf `shared/types/*` umstellen
