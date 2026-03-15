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

- [x] **Logger / no-console (optional)** — `lib/logger.ts` existiert; Hotspots von `console.*` → `logger` migriert und ESLint `no-console` geschärft ✅ *(patch 315/320)*
- [x] **`contexts/types.ts` Shim** — Migration abgeschlossen: Shim entfernt, `ProjectContextProps` nach `contexts/projectTypes.ts` ausgelagert ✅ *(patch 326)*
- [ ] **`: any` Annotationen reduzieren** — weiterhin systematischer TS-Safety-Debt, aktuell Fokus auf Build-/Infra-Services; Patch 327/328/329/330/331/332 reduzierte bereits zentrale Hotspots (`contexts`, `hooks`, `EnhancedBuild`, `buildPollingService`) mit `unknown`-Catches und typisierten JSON-Zugriffen.

---

## 🚧 Nächste sinnvolle Schritte

### CI Lite / Build / SoT (Historie, bereits umgesetzt)

> Diese Liste ist bewusst „exekutierbar“ geschrieben: Datei → Änderung → Done.

- [x] **Patch A (Bugfix):** `components/CiLiteHeaderButton.tsx`
  - [x] Dead code: `topContent` useMemo entfernen (oder bewusst rendern)
  - [x] `applyPatchFromText` deps fixen (stale-closure vermeiden)
  - [x] Polling unmount-cleanup (`stopPolling` in cleanup)

- [x] **Patch B (SoT Supabase Functions):** `shared/constants/supabase.ts`
  - [x] `CHECK_EAS_BUILD` + `SAVE_PREVIEW` ergänzen
  - [x] Alle Hardcodes auf Constants umstellen:
    - [x] `components/CiLiteHeaderButton.tsx` (github-workflow-*)
    - [x] `project/services/buildStartService.ts` (trigger-eas-build)
    - [x] `project/services/buildPollingService.ts` (check-eas-build)
    - [x] `hooks/usePreview.ts` (save_preview)
  - [x] Duplicate Helper löschen: `project/services/buildPollingService.ts` → `lib/supabaseEdge.ts`

- [x] **Patch C (Storage Keys):** `diagnostic_last_ok` zentralisieren und beide Call-Sites umstellen

- [x] **Patch D (Robustness):** `infra/github/tokenStore.ts` SecureStore Error-Handling vereinheitlichen

### PR-9 (Preview — weitere Stages)
- [x] `PreviewScreen` Komponente weiter splitten: `DeviceFrame.tsx`, `PreviewToolbar.tsx`, `PreviewStatusBar.tsx` ✅ *(patch 313)*
- [x] `useWebViewCrashRecovery` auch in `PreviewScreen` (usePreviewScreen) einbinden
- [x] In `preview_page` Edge Function: optionaler Toggle für „raw logs" / „runtime errors" ✅ *(patch 314)*
- [x] In `PreviewScreen`: Anzeige von fileCount/size/skipped (was wurde gesendet) ✅ *(patch 316)*
- [x] Auto-Cleanup-Cron in Supabase: `cleanup_expired_previews()` regelmäßig triggern ✅ *(patch 317)*

### Logger-Migration
- [x] `lib/logger.ts` aktiv nutzen: frühere `console.log`-Hotspots in `contexts/ProjectContext.tsx`, `infra/storage/projectPersistence.ts`, `lib/buildHistoryStorage.ts` sind aufgeräumt/ersetzt ✅ *(patch 320 Review)*
- [x] ESLint `no-console` Rule aktivieren (warn für bestehende, error für neue) ✅ *(patch 315)*

### API Key Masking
- [x] `lib/apiKeyMasking.ts` Review: UI-Callsites nutzen die zentrale lib-Implementierung (`SettingsScreen`, `AppInfoScreen`) ✅ *(patch 320 Review)*

### Stabilität
- [x] Ownership-/Permissions-Guardrails für Template/Baseline vs. Chat vs. Diagnosis/Autofix zentralisiert (Patch 432)
- [x] Server-side Payload Limits (save_preview): harte max bytes + max files enforced ✅ *(patch 317)*
- [x] Observability: Edge Function Logs + optionales `meta.debug` (minimal) ✅ *(patch 321)*

### TypeScript-Hygiene
- [x] Shim-Migration gestartet: `ProjectContext`/`ProjectContext.types` importieren `AutoFixRequest`/`LastPreviewMeta` direkt aus `shared/types/project` ✅ *(patch 322)*
- [x] `any`-Annotationen reduzieren: AIContext-Teil (Patch 323), Orchestrator-Startschritt (Patch 324: openai/anthropic/index) und Provider-Hotspots (Patch 325: gemini/groq/huggingface) erledigt
- [x] `contexts/types.ts` Shim-Migration: abgeschlossen (keine Runtime-Imports mehr; Shim-Datei entfernt) ✅ *(patch 326)*

### Ownership / Change Permissions (neu)
- [ ] Optional: feingranulare Freigabe-UI für manuelle Overrides kritischer Pfade (derzeit konservativ vollständig blockiert).

## Patch 217 (done)
- ✅ Applied historically: CI Lite bugfixes + Supabase edge SoT expansion + Storage key SoT + tokenStore consistency + Connection Screen SoT.
- Optional weiterhin offen: Performance-Cleanup in `useBuildStatus` (statusRef), falls nötig.

### UX-/Flow-Feintuning (Patch 440)
- [x] Build/Diagnosis/Preview/Connections/Credentials/Chat-Mikrotexte auf Alltagssprache und klare Zustandsgrenzen (`gespeichert` vs. `letzter bekannter Stand`) geschärft
- [ ] Optional: CI-Lite-Header-Status zusätzlich mit gleichem Wording-Muster angleichen (nur wenn ohne visuelle Überladung möglich)
