# Patch 561 — Edge JWT fail-closed + durable Rate-Limit fuer kritische Routen

## Ziel
Den letzten offenen Auth-/JWT-/Rate-Limit-Block minimal und ehrlich schliessen:

1. **Keine Rollen-Autorisierung mehr aus nur decodierter JWT-Payload**
2. **Kritische Edge-Routen nicht mehr nur instanz-lokal drosseln**

## Umsetzung

### 1) `_shared/auth.ts`: JWT-Rollenpruefung fail-closed auf verifizierter Basis
- `requireJwtRole(...)` ist jetzt **asynchron** und nutzt `verifyJwtViaSupabaseAuth(...)`.
- Verifikation laeuft ueber `GET /auth/v1/user` mit dem eingehenden Bearer-JWT; nur wenn Supabase Auth den Token akzeptiert, wird eine Rolle ausgewertet.
- Rollenquelle ist verifizierter User-Response (`user.role`, fallback `user.app_metadata.role`).
- Wenn JWT fehlt/nicht verifizierbar ist: `401` (kein permissiver Decode-Fallback).
- `getJwtPayload(...)` bleibt nur als Decode-Helper fuer nicht-autorisierende Kontexte (z. B. Audit-Attribution), aber **nicht** als Autorisierungsgrundlage.

### 2) `_shared/auth.ts`: durable Rate-Limit primitive
- Neu: `requireDurableRateLimit(...)`.
- Implementierung: schreibt Event in `public.edge_rate_limit_events` und zaehlt Events im Zeitfenster via PostgREST (`content-range` count).
- Antwort bei Ueberschreitung: `429 rate_limited` mit `mode: "durable"`.
- Bei fehlender Supabase-URL/Service-Role-Secrets: **500 fail-closed** fuer diese Schutzebene.
- Bestehendes `rateLimit(...)` bleibt als `mode: "local_best_effort"` klar als instanz-lokaler Zusatzschutz erhalten.

### 3) Kritische/betroffene Routen auf neuen Guard-Vertrag gezogen
- JWT-Rollencheck-Aufrufe auf `await requireJwtRole(...)` umgestellt in:
  - `android-keystore-export`
  - `github-workflow-dispatch`
  - `github-workflow-runs`
  - `github-workflow-logs`
  - `github-run-artifact-json`
  - `trigger-eas-build`
  - `check-eas-build`
- Durable Rate-Limit aktiviert in:
  - `android-keystore-generate`
  - `android-keystore-export`
  - `github-workflow-dispatch`
  - `trigger-eas-build`
  - `check-eas-build`
  - sowie workflow-/artifact-/logs-nahe Routen `github-workflow-runs`, `github-workflow-logs`, `github-run-artifact-json`.

### 4) Supabase durable store
- Neue Migration: `20260328090000_edge_rate_limit_events.sql`
- Tabelle `public.edge_rate_limit_events` + Index auf `(scope, subject, created_at desc)`.
- RLS deny fuer anon/authenticated; nur `service_role` hat Zugriff.

## Tests
- Neu: `__tests__/auth.failClosedAndDurableRateLimit.test.ts`
  - unverified/manipuliertes JWT wird trotz dekodierbarer `role` geblockt
  - verifizierter JWT-User-Rollenpfad bleibt funktional
  - durable Counter liefert 429 bei Limitueberschreitung
- Invariant-Tests angepasst fuer async JWT-Guard-/Helper-Vertrag:
  - `__tests__/patch549.keystoreExportJwtRbac.invariants.test.ts`
  - `__tests__/patch553.workflowDispatchJwtRbac.invariants.test.ts`
  - `__tests__/patch510.keystoreSharedSecretHelpers.invariants.test.ts`

## Ehrliche Grenzen
- Das neue durable Modell ist ein **persistenter Sliding-Window-Zaehler** (distributed ueber Instanzen), aber kein perfekt atomischer globaler Lock/Token-Bucket.
- `rateLimit(...)` bleibt bewusst als lokaler Best-Effort-Guard markiert und ist nicht der harte Schutz fuer kritische Pfade.
