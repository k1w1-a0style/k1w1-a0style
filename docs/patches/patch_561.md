# Patch 561 — Edge JWT fail-closed + durable Rate-Limit fuer kritische Routen

## Ziel
Den letzten offenen Auth-/JWT-/Rate-Limit-Block minimal und ehrlich schliessen:

1. **Keine Rollen-Autorisierung mehr aus nur decodierter JWT-Payload**
2. **Kritische Edge-Routen nicht mehr nur instanz-lokal drosseln**

## Umsetzung

### 1) `_shared/auth.ts`: JWT-Rollenpruefung fail-closed auf verifizierter Basis
- `requireJwtRole(...)` ist **asynchron** und nutzt `verifyJwtViaSupabaseAuth(...)`.
- Verifikation laeuft ueber `GET /auth/v1/user` mit dem eingehenden Bearer-JWT; Rollenquelle ist nur verifizierter User-Response (`user.role`, fallback `user.app_metadata.role`).
- Ungueltig/nicht verifizierbar: `401` (kein Decode-Fallback).
- Fehlende Server-Auth-Konfiguration (`SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY`): `500` mit klarer Misconfig-Semantik (weiter fail-closed).
- `getJwtPayload(...)` bleibt nur als Decode-Helper fuer nicht-autorisierende Kontexte (z. B. Audit-Attribution).

### 2) `_shared/auth.ts`: durable Rate-Limit primitive
- Neu: `requireDurableRateLimit(...)`.
- Implementierung: schreibt Event in `public.edge_rate_limit_events` und zaehlt Events im Zeitfenster via PostgREST (`content-range` count).
- Antwort bei Ueberschreitung: `429 rate_limited` mit `mode: "durable"`.
- Bei fehlender Supabase-URL/Service-Role-Secrets: **500 fail-closed** fuer diese Schutzebene.
- Bestehendes `rateLimit(...)` bleibt als `mode: "local_best_effort"` klar als instanz-lokaler Zusatzschutz erhalten.

### 3) Kritische/betroffene Routen auf neuen Guard-Vertrag gezogen
- `android-keystore-generate` bleibt bewusst **admin-only** (`requireAdminKey`) und hat zusaetzlich durable + local best-effort Rate-Limit (kein JWT-Rollencheck auf dieser Route).
- `android-keystore-export` bleibt admin+JWT-role (`service_role`) plus durable + local Rate-Limit.
- Workflow-/Build-/Artifact-Routen nutzen wieder den scoped **Dualpfad** (Admin-Key ODER CI-Bearer) und erzwingen JWT-Rollencheck nur auf dem Non-CI-Bearer-Pfad:
  - `github-workflow-dispatch`
  - `github-workflow-runs`
  - `github-workflow-logs`
  - `github-run-artifact-json`
  - `trigger-eas-build`
  - `check-eas-build`
- Durable Rate-Limit aktiviert in:
  - `android-keystore-generate` (admin-only)
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
- Neu/erweitert: `__tests__/auth.failClosedAndDurableRateLimit.test.ts`
  - unverified/manipuliertes JWT wird trotz dekodierbarer `role` geblockt
  - Server-Misconfig bei JWT-Verifikation liefert 500 statt 401
  - verifizierter JWT-User-Rollenpfad bleibt funktional
  - scoped CI-bearer Detection ist regressionsgesichert
  - durable Counter liefert 429 bei Limitueberschreitung
- Invariant-Tests angepasst fuer async JWT-Guard-/Helper-Vertrag:
  - `__tests__/patch549.keystoreExportJwtRbac.invariants.test.ts`
  - `__tests__/patch553.workflowDispatchJwtRbac.invariants.test.ts`
  - `__tests__/patch510.keystoreSharedSecretHelpers.invariants.test.ts`

## Ehrliche Grenzen
- Das durable Modell ist ein **persistenter Sliding-Window-Zaehler** (distributed ueber Instanzen), aber kein perfekt atomischer globaler Lock/Token-Bucket.
- `rateLimit(...)` bleibt lokaler Best-Effort-Guard.
- Workflow-Routen haben im Function-Code wieder Admin+CI-Bearer-Dualpfad; bei `verify_jwt=true` bleibt der Gateway-Vertrag zusaetzlich relevant (kein gegenteiliger Security-Claim).
