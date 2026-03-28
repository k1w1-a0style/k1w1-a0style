# Patch 605: build_admin Operator-Vertrag als externer Provisioning-Claim klargezogen

## Ausgangslage

Nach Patch 604 war der Rollenvertrag fuer privilegierte workflow-/build-/artifact-/keystore-Routen (`service_role|build_admin`) konsistent fail-closed gehaertet, aber die konkrete **Herkunft** von `build_admin` blieb operativ unklar.

## Audit-Ergebnis

Das Repo enthaelt **keinen** produktiven Pfad, der normale Supabase-Logins intern auf `build_admin` mappt oder den Claim selbst erzeugt.

- Shared Auth-SoT bleibt in `supabase/functions/_shared/auth.ts`:
  - `WORKFLOW_OPERATOR_ALLOWED_ROLES = ["service_role", "build_admin"]`
  - `PRIVILEGED_OPERATOR_ALLOWED_ROLES = ["service_role", "build_admin"]`
- `requireJwtRole(...)` verifiziert JWTs ueber `GET /auth/v1/user` und liest Rollen nur aus verifiziertem Supabase-User (`user.role`, fallback `user.app_metadata.role`).
- Es gibt keinen internen Grant-/Mapper-/Provisioning-Flow im Repo, der `build_admin` fuer normale Sessions setzt.

**Endvertrag:** `build_admin` ist bewusst ein externer Betriebs-/Provisioning-Claim (Supabase Auth User-Metadaten/Rolle ausserhalb dieses Repos).

## Umsetzung

1. **UX-/Caller-Texte auf externen Provisioning-Vertrag erweitert**
   - `project/services/buildStartService.ts`
   - `project/services/buildPollingService.ts`
   - `hooks/useGitHubActionsLogs.ts`
   - `components/CiLiteHeaderButton/hooks/useCiLiteWorkflow.ts`
   - `screens/CredentialsWizardScreen/hooks/useCredentialsWizardScreen.ts`

   Fehltexte sagen jetzt explizit, dass `build_admin` ausserhalb dieses Repos provisioniert wird.

2. **Diagnostics-Precondition transparent gemacht**
   - `lib/diagnostics/buildPipelineDiagnostics.ts`
   - Neuer Check `local.operatorClaimProvisioning` dokumentiert klar, dass der Claim extern provisioniert werden muss.

3. **Contract-/Drift-Checks gehaertet**
   - `scripts/check_workflow_edge_contracts.sh`
   - Erzwingt die externen Provisioning-Hinweise in Callern und betroffenen Docs.

4. **Invariants nachgezogen**
   - `__tests__/patch605.buildAdminProvisioningContract.invariants.test.ts`
   - Sichert den externen Vertragswortlaut in Code/Docs/Checks regressionsfest.

5. **Doku synchronisiert**
   - `README.md`, `PROJECT_CHECKLOG.md`, `docs/patches/PATCHLOG_ROOT.md`,
     `docs/EDGE_FUNCTIONS_STATUS.md`, `docs/06-build-readiness.md`, `docs/04-risk-hotspots.md`.

## Ergebnis

- Kein halb-impliziter Zustand mehr: Operator-RBAC ist nicht nur technisch fail-closed, sondern auch operativ eindeutig.
- App-/Wizard-/Diagnostics-Pfade suggerieren nicht mehr, dass ein normales Login automatisch reicht.
- Kein Security-Downscope auf `authenticated`; der bestehende harte Serververtrag bleibt unveraendert.
