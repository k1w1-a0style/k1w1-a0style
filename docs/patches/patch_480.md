# Patch 480 — Schritt 3 Restpunkte: EAS-ID-Validierung vervollständigt, Ownership-Gründe im Chat sichtbarer

## Was wurde geändert?

- `screens/ConnectionsScreen/utils/validation.ts`: die EAS-ID-Validierung ist als gemeinsamer UUID-Guard extrahiert, damit manuell eingegebene `EAS Project ID`s nicht mehr ungeprüft in Save- oder Link-Pfade durchrutschen.
- `screens/ConnectionsScreen/hooks/useConnectionsScreen.ts`, `screens/GitHubReposScreen/hooks/useGitHubReposScreen.ts`: die bestehenden Link-Pfade nutzen denselben UUID-Guard jetzt ebenfalls vor Workflow-Dispatch bzw. `eas-project.json`-Write.
- `hooks/useChatAIFlow.ts`, `hooks/chatAIFlowTypes.ts`, `hooks/chatChangeSummary.ts`: geblockte Hinweise/Ownership-Gründe werden nach dem Anwenden eines KI-Vorschlags nicht nur gezählt, sondern weiterhin im Bestätigungstext sichtbar gehalten.
- `__tests__/connectionsScreen.validation.test.ts`, `__tests__/chatChangeSummary.test.ts`: gezielte Regressionen für EAS-ID-Validierung und transparente Ownership-/Blocker-Kommunikation ergänzt.

## Bewertung der geprüften Restpunkte

- **N6**: im aktuellen Stand **nicht bestätigt** — der Connections-/EAS-Flow setzt nach `eas-link` weiterhin bewusst nicht optimistisch auf grün, sondern neutralisiert `EAS_OK` bis zum echten Test.
- **N9**: **bestätigt und minimal geschlossen** — die manuelle `EAS Project ID` war bisher nur teilweise abgesichert; fachlich ungültige Werte konnten trotz lokaler Eingabe noch in bestehende Link-Pfade rutschen und werden jetzt konsistent vor Save/Link geblockt.
- **K7**: **teilweise bestätigt** — Ownership-/Blocker-Gründe waren vor dem Anwenden sichtbar, gingen aber im nachgelagerten Bestätigungstext auf reine Zähler/Skip-Listen zurück; dieser UX-Rest wurde minimal nachgezogen.
- **K8**: im aktuellen Stand **nicht bestätigt** — Validator-/Explain-Fallbacks sind bereits als Chat-Hinweis sichtbar.
- **K9**: **nicht bestätigt** — der Chat-Flow hängt weiterhin bewusst an `lib/orchestrator`; `k1w1-handler` bleibt ein separater serverseitiger Edge-Pfad und ist kein fehlendes Client-Wiring.

## Verifikation

- `npm run typecheck`
- `npm run lint:ci`
- `npm run test:silent -- --runInBand __tests__/connectionsScreen.validation.test.ts __tests__/chatChangeSummary.test.ts __tests__/useChatAIFlow.validatorExplain.invariants.test.ts __tests__/connectionsScreen.easStatusSemantics.test.ts`
- `bash scripts/check_patch_docs_sync.sh`
- `bash scripts/check_workflow_template_drift.sh`
- `bash scripts/check_managed_workflows.sh`
- `bash scripts/check_workflow_edge_contracts.sh`
