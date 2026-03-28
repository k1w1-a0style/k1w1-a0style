# Patch 604: RBAC-/JWT-Vertragswiderspruch fuer app-initiierte Operator-Calls geschlossen

## Ausgangslage

Nach den Hardening-Patches 586/588 war der serverseitige Vertrag fuer privilegierte workflow-/build-/artifact-/keystore-Routen bereits fail-closed auf `service_role|build_admin` gesetzt.

Gleichzeitig verwendeten mehrere App-Caller, Tests und Fehltexte weiterhin wording nahe `JWT role=authenticated`, obwohl diese Rolle serverseitig nicht mehr ausreicht.

## Audit-Ergebnis (Soll-Vertrag)

Der echte Repo-Vertrag ist **Operator-only**:

- Server-SoT in `supabase/functions/_shared/auth.ts`:
  - `WORKFLOW_OPERATOR_ALLOWED_ROLES = ["service_role", "build_admin"]`
  - `PRIVILEGED_OPERATOR_ALLOWED_ROLES = ["service_role", "build_admin"]`
- Alle betroffenen Routen binden diese SoT bereits ein (`requireWorkflowOperatorJwtRole(...)` bzw. `requirePrivilegedOperatorJwtRole(...)`).
- Es gibt im Repo keinen produktiven App-Pfad, der normale `authenticated`-Sessions automatisch auf `build_admin` mappt.

Damit ist ein Vertrag "normale User-JWTs reichen" technisch nicht konsistent.

## Umsetzung

1. **App-Caller-/Wizard-Texte auf Operator-Vertrag gezogen**
   - `project/services/buildStartService.ts`
   - `project/services/buildPollingService.ts`
   - `hooks/useGitHubActionsLogs.ts`
   - `components/CiLiteHeaderButton/hooks/useCiLiteWorkflow.ts`
   - `screens/CredentialsWizardScreen/hooks/useCredentialsWizardScreen.ts`

   Die Fehltexte nennen jetzt klar den echten Rollenvertrag (`build_admin` bzw. `service_role` fuer Server-Caller) statt irrefuehrendem `role=authenticated`.

2. **Tests/Invariants konsolidiert**
   - Relevante Testmocks verwenden neutrale Operator-JWT-Tokenbezeichner statt `supabase-authenticated-jwt-token`.
   - Neuer Invariant-Test:
     - `__tests__/patch604.workflowOperatorCallerContract.invariants.test.ts`
     - sichert SoT-Rollen + entferntes `role=authenticated`-Wording im app-initiierten Operator-Scope.

3. **Drift-/Contract-Check gehaertet**
   - `scripts/check_workflow_edge_contracts.sh` erweitert:
     - fordert Operator-Rollenhinweis in betroffenen App-Callern,
     - verbietet `JWT role=authenticated` in diesen Dateien.

4. **Doku synchronisiert**
   - `README.md`, `PROJECT_CHECKLOG.md`, `docs/patches/PATCHLOG_ROOT.md`, `docs/EDGE_FUNCTIONS_STATUS.md`, `docs/04-risk-hotspots.md`, `docs/06-build-readiness.md`.

## Ergebnis

- Ein konsistenter Endvertrag ueber Server, Caller, Tests, Checks und Doku.
- Keine irrefuehrende Behauptung mehr, dass normales `authenticated` im app-initiierten Operator-Scope ausreicht.
- Der bestehende fail-closed Sicherheitsvertrag bleibt unveraendert streng: `service_role|build_admin` + scoped Admin-Key.
