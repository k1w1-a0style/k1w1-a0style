# Patch 611

## Anlass
Der `build_admin`-Vertrag war bereits als externer Provisioning-Vertrag dokumentiert, aber fuer den operativen Live-Betrieb fehlte noch ein finaler, fail-closed sichtbarer Preflight-/Runbook-Schritt im Repo: klare Guidance fuer Operatoren, Diagnostics und Troubleshooting ohne implizite Suggestion eines internen Claim-Mappings.

## Umsetzung
- Operatornahe Caller-/Wizard-Fehltexte (`buildStartService`, `buildPollingService`, `useGitHubActionsLogs`, `useCiLiteWorkflow`, `useCredentialsWizardScreen`) ergaenzen jetzt einheitlich: normale eingeloggte Nutzer ohne extern provisionierten `build_admin`-Claim sind fail-closed blockiert.
- `runBuildPipelineDiagnostics` schaerft den lokalen `operatorClaimProvisioning`-Hinweis auf einen expliziten Preflight-Vertrag vor Live-Tests.
- `docs/06-build-readiness.md` ergaenzt einen strukturierten Abschnitt **Operator-Runbook/Preflight** mit Voraussetzung, erwarteten Claims, betroffenen Flows, Fehlersymptomen und Pruefschritten vor Live-Test.
- `docs/EDGE_FUNCTIONS_STATUS.md` und `docs/04-risk-hotspots.md` synchronisieren denselben Endvertrag ohne weiche Formulierungen.
- `scripts/check_workflow_edge_contracts.sh` sowie Invariants (`patch605` Update + neuer `patch611` Test) sichern die neuen fail-closed Formulierungen regressionsfest.

## Ergebnis
Repo-seitig ist der externe `build_admin`-Betriebsvertrag operativ klar, testbar und fail-closed sichtbar: kein interner Claim-Generator, kein stiller Mapping-Pfad, und nachvollziehbares Operator-Troubleshooting fuer echte Live-Tests.
