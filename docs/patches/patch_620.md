# Patch 620 - Serverseitiger JWT-/RBAC-Drift im Shared-Auth-Role-Read behoben

## Kontext
Ein frischer Login lieferte bereits korrekt `role=build_admin` und `app_metadata.role=build_admin` im JWT. Trotzdem antworteten produktive Operator-Routen (u. a. `github-workflow-runs`, `android-keystore-status`) weiter mit `Forbidden: verified JWT role is not allowed for this route.`

## Root-Cause
Der Drift lag im serverseitigen Shared-Auth-Rollenread in `supabase/functions/_shared/auth.ts`:
- Nach erfolgreicher JWT-Verifikation gegen Supabase Auth wurde die Rolle zuerst aus `auth/v1/user.role` gelesen.
- Dieses Feld ist in der Praxis haeufig `authenticated`, selbst wenn der verifizierte Token-Claim `role=build_admin` traegt.
- Dadurch lief der Allowlist-Vergleich (`service_role|build_admin`) gegen den falschen Wert und blockte faelschlich.

## Fix
- `requireJwtRole(...)` liest den Rollenwert jetzt nach erfolgreicher Verifikation **primaer aus dem verifizierten JWT-Claim**:
  1. `payload.role`
  2. `payload.app_metadata.role`
  3. defensiver Fallback: `user.app_metadata.role`
  4. defensiver Fallback: `user.role`
- Sicherheitsvertrag bleibt fail-closed:
  - erlaubt nur Rollen aus `allowedRoles`
  - keine Aufweichung auf `authenticated`
  - kein Bypass der Verifikation

## TypeScript-Resolvings (`_shared/auth.ts`)
Die zwei bekannten Edge-Typecheck-Restpunkte sind ebenfalls final sauber:
1. `res.json().catch((): unknown => null)` statt implizitem `any`
2. explizites Union-Narrowing ueber `if (verified.ok === false)` vor Zugriff auf `verified.reason`

## Tests
- `__tests__/auth.failClosedAndDurableRateLimit.test.ts` enthaelt eine neue Regression:
  - verifiziertes JWT mit `role=build_admin` wird akzeptiert, auch wenn `auth/v1/user.role` auf `authenticated` steht.
