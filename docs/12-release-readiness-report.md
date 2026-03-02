# 12 — Release Readiness Report (Phase 6 + 7)

Stand: 2026-03-02

## 1) Buildflow Gate Status

| Bereich | Status | Kriterium | Ergebnis |
|---|---|---|---|
| Local Preflight Diagnostics | 🟢 Grün | Checks laufen stabil + AutoFix loop möglich | Erfüllt |
| Pipeline Diagnostics (mocked/offline) | 🟢 Grün | Repo/Config/Secrets Checks deterministisch | Erfüllt |
| Secrets Missing Simulation | 🟡 Gelb | `repo.secret.expoToken` fail bei leerer Secret-Liste | Erwartetes Fail |
| Build Start Branch/Repo Hard-Block | 🟢 Grün | Kein stiller Branch/Repo fallback | Bereits durch Gate-Tests abgesichert |
| Workflow YAML Safety | 🟢 Grün | Colon-Quoting AutoFix greift | Erfüllt |

## 2) Diagnostics Summary

- Gesamte lokale Check-Suite: über `runPreflightChecksAll` (vollständige Registry)
- Neue Smoke-Fixtures decken 4 kritische Fehlerzustände ab.
- AutoFix-Abdeckung (P0-kritisch):
  - EAS projectId Linking Action (workflow dispatch)
  - Canonical `eas.json` (upsert/jsonMerge)
  - Minimal Expo Config (`app.json`)
  - Workflow-Name Colon Quoting

Manual-only (bewusst):
- Forbidden Files / Security-Leaks (inkl. Key-Rotation)
- Token/Permission-Härtung auf GitHub Secrets API Zugriff

## 3) P0 / P1 Gaps

- **P0 offen: 0** (für den hier getesteten lokalen Buildflow-Scope)
- **P1 offen:**
  - Erweiterte Security-Runbooks für Leak-Sanierung bleiben manuell
  - Optional zusätzliche Gate-Visualisierung für Yellow-Status in UI

## 4) Test Summary

- Neue Testdateien Phase 6/7:
  - `__tests__/e2e.smoke.buildflow.test.ts`
  - `__tests__/e2e.smoke.diagnosticsResilience.test.ts`
  - `__tests__/e2e.smoke.diagnosticsSchemaSnapshot.test.ts`
  - `__tests__/helpers/testDeps.ts`
- Enthält fixture-basierte Smoke-Läufe inkl. Re-Scan und Snapshot-Stabilität.

## 5) Risiken (Rot/Gelb)

- 🟡 Secrets bleiben absichtlich extern (kein echtes Network/Secret-Write im Test) → nur simuliert.
- 🟡 Produktions-Signing/Keystore bleibt außerhalb lokaler Smoke-Scope.
- 🔴 Kein bekannter unadressierter Crash-Risk im Runner (resilience test vorhanden).

## 6) How to run

```bash
npm run typecheck
npm run lint:ci
npm run test:silent
```

Nur Smoke fokussiert:

```bash
npm test -- --runInBand __tests__/e2e.smoke.buildflow.test.ts __tests__/e2e.smoke.diagnosticsResilience.test.ts __tests__/e2e.smoke.diagnosticsSchemaSnapshot.test.ts
```
