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
