- 2026-03-02: Patch 343 prepared: Docs Finalization Pack abgeschlossen (Produkt-/Flow-Doku, Operator-Runbook, Screen-Flow-Map, SoT/Persistenz-Quickref, Release-/Index-Konsistenz, docs:lint Hardening).
- 2026-03-01: Patch 332 prepared: BuildPollingService ohne `any` in Kernpfaden gehärtet (`unknown` catches + sichere JSON-Accessor), dazu neue Regressionstests für non-JSON Antwort, Legacy-Feldauswertung und Abort-Timeout.
- 2026-03-01: Patch 330 prepared: Expo GraphQL malformed-payload regression fixed (200/non-JSON now fails correctly), regression tests added, plus extra `useGitHubRepos` TS-hygiene (`unknown` catches + typed tree entries).
- 2026-03-01: Patch 329 prepared: mehrere Fixlistenpunkte im Connections-Flow gebündelt (Props ohne `any`, Hook-Catches auf `unknown`, typisierte JSON-Responses).
- 2026-03-01: Patch 328 prepared: weitere TS-Hygiene-Fixlistenpunkte umgesetzt (`TerminalContext`/`useBuildStatus` ohne `any`, Catch auf `unknown`), TODO-Stand fortgeschrieben.
- 2026-03-01: Patch 327 prepared: `contexts/ProjectContext.tsx` Catch-Pfade auf `unknown` umgestellt, zentrale Fehlertext-Hilfe ergänzt, TypeScript-Hygiene-Restpunkt fortgeschrieben.
- 2026-03-01: Patch 325 prepared: Restliche Orchestrator-Provider (`gemini`/`groq`/`huggingface`) ohne `any` typisiert, Catch-Pfade auf `unknown` vereinheitlicht, TODO-Fixlistenpunkt aktualisiert.
- 2026-03-01: Patch 324 prepared: Priorisierte Fix-Liste aus Projekt-Audit erstellt und erste Orchestrator-TS-Hardening-Punkte umgesetzt (openai/anthropic/index ohne `any` in zentralen Fehler-/Response-Pfaden).
- 2026-02-28: Patch 323 prepared: AIContext `any`-Cast cleanup in helpers/provider persistence, TODO status synced for TypeScript-hygiene progress.
- 2026-03-05: Patch 357 prepared: CI Lite in-app Autofix dispatch fixed + Statuslogik an GitHub conclusion gebunden.
# Project Checklog

## Patch 321 (2026-02-28)
- Fix-Listenpunkt „Observability" umgesetzt: `usePreview` sendet jetzt minimales `meta.debug` (source + file/dependency count) an `save_preview`.
- `docs/PROJECT_TODO.md` entsprechend synchronisiert (Observability als erledigt markiert).

## Patch 320 (2026-02-28)
- Weitere Fix-Listen-Punkte abgeschlossen: Logger/no-console Follow-up und API-Key-Masking-Review in `docs/PROJECT_TODO.md` auf erledigt gesetzt.
- Verifiziert: zentrale Masking-Calls laufen über `lib/apiKeyMasking.ts` (u.a. Settings/AppInfo) und die zuvor genannten Logger-Hotspots gelten als abgearbeitet.

## Patch 319 (2026-02-28)
- Follow-up-Fix nach Patch 318: `hooks/usePreview.ts` zählt jetzt auch invalide/malformed `projectData.files`-Einträge als `skippedCount`.
- Damit ist das Selection-/Status-Feedback in der Preview-Statusbar konsistent mit tatsächlich verworfenen Dateien.

## Patch 318 (2026-02-28)
- Kritische Restwarnungen aus Patch 314/316/317 geprüft: nicht-autofixbare `any`-Casts in Preview-Pfad entfernt.
- `hooks/usePreview.ts`: Type-Guard für Projektdateien + typisierte Invoke-Optionen ohne `any`.
- `supabase/functions/save_preview/helpers.ts` und `supabase/functions/preview_page/index.ts`: interne Hilfstypen ergänzt, um Meta/File-Zugriffe ohne `any` zu typisieren.

## Patch 317 (2026-02-28)
- Closed next TODO items from fix list: Supabase preview auto-cleanup cron and server-side payload limits for `save_preview`.
- Added shared payload/file limit constants in `save_preview` helpers and explicit file-count guard in request handling.
- Added migration to schedule `cleanup_expired_previews()` hourly via `pg_cron` (idempotent job replace).

