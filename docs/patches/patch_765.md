# Patch 765 – Hotspot-Restabschluss in Hook-Fassaden

Datum: 2026-04-09

## Scope

Abschluss der verbleibenden Hook-Resthotspots ohne API-Breaks und ohne Architektur-Grossumbau.

## Umsetzung

1. `hooks/useGitHubRepos.ts`
   - Pull-/Tree-/Blob-Orchestrierung nach `hooks/useGitHubReposPull.ts` ausgelagert.
   - Facade behält bisherigen Hook-Return-Vertrag (load/delete/rename/pull/branches/workflows/default-branch).
2. `screens/CredentialsWizardScreen/hooks/useCredentialsWizardScreen.ts`
   - Action-/Clipboard-/Status-Meta-Orchestrierung nach `useCredentialsWizardActions.ts` verschoben.
   - Wizard-Fassade bleibt im Public-Shape stabil.
3. `screens/ChatScreen/hooks/useChatScreen.ts`
   - Thinking-/Typing-Animationen in `useChatScreenAnimations.ts` ausgelagert.
   - Input-/Attachment-/Send-Semantik unveraendert.
4. `screens/EnhancedBuildScreen/hooks/useEnhancedBuildScreen.ts`
   - Build-Readiness-/Filter-/Checklist-/Logs-Selection in `useEnhancedBuildDerivedState.ts` extrahiert.

## Invariant-/Contract-Nachzug

- Marker-basierte Source-Invariants wurden in den refaktorierten Fassaden bewusst erhalten/nachgezogen.
- Keine Weichspuelung von Workflow-/Security-Contracts.

## Verifikation

- `npm run -s typecheck`
- `npm run -s lint:ci`
- `npm run -s test:silent`
- `bash scripts/check_workflow_edge_contracts.sh`
- `bash scripts/check_verify_jwt_visibility.sh`
- `bash scripts/check_release_readiness.sh` (`OK_WITH_SKIPS` ohne `EDGE_BASE_URL`/`EDGE_OPERATOR_JWT`)

