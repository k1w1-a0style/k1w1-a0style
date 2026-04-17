# PRD

## Original Problem Statement
Mach einen deep scan und prüfe alles kritisch.

## User Choices
- Erst Gesamtzustand kritisch prüfen
- Aktiv testen
- Danach P0 Live-Supabase/Edge verifizieren, P1 Preview-/supabaseEdge-Härtung und Hotspot-Entschärfung, P2 Observability/Deprecated-Dependencies bereinigen
- Nur kleine sichere Härtungen, keine großen Refactors

## Architekturentscheidungen / Ist-Zustand
- Repository ist eine Expo/React-Native-App mit TypeScript, umfangreichen Jest-Regressionen und Supabase Edge Functions
- Kritische Betriebsqualität wird repo-seitig über `typecheck`, `lint`, `docs`-Checks, `test:silent` und `verify:release` abgesichert
- Live-Edge-Verifikation erfolgt über `scripts/check_edge_live_contracts.sh` mit `EDGE_BASE_URL` + `EDGE_OPERATOR_JWT`
- Management-/Advisor-Ebene von Supabase-MCP blieb ohne separaten MCP-Zugriffstoken weiterhin außerhalb direkter Tool-Verifikation

## Was in diesem Durchlauf umgesetzt wurde
- Deep Scan des Repos, aktive Ausführung der Kern-Gates und zusätzliche Pattern-/Hotspot-Scans
- P0 teilweise real verifiziert: Live-Edge-Contracts (`k1w1-handler`, `preview_page`, `save_preview`) erfolgreich gegen die echte Supabase-Edge geprüft
- `verify:release` mit Live-Variablen erfolgreich auf `OK_FULL` gebracht
- P1-Härtungen umgesetzt:
  - `lib/supabaseEdge.ts`: Storage-Unreadable-Fallback loggt jetzt sichtbar statt still auf `null` zu degradieren
  - `hooks/usePreviewCreation.ts`: Local-Preview nutzt jetzt getrennte Opt-ins für Eval und externes CDN (`EXPO_PUBLIC_ENABLE_UNSAFE_LOCAL_PREVIEW_EVAL` + `EXPO_PUBLIC_ENABLE_UNSAFE_LOCAL_PREVIEW_CDN`)
  - `infra/github/files/gitDataApi.ts`: Batch-Guard >200 Repo-Operationen fail-closed vor Branch-/Netzwerk-Side-Effects
- P1-Regressionstests ergänzt:
  - `__tests__/usePreviewCreation.localEvalGate.test.ts`
  - `__tests__/gitDataApi.batchGuard.preNetwork.test.ts`
  - bestehende Tests für `supabaseEdge` / `gitDataApi` erweitert
- P2-Bereinigung umgesetzt:
  - ungenutztes/deprecated `@testing-library/jest-native` entfernt
  - `prepare`-Script von `husky install` auf `husky` modernisiert
  - `scripts/docsLint.js` angepasst, damit workflow-required `memory/PRD.md` kein falscher Lint-Fehler mehr ist
- Test-Credentials dokumentiert in `/app/memory/test_credentials.md`

## Validierung
- `npm run typecheck` ✅
- `npm run lint:ci` ✅
- gezielte Jest-Regressionen für die neuen Härtungen ✅
- `npm run test:silent` ✅
- `bash scripts/check_edge_live_contracts.sh` mit realem JWT ✅
- `npm run verify:release` mit Live-Variablen ✅ (`OK_FULL`)

## Priorisierter Backlog

### P0
- Optional: Supabase-Management-/Advisor-Ebene zusätzlich mit echtem MCP-/Admin-Zugriff prüfen (Security Advisors, Performance Advisors, Tabellen-/Function-Metadaten)

### P1
- Weitere kleine Entschärfung der größten Hotspots nur dort, wo echter Sicherheits- oder Review-Gewinn entsteht (`usePreviewScreen`, `WebCodeEditor`, `useConnectionsSaveActions`)
- Prüfen, ob zusätzliche harte Grenzen für große Repo-Syncs auch UX-seitig klarer kommuniziert werden sollen

### P2
- Weitere Deprecation-/Tooling-Hygiene bei transitive warnings nur, wenn sie ohne Scope-Creep sauber ersetzbar ist
- Observability-Richtlinie für `polyfills.ts` prüfen (`console.log/info/debug` in Produktion global stumm)

## Nächste sinnvolle Tasks
1. Falls gewünscht: verbleibende P1-Hotspots im kleinen sicheren Rahmen weiter härten
2. Optional: Supabase-Management-/Advisor-Check nachreichen, sobald passender Admin-/MCP-Zugriff verfügbar ist
3. Danach erneuter Abschlusslauf mit denselben Gates