## Patch 309 (2026-02-28)
- Synced TODO docs with current implementation status for Connections SoT / Patch 217.
- Marked stale historical Patch A–D checklist in `docs/PROJECT_TODO.md` as done and removed pending drift.

## Patch 213
- Fixed missing `githubApiUrl` import in `screens/ConnectionsScreen/hooks/useConnectionsScreen.ts`.
- Typecheck/lint/tests should pass again after patch 211/212 changes.

## Patch 214
- Fix GitHub repo/branch source-of-truth drift:
  - Prefer `GitHubContext` active repo/branch in CI Lite.
  - Persist repo/branch into `ProjectContext` during backup import so hydration cannot snap back.

## Patch 215
- Centralize GitHub + Supabase “source of truth” strings:
  - GitHub AsyncStorage keys live in `shared/constants/github.ts`.
  - Supabase Edge function names live in `shared/constants/supabase.ts`.

## Patch 216–227 (Summary)

- Patch 216: Docs/TODO/Workflow aufgeräumt.
- Patch 217–218: CI Lite Bugfixes + Supabase Edge SoT + Storage/Connection SoT + Robustness.
- Patch 219: Provider Hardening + Docs/Examples SoT polish + Connections status polish.
- Patch 220: Entfernt AI-Model "Auto" (UI) + Migration von Legacy-Configs auf konkrete Default-Modelle.
- Patch 221: Connections UX polish (Scopes Badges + Missing-Warnung) + Build/CI Shortcut + Supabase Ref/Host Anzeige + TODO/Docs Alignment.
- Patch 222: Android-only cleanup + kleine Connections/Repo Robustness.
- Patch 223: CI Lite Status persistieren + CI Lite Checklist Item im EnhancedBuildScreen.
- Patch 224: CI Lite Details (Run Meta + „in Chat übernehmen") + Connections Sync Summary + Repo Hygiene (openai removed + App.tsx format).
- Patch 225: Gemini Guard + Supabase Edge URL SoT + Logger Cleanup + Remove legacy `exportAndBuild`.
- Patch 226: Logger Sweep in GitHub/Storage Hooks.
- Patch 226.2: Hotfix für kaputten Import-Block in `hooks/useGitHubRepos.ts`.
- Patch 227: CI Lite `applyPatchFromText` deps hardening + Docs alignment.

## Offene Punkte

> Referenz: `docs/TODO.md` (Single Source of Truth).
- Refactor: `components/CiLiteHeaderButton.tsx` in kleinere Teile (Hook + UI Komponenten) aufsplitten.


## Patch 228 (2026-02-20)
- Added docs/DEV_COMMANDS.md and updated docs/INDEX.md + README for search commands without rg.


## Patch 229 (2026-02-20)
- CI Lite: extracted helpers into `components/ciLite/ciLiteUtils.ts` and aligned usages.
- CI Lite: minor robustness/UX improvements + docs alignment.

## Patch 230 (2026-02-21)
- Bundle: Patch 227–229 als ein Apply-ZIP (CI Lite SoT + DEV_COMMANDS + Docs Alignment).
- Patchlog/Index ergänzt (`docs/patches/patch_230.md`).

## Patch 231 (2026-02-21)
- Android-only wording cleanup (remove iOS confusion)

## Patch 232 (2026-02-23)
- Docs/Templates: Android-only wording sweep (workflow docs + templates) while keeping EAS safety guard rationale intact.
- ChatScreen: comment wording cleanup (no iOS mention).

## Patch 233 (2026-02-23)
- Docs/History purge: removed remaining non-target platform wording from documentation/history (text-only).


## Patch 234 (2026-02-23)
- Runtime robustness: Gemini consecutive-role merge + Supabase Edge URL guard + legacy provider safety + logger cleanup.

- 2026-02-23: Patch 235 prepared
- 2026-02-23: Patch 236 prepared (hotfix: broken import block in WorkflowRunDetailModal). Run `npm run test:silent` + `npm run typecheck` after apply. (post-234 cleanup). Run `npm run test:silent` after apply.

- 2026-02-23: Patch 237 prepared (remove placeholder model contextWindow metadata).
- 2026-02-23: Patch 238 prepared (contextWindow smoke values per provider to satisfy integration test).

- 2026-02-23: Patch 239 prepared (stability sweep: FileWriter no silent drops + disable broken build.js + rotateApiKeyOnError cleanup + targeted logger hygiene + Groq model fallback).

- 2026-02-24: Patch 240 prepared (logger sweep: ProjectContext/useChatAIFlow/usePreview + OpenAI o1/o3 temperature guard + deprecate unused rotateApiKeyOnError). Run `npm run test:silent` + `npm run typecheck` after apply.

- 2026-02-24: Patch 241 prepared (infra/logger sweep + OpenAI reasoning regex fix). Run `npm run test:silent` + `npm run typecheck` after apply.

- Patch 242: logger import hotfix (repos.ts). Checks: tests/typecheck green.

- 2026-02-24: Patch 243 prepared (P3 logger sweep: lib services + build services/hooks). Run `npm run test:silent` + `npm run typecheck` + `npm run lint:ci` after apply.

- 2026-02-24: Patch 244 prepared (hotfix: useBuildHistory import syntax). Run `npm run test:silent` + `npm run typecheck` after apply.

- 2026-02-24: Patch 245 prepared (hotfix: BuildHistoryEntry optional fields in useBuildHistory). Run `npm run test:silent` + `npm run typecheck` after apply.

- 2026-02-24: Patch 246 prepared (hotfix: GitHub workflow dispatch token ReferenceError + suppress Android FCM push-token fetch when not configured). Run `npm run test:silent` + `npm run typecheck` after apply.

## Patch 306 (2026-02-28)
- CI Lite Parser robuster für Header-Status (Lint/Typecheck).
- Diagnostics: jeder Check jetzt mit klarer Fix-Route (Auto-Fix oder KI-Fix an Chat).
- Connections: EAS prüfen/verlinken/neu erstellen direkt im EAS-Card-Block.
- Preview: originWhitelist aus Hook korrekt im WebView genutzt (stabilere In-App Preview).
- KI-Modelle um aktuelle Optionen ergänzt, Diagnostics/RepoScreen optisch überarbeitet.

## Patch 307 (2026-02-28)
- Removed remaining expo-lint warnings in diagnostics components by replacing `global as any` checks with typed `globalThis` checks.
- Synced README patch status line to current patch level to avoid docs drift.

## Patch 308 (2026-02-28)
- Added OpenAI provider regression tests to prevent unsupported payload fields (`verbosity`) from creeping back in.
- Added assertion coverage that reasoning models (`o*`) still omit `temperature`.
- Synced TODO/Patchlog status for the finished Patch 219/226 items.

## Patch 310 (2026-02-28)
- Projekt auf offene Aufgaben geprüft und TODO-Backlog aus SoT-Dokumenten konsolidiert.
- Fokusbereiche bestätigt: Preview-Follow-ups, Logger-Migration, TypeScript-Hygiene, Payload-Limits/Observability.


## Patch 311 (2026-02-28)
- P1-Start umgesetzt: Type-Härtung im `EnhancedBuildScreen`-Flow (Hook + Helper + Types) ohne Verhaltensänderung.
- `any`-Casts in den betroffenen Build-Screen-Dateien entfernt und durch konkrete Typen ersetzt.


- Patch 312: EnhancedBuild one-click deploy now treats secrets auto-sync as opt-in (default off) with persistent toggle and explicit step skip state; TODO open item closed.

## Patch 313 (2026-02-28)
- PR-9 follow-up umgesetzt: PreviewScreen UI in `DeviceFrame`, `PreviewToolbar`, `PreviewStatusBar` aufgeteilt.
- `docs/PROJECT_TODO.md` offenen Split-Task als erledigt markiert.

## Patch 314 (2026-02-28)
- PR-9 Follow-up umgesetzt: `preview_page` unterstützt jetzt optionale URL-Toggles für Raw-Logs (`logs`) und Runtime-Error-Overlay (`runtime_errors`).
- Preview-HTML um Toggle-Actions und ein optionales Raw-Log-Panel erweitert.
- `docs/PROJECT_TODO.md` PR-9 Punkt "raw logs/runtime errors" als erledigt markiert.

## Patch 315 (2026-02-28)
- Next fix-list item umgesetzt: ESLint `no-console` als Warn-Baseline aktiviert (`warn`, `error` erlaubt).
- TODO-Sync: `docs/PROJECT_TODO.md` Punkt „ESLint no-console Rule aktivieren“ als erledigt markiert.

## Patch 316 (2026-02-28)
- PR-9 Follow-up umgesetzt: PreviewScreen zeigt jetzt fileCount, Payload-Größe und skippedCount direkt in der Statusbar.
- usePreview zählt übersprungene Dateien konsistent entlang aller Filterpfade inkl. Größenlimit-Abbruch.
- `docs/PROJECT_TODO.md` Punkt zur Preview-Stat-Anzeige als erledigt markiert.


## Patch 322 (2026-02-28)
- TypeScript-Hygiene: Shim-Migration für `contexts/types.ts` gestartet.
- `ProjectContext` und `ProjectContext.types` importieren `AutoFixRequest`/`LastPreviewMeta` nun direkt aus `shared/types/project`.
- TODO/Patchlog-Dokumentation auf den neuen Zwischenstand synchronisiert.
- Patch 326: `contexts/types.ts`-Shim vollständig entfernt, `ProjectContextProps` nach `contexts/projectTypes.ts` ausgelagert und Importe umgestellt.
## Patch 331 (2026-03-01)
- Build-Screen TS-Härtung: `BuildHistorySection` nutzt jetzt `BuildHistoryEntry[]` statt `any[]`, inklusive key-safe CSV-Header (`keyof BuildHistoryEntry`).
- Kleine JSX-Konsistenz: Filter-Block sauber eingerückt (ohne Verhaltensänderung).
- Checks: `npm run typecheck`, `npm run lint:ci`, `npm run test:silent` erfolgreich.
## Patch 333 (2026-03-01)
- BuildPolling timeout handling fixed for AbortError plain-object rejections (`{ name: "AbortError" }`) to preserve normalized timeout message.
- Added regression coverage in `__tests__/buildPollingService.test.ts` for object-shaped AbortError throws.
- Checks: `npm run typecheck`, `npm run lint:ci`, `npm run test:silent` erfolgreich.


## Patch 334 (2026-03-01)
- Verbindliche Projektdoku als Single Source of Truth erstellt:
  - `docs/00-overview.md`
  - `docs/01-state-contract.md`
  - `docs/02-build-pipeline.md`
  - `docs/03-screen-index.md`
  - `docs/04-risk-hotspots.md`
- Evidence-Pflicht umgesetzt (Datei + Symbol + Codeauszug pro Kernaussage).
- Risiken explizit markiert inkl. "UNSICHER" bei nicht belegbarem `ersId`.
- 2026-03-01: Patch 335 prepared: Contract-Invarianten gegen bestehende Tests gemappt, High-Risk-Lücken priorisiert, 12 neue Smoke/Invariant-Testvorschläge + 5 Copy-Paste Stringchecks dokumentiert.

## Patch 336 (2026-03-01)
- Build Readiness Gate als verbindlichen Vertrag dokumentiert (profilabhängige Preconditions, Matrix, Blocker/Warnungen, AutoFix-Pfade).
- `docs/02-build-pipeline.md` um Gate-Regeln + Single Entry Point (`startBuildJob`) erweitert.
- Evidence pro Gate-Baustein ergänzt (Codefundstellen inkl. Ausschnitte).

## Patch 337 (2026-03-01)
- Diagnostics-Landkarte auf Basis `docs/06-build-readiness.md` vervollständigt: alle relevanten Check-IDs + Bedingungen + Zuordnung zu Readiness-Items dokumentiert (`docs/07-diagnostics-fix-playbook.md`).
- Verbindliches „Diagnostics → Fix Playbook“ ergänzt (Blocker/Warnung, AutoFix-Aktion, Manual Steps, Re-Checks) inkl. Gap-Analyse für Blocker ohne robusten Fixpfad.
- Testabdeckung neu gemappt (`docs/08-test-coverage-matrix.md`): vorhandene Tests vs Lücken, 18 priorisierte neue Tests (High/Med), plus Invariant-String-Guards.
- `docs/04-testing-smoke-plan.md` auf Readiness/Diagnostics-Matrix aktualisiert (Smoke-Cases, Prioritäten, Exit-Kriterien).
- Added issue-ready Gap Tickets inkl. Prio/Labels (`docs/09-gap-tickets.md`).
- Added Product & Flows Overview (`docs/10-product-and-flows.md`).
- Added QA/Operator Runbook (`docs/runbooks/APP_RUNBOOK.md`).
- Added Patch Notes (`docs/patches/PATCH_337_NOTES.md`).

## Patch 338 (2026-03-01)
- Phase-2 Testabdeckung umgesetzt: 13 neue High/Med Tests für Pipeline Diagnostics, Local Preflight und Patch Apply Engine.
- Pipeline-Diagnostics-Fix: `repo.easJson.parse` markiert jetzt zuverlässig `fail`, wenn `eas.json` invalid ist.
- Neue Helper-Funktion `applyPreflightPatch` (delete -> upsert -> jsonMerge) mit dedizierter Testabdeckung eingeführt.
- Checks: `npm run typecheck`, `npm run lint:ci`, `npm run test:silent -- --runInBand` erfolgreich.

## Patch 339 (2026-03-01)
- Phase-4 Testability DX umgesetzt, ohne Produktlogik zu ändern: DI-Hooks/Exports für Build Readiness, Pipeline Diagnostics, Preflight Runner und Patch Engine.
- Stabile Build-Readiness Error-Codes eingeführt (`BRANCH_MISSING`, `DIAGNOSTIC_NOT_GREEN`) für robuste Tests + Telemetry.
- Diagnostics-Checkliste UI stabil nach Status sortiert (`fail -> warn -> pass`).
- Neue Med-Tests: Sorting, SmartFix fixable-only, Runner-Resilience (throw-safe).
- Checks: `npm run typecheck`, `npm run lint:ci`, `npm run test:silent`.

## Patch 340 (2026-03-02)
- Phase 6 + 7 kombiniert umgesetzt: lokale E2E-Smoke-Buildflow-Tests mit Fixture-Repos und deterministischen Mocks eingeführt.
- Neue Tests:
  - `__tests__/e2e.smoke.buildflow.test.ts`
  - `__tests__/e2e.smoke.diagnosticsResilience.test.ts`
  - `__tests__/e2e.smoke.diagnosticsSchemaSnapshot.test.ts`
- Neue Fixture-Struktur unter `test/fixtures/smokeRepos/` dokumentiert und genutzt.
- Hardening/Doku ergänzt: `docs/12-release-readiness-report.md`, Updates in `docs/04-testing-smoke-plan.md`, `docs/07-diagnostics-fix-playbook.md`, `docs/08-test-coverage-matrix.md`.

## Patch 341 (2026-03-02)
- Stability hardening ergänzt: globaler No-Network Guard in Jest (`fetch`/`XMLHttpRequest`/`WebSocket`) zur Vermeidung ungewollter realer Netzwerkanfragen in Tests.
- Neue Guard-/Regressions-Tests ergänzt:
  - `__tests__/guards.noNetwork.test.ts`
  - `__tests__/patchEngine.idempotency.test.ts`
  - `__tests__/diagnostics.resultDeterminism.test.ts`
- Verifikation erfolgreich: `npm run test:silent`, `npm test -- --runInBand --silent`, `npm test -- --detectOpenHandles --runInBand --silent`, `npm run typecheck`, `npm run lint:ci`.

## Patch 342 (2026-03-02)
- Documentation hardening umgesetzt: Product/Flows, Operator Runbook, Screen Index + neuer Screen Flow Map, State Quickref.
- Konsistenzpass auf Overview/Index/Build-Pipeline/Release-Readiness durchgeführt.
- `scripts/docsLint.js` eingeführt + `npm run docs:lint` hinzugefügt.
- Checks: `npm run docs:lint`, `npm run typecheck`, `npm run lint:ci`, `npm run test:silent`.

- Patch 352: Fix preview_page bundling (remove nested template literals in embedded script)

- Patch 353: Fix preview_page bundling by importing ./helpers.ts explicitly

- Patch 357: CI Lite in-app Autofix bootstrap + dispatch (workflow template + dispatch endpoint + client hook)
- Patch 358: Fix duplicate `k1w1-ci-lite-autofix.yml` key in workflowTemplates (TS1117)
