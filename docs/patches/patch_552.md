# Patch 552 - Pilot JWT/RBAC hardening for `android-keystore-export`

## Ziel
- Kleiner, betriebssicherer Pilot-Schritt fuer echte JWT-/Claim-Haertung auf einer High-Impact-Route.
- Keine globale Auth-Migration; `github-workflow-dispatch` bleibt bewusst secret-basiert.

## Umsetzung
- `supabase/functions/android-keystore-export`:
  - `verify_jwt = true` aktiviert (Root-Config + Route-Config).
  - Guard erweitert: JWT muss vorhanden sein und `role=service_role` tragen.
  - Bestehender route-scoped Admin-Key-Guard bleibt aktiv (`K1W1_EDGE_ANDROID_KEYSTORE_EXPORT_ADMIN_KEY`).
- Shared Auth:
  - minimale JWT-Helper ergaenzt (`getJwtPayload`, `requireJwtRole`) mit deny-by-default Fehlerpfaden.
- Caller-Sync:
  - EAS-/Release-Workflows senden beim Keystore-Export jetzt zusaetzlich
    `Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}`.
- Invariants:
  - neue/angepasste Tests fuer `verify_jwt=true`, JWT-Role-Guard und Caller-Header.

## Validierung
- `npm run typecheck`
- `npm run edge:check`
- `npm run lint:ci`
- `npm run test:silent`