## Zusatzdurchlauf: Hotspot-Härtung
- `useConnectionsSaveActions.ts`: Save-Flow nutzt jetzt einen stabilen `repoScopeAtSaveStart`, damit Repo-Scoped EAS-Persistenz nicht durch einen parallelen Repo-Wechsel driftet
- `usePreviewScreen.ts`: Reset/Create räumt ausstehende Hot-Reload-Timer jetzt explizit auf, damit kein verspätetes Re-Create gegen die Reset-Intention läuft
- `WebCodeEditor.tsx`: Fallback-Bridge dispatcht injizierte Nachrichten jetzt konsistent an `window` und `document`
- Zusätzliche Regressionen/Invariant-Checks ergänzt in:
  - `__tests__/connectionsAndBackupRecoverable.invariants.test.ts`
  - `__tests__/previewLifecycleTruthfulness.invariants.test.ts`
  - `__tests__/bridgeValidation.test.ts`

## Finaler Validierungsstand
- `npm run typecheck` ✅
- `npm run lint:ci` ✅
- gezielte Hotspot-Regressionen ✅
- `npm run test:silent` ✅
- `npm run verify:release` mit Live-Variablen ✅ (`OK_FULL`)


## Zusatzdurchlauf: Supabase-Advisor-/Management-Check
- Management API mit persönlichem `SUPABASE_ACCESS_TOKEN` erfolgreich geprüft
- Projektstatus live: `ACTIVE_HEALTHY`, Region `eu-north-1`, Postgres `17.6.1.031`
- Live-Edge-Funktionsinventar: 20 aktive Functions
- Public-Tabellen live erkannt: `build_jobs`, `diagnostic_uploads`, `diagnostics_reports`, `edge_rate_limit_events`, `lint_jobs`, `native_sync_jobs`, `native_sync_reports`, `previews`, `signing_android`, `signing_audit_log`
- Security-Advisor-Fund: `Leaked Password Protection Disabled` (WARN)
- Performance-Advisors: 11 `unused_index`-Hinweise, u. a. auf `diagnostics_reports`, `diagnostic_uploads`, `previews`, `native_sync_jobs`, `native_sync_reports`, `build_jobs`
- Kritischer Live-/Repo-Drift bestätigt:
  - `trigger-lint`, `check-lint`, `trigger-native-sync`, `check-native-sync`, `native-sync-report`, `native-sync-report-ingest`, `create_codesandbox` sind live `ACTIVE`, obwohl sie im Repo als deaktiviert geführt werden
  - dieselben Live-Functions stehen aktuell auf `verify_jwt=false`, während das Repo `verify_jwt=true` vorgibt
  - zusätzliche live-only Function `test` vorhanden, die im Repo-Config-Stand nicht geführt ist

## Priorisierter Backlog (aktualisiert)
### P0
- Live-Edge-Drift zwischen Repo und Supabase Functions bereinigen: deaktivierte Legacy-/Tooling-Functions live prüfen und entweder deaktivieren/redeployen oder bewusst neu dokumentieren
- Öffentlich geposteten persönlichen Supabase Access Token sofort widerrufen und neu erstellen

### P1
- `Leaked Password Protection` in Supabase Auth aktivieren, falls keine bewusste Produktentscheidung dagegen spricht
- Unused-Index-Liste verifizieren, bevor Indizes entfernt werden (echte Nutzung vs. kalte/neue Pfade)


## Zusatzdurchlauf: Repo-vs-Live-Drift-Analyse ohne Live-Mutation
- Neuer manueller Audit-Checker hinzugefügt: `scripts/check_supabase_live_management_drift.js`
- Testabdeckung ergänzt: `__tests__/supabaseLiveManagementDrift.test.ts`
- Branch-Abgleich durchgeführt:
  - aktueller Agent-Branch: `emergent`
  - Zielbranch / origin HEAD: `main`
  - für die betroffenen Edge-Functions kein relevanter Source-Diff zwischen `emergent` und `origin/main`
- Verdichtung der Drift-Ursache:
  - die 6 Lint-/Native-Sync-Functions sind live zuletzt am `2026-03-05` aktualisiert worden, während Repo-SoT sie inzwischen auf `enabled=false` und `verify_jwt=true` führt
  - `create_codesandbox` und `test` wurden live zuletzt am `2026-03-29` aktualisiert; `create_codesandbox` bleibt damit ebenfalls vor der späteren Repo-Härtung `verify_jwt=true`
  - daraus ergibt sich aktuell eher ein **älterer/live abweichender Deploy-Stand** als ein agent-branch-spezifischer Drift
- Zusätzliche Index-Einordnung:
  - mehrere vom Advisor gemeldete unused indexes sind im Repo vorhanden (`diagnostics_reports_created_at_idx`, `diagnostic_uploads_*`, `build_jobs_*`)
  - mehrere andere wirken derzeit live-only bzw. nicht im Repo-Migrationsstand nachvollziehbar (`previews_id_secret_idx`, `previews_updated_at_idx`, `previews_secret_idx`, `native_sync_jobs_repo_idx`, `native_sync_jobs_status_idx`, `native_sync_reports_job_id_idx`)
  - daher aktuell **keine** blinde Lösch-Empfehlung
