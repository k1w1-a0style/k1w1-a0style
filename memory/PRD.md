# PRD

## Original problem statement
Mache deep scan

## User choices
- Scope: ganzer Codebestand
- Ziel: Architektur-/Code-Quality-Review plus Bug-Finding
- Aktion: wichtige Probleme automatisch beheben
- Fokus: API-/Backend-Logik
- Antwortsprache: Deutsch

## Architecture decisions
- Bestehender Stack ist **kein** klassisches frontend/backend-Template, sondern eine **Expo/React-Native-App** mit modularem Screen-/Hook-/Context-Aufbau.
- Die Serverlogik läuft primär über **Supabase Edge Functions** (`supabase/functions/*`) statt über einen separaten Node-/Python-Backend-Ordner.
- Build-/Deploy-Operatorflüsse hängen an **GitHub Actions / EAS Build**; Client-seitige Services sprechen diese Edge-Routen über Supabase an.
- Build-Status und Historie werden clientseitig typisiert über `shared/types/build.ts` und lokale Persistenz-/Hook-Schichten geführt.

## What has been implemented
- High-level Deep Scan durchgeführt: README, Package/Skripte, Kern-Entry-Points, Edge-Routen, Build-Services und relevante Tests geprüft.
- Laufende Repo-Gesundheit verifiziert: `npm run typecheck`, `npm run lint:ci`, `npm run verify:release`, Smoke-/Target-Tests grün.
- Bugfix 1: `check-eas-build` liefert nach GitHub-Reconciliation jetzt sofort die **aktualisierten Failure-Details** aus derselben Response statt veralteter DB-Felder.
- Bugfix 2: `buildPollingService` übernimmt `error_message` jetzt korrekt in `BuildStatusDetails.errorMessage`, damit UI/Build-Historie Fehlergründe nicht verlieren.
- Bugfix 3: Reconciliation-Writeback wird jetzt **truthful** behandelt: wenn das Supabase-Update fehlschlägt, wird keine erfolgreiche Reconciliation behauptet.
- Regressionstests ergänzt/erweitert für Reconciliation-Failure, Error-Message-Mapping und Writeback-Fehlerfall.

## Prioritized backlog
### P0
- Live-End-to-End-Validierung der betroffenen Edge-Flows gegen echte Supabase-/GitHub-Umgebung (ohne Mocks).
- Prüfen, ob weitere Polling-/Statuspfade dieselbe Fehlerdetail-Treue konsequent weiterreichen.

### P1
- Zusätzliche Truthfulness-Tests für weitere Edge-Routen mit DB-Writebacks und degradierte Response-Pfade.
- Kleinere Konsistenzprüfung, wo `error_message` vs. `error` in Responses/Typen verwendet wird.

### P2
- Audit weiterer "best-effort"-/Fallback-Pfade auf Nutzertransparenz.
- Optionales Architektur-Cleanup für besonders große Operator-/Workflow-Strings und Response-Mapper.

## Next tasks
1. Live-Edge-Test der gefixten Build-Status-Kette mit echter `check-eas-build`-Antwort.
2. Regressions-Audit für benachbarte Operatorrouten (`trigger-eas-build`, verwandte Workflow-Statuspfade).
3. UI-Stellen prüfen, die `details.errorMessage` darstellen oder in Historie exportieren.
