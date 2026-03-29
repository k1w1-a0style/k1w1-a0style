# Patch 607 - Finaler Cleanup der toten CI-bearer-Shared-Auth-Logik

## Kontext / Audit

Nach Patch 606 war der CI-bearer-Vertrag bereits aus allen workflow-/build-/artifact-nahen Routen entfernt.
Das Audit fuer Patch 607 ueber `supabase/functions/`, `_shared/auth.ts`, Invariants und Check-Skripte zeigt:

- kein produktiver Route-Callsite nutzt noch `allowCiBearer: true`
- keine Route nutzt `ciBearerSecretEnv` oder `isScopedCiBearerRequest(...)`
- der verbliebene CI-bearer-Code in `_shared/auth.ts` war nur noch Altlogik ohne aktiven Repo-Vertrag

## Umsetzung

1. `supabase/functions/_shared/auth.ts` bereinigt:
   - `isScopedCiBearerRequest(...)` entfernt
   - `ScopedEdgeAuthConfig` ohne `allowCiBearer`/`ciBearerSecretEnv`
   - `requireScopedEdgeAuth(...)` auf den eindeutigen scoped-admin-key-Vertrag reduziert
   - tote generische CI-bearer-Helfer entfernt:
     - `requireServiceRoleBearer(...)`
     - `requireAdminKeyOrServiceRoleBearer(...)`
     - `hasServiceRoleSecretConfigured()`

2. Betroffene Edge-Callsites/Helper/Test-SoT nachgezogen:
   - `allowCiBearer: false` aus allen `requireScopedEdgeAuth(...)`-Aufrufen entfernt
   - veraltete Guard-Lineage-Kommentare aktualisiert
   - `android-keystore-export/helpers.ts` Reexports von entfernten Helpers bereinigt

3. Vertrags-Checks/Invariants aktualisiert:
   - Auth-/Workflow-/Legacy-/Helper-Invariants auf den bereinigten Vertrag umgestellt
   - `scripts/check_workflow_edge_contracts.sh` prueft jetzt explizit, dass die entfernten CI-bearer-APIs in `_shared/auth.ts` nicht mehr existieren

4. Doku synchronisiert:
   - README, PROJECT_CHECKLOG, PATCHLOG_ROOT
   - EDGE_FUNCTIONS_STATUS, Build-Readiness, Risk-Hotspots

## Ergebnis

Der Repo-Vertrag hat jetzt **genau einen Endzustand ohne CI-bearer-Zombiepfad**:

- scoped Admin-Key als verbindliches Shared-Auth-Gate
- auf Operatorrouten zusaetzlich JWT+RBAC (bei `verify_jwt=true`)
- kein ungenutzter CI-bearer-Fallback in Shared-Auth, Tests oder Checks
