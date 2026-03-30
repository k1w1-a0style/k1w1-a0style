# Patch 622 - Verbleibenden Live-RBAC-Decode-Drift im Shared-Auth-Guard geschlossen

## Kontext
Ein frischer Login lieferte weiterhin verifizierbar `role=build_admin` im JWT, dennoch blockten Live-Operator-Calls (u. a. `github-workflow-runs`, `android-keystore-status`) mit `Forbidden: verified JWT role is not allowed for this route.`

## Root-Cause
Der verbleibende Drift lag im finalen Shared-Auth-Pfad `supabase/functions/_shared/auth.ts` beim JWT-Payload-Decode:

- `decodeJwtPayload(...)` nutzte `atob(...)` und parse-te den resultierenden String direkt als JSON.
- Das ist fuer reines ASCII meist stabil, aber nicht UTF-8-sicher.
- Enthielt der Token in beliebigen Nebenclaims Non-ASCII-Zeichen (z. B. in `user_metadata`), konnte der lokale Parse fehlschlagen.
- Dann war `payload` intern `null` und der Rollenpfad fiel im finalen Match wieder auf den verifizierten User-Read (`auth/v1/user.role`) zurueck, der oft `authenticated` ist.
- Ergebnis: `allowedRoles: ["service_role", "build_admin"]` wurde gegen den falschen Wert geprueft und blockte faelschlich.

## Fix (minimal, fail-closed)
- In `decodeJwtPayload(...)` wird der Base64URL-Teil jetzt in Bytes ueberfuehrt und UTF-8-sicher via `TextDecoder` dekodiert, erst danach `JSON.parse`.
- Keine Aenderung am Security-Vertrag:
  - erlaubt bleiben nur `service_role` und `build_admin` (je nach Route-allowlist),
  - `authenticated` bleibt unzureichend,
  - kein unverified Fallback, kein Bypass.

## Tests / Regression
- `__tests__/auth.failClosedAndDurableRateLimit.test.ts` erweitert:
  - neuer Regressionstest mit verifiziertem `build_admin`-JWT, der zusaetzlich Non-ASCII-Claims enthaelt.
  - Erwartung: finaler Allowlist-Match akzeptiert `build_admin` weiterhin, auch wenn `auth/v1/user.role` nur `authenticated` liefert.

## Betroffene Operator-Routen
Alle Routen, die ueber `requireWorkflowOperatorJwtRole(...)` oder `requirePrivilegedOperatorJwtRole(...)` den finalen Shared-Matcher nutzen, profitieren unmittelbar; live repro war insbesondere:
- `github-workflow-runs`
- `android-keystore-status`

## Verifikation
- `npm run edge:check`
- `bash scripts/check_workflow_edge_contracts.sh`
- `bash scripts/check_edge_helper_visibility.sh`
- `npm run typecheck`
- `npm run lint:ci`
- `npm run test:silent`
