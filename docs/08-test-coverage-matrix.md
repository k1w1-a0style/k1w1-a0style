# 08 — Test Coverage Matrix

Stand: **2026-04-07 (Patch 750 Contract-/Release-Truth Sync)**

Diese Matrix beschreibt **den heute relevanten Testfokus**. Sie ist keine historische Lueckenliste alter Scanlaeufe mehr.

## 1) Repo-interne Pflichtchecks

| Bereich | Soll | Repo-Check |
|---|---|---|
| App-Typecheck | gruen | `npm run typecheck` |
| Edge-Typecheck | gruen | `npm run typecheck:edge` |
| stricter Kern-Typecheck | gruen | `npm run typecheck:strict` |
| Lint | gruen | `npm run lint:ci` |
| Haupttests | gruen | `npm run test:silent` |
| E2E-Smoke | optional gruen | `npm run test:e2e:smoke` |
| Doku-Lint | gruen | `npm run docs:lint` |
| Doku-Contracts | gruen | `npm run docs:check:contracts` |
| Release-Verify | gruen mit Live-Env, sonst ehrlich `OK_WITH_SKIPS` | `npm run verify:release (inkl. App-Typecheck nur, wenn `node_modules/expo/tsconfig.base.json` vorhanden ist)` |

## 2) Kritische fachliche Vertragsanwaerter

| Bereich | Erwartung |
|---|---|
| ZIP-Import | vor und nach dem Entpacken gehaertet |
| Build-Readiness | fail-closed, repo/branch-scoped |
| Persistenz | verschluesselt, Altstaende nur kontrolliert migriert |
| Edge JSON-/Payload-Limits | byte-genau und fail-closed |
| Auth / RBAC | JWT + Claim + scoped secret, keine stillen Legacy-Fallbacks |
| Doku-SoT | README / INDEX / REVIEW / TODO / Runbooks konsistent |

## 3) Sinnvolle Folgechecks ausserhalb dieser Umgebung

Diese Punkte sind **nicht offen im Repo**, aber in einer echten Paket-/Staging-Umgebung sinnvoll:

1. kompletter Jest-Lauf mit allen installierten Dependencies
2. `npm run lint:ci`
3. read-only Live-Edge-Checks gegen Staging
4. gezielte Operator-Smokes mit real provisioniertem `build_admin`
