# Patch 606: CI-bearer-Vertragsdrift fuer workflow/build/artifact-Routen konsequent entfernt

## Ausgangslage

Die workflow-/build-/artifact-nahen Edge-Routen hatten weiter `allowCiBearer: true` und `K1W1_EDGE_WORKFLOW_CI_BEARER` im Guard, obwohl:

- `supabase/config.toml` fuer diese Routen bereits `verify_jwt = true` erzwingt.
- aktuelle Smoke-/Ops-Skripte bereits JWT + scoped Workflow-Admin-Key verwenden.
- der operative Pfad damit faktisch auf JWT + `x-k1w1-admin-key` liegt.

Damit blieb ein irrefuehrender Dualvertrag im Repo konserviert.

## Audit-Ergebnis

Unter dem aktuellen Repo-Vertrag ist ein reiner CI-bearer-Pfad **kein eigenstaendiger, operativ nutzbarer Betriebsweg** mehr:

1. Die sechs betroffenen Routen sind `verify_jwt=true` konfiguriert.
2. Aktuelle Caller (`scripts/ci-lite-env-load.sh`, `scripts/ci-lite-smoke.sh`) erwarten und senden JWT + scoped Workflow-Admin-Key.
3. Wenn ein "CI-bearer" zusaetzlich JWT braucht, ist das kein separater Vertragspfad, sondern Drift.

## Gewaehlter Endzustand

**Richtung B: CI-bearer konsequent entfernen.**

Workflow-/build-/artifact-Routen haben jetzt einen eindeutigen Einzelvertrag:

- `Authorization: Bearer <jwt>`
- `x-k1w1-admin-key: <K1W1_EDGE_WORKFLOW_ADMIN_KEY>`
- serverseitiger JWT-Rollen-Guard `service_role|build_admin`
- kein `ciBearerSecretEnv`/`K1W1_EDGE_WORKFLOW_CI_BEARER`-Sonderpfad mehr

## Umsetzung

1. **Server-Routen synchronisiert (6 Routen)**
   - `allowCiBearer: false`
   - CI-bearer-spezifische Branching-Logik entfernt (`isScopedCiBearerRequest(...)`, `ciBearerSecretEnv`)
   - JWT-Operator-Guard bleibt verpflichtend aktiv

2. **Checks/Invariants synchronisiert**
   - `scripts/check_workflow_edge_contracts.sh` sichert nun den entfernten CI-bearer-Pfad explizit via `forbid_fixed`.
   - `__tests__/patch415.edgeAuthGuards.invariants.test.ts` und
     `__tests__/patch553.workflowDispatchJwtRbac.invariants.test.ts` auf den neuen Einzelvertrag gezogen.

3. **Ops/UI/Hint-Texte bereinigt**
   - Hinweise auf `K1W1_EDGE_WORKFLOW_CI_BEARER` aus aktuellen Operator-/Runtime-Hinweisen entfernt.
   - Secret-/Sync-/Backup-Texte zeigen keinen toten CI-bearer-Vertrag mehr.

4. **Doku synchronisiert**
   - README, Checklog, Patchlog, Edge-Status, Build-Readiness, Risk-Hotspots auf denselben Endzustand gebracht.

## Ergebnis

- Kein Zombie-Dualvertrag mehr zwischen verify_jwt-Realitaet, Scripts und Routen-Guards.
- Code, Checks, Tests und Doku sprechen denselben operativen Vertrag.
- Workflow-/build-/artifact-Betrieb bleibt fail-closed und explizit operator-scope-basiert.
