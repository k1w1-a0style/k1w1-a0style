# Patch 480 — Schritt 3 Restpunkte: Save-Validation präzisiert, Ownership-Gründe im Chat sichtbarer

## Was wurde geändert?

- `screens/ConnectionsScreen/utils/validation.ts`: `validateBeforeSave(...)` prüft jetzt zusätzlich eine manuell eingegebene `EAS Project ID` auf echtes UUID-Format, damit keine fachlich unbrauchbaren IDs in den Save-/Link-Flow durchrutschen.
- `screens/ConnectionsScreen/hooks/useConnectionsScreen.ts`: die Save-Validierung übergibt die aktuelle `easProjectId` an den bestehenden Guard.
- `hooks/useChatAIFlow.ts`, `hooks/chatAIFlowTypes.ts`, `hooks/chatChangeSummary.ts`: geblockte Hinweise/Ownership-Gründe werden nach dem Anwenden eines KI-Vorschlags nicht nur gezählt, sondern weiterhin im Bestätigungstext sichtbar gehalten.
- `__tests__/connectionsScreen.validation.test.ts`, `__tests__/chatChangeSummary.test.ts`: gezielte Regressionen für EAS-ID-Validierung und transparente Ownership-/Blocker-Kommunikation ergänzt.

## Bewertung der geprüften Restpunkte

- **N6**: im aktuellen Stand **nicht bestätigt** — der Connections-/EAS-Flow setzt nach `eas-link` weiterhin bewusst nicht optimistisch auf grün, sondern neutralisiert `EAS_OK` bis zum echten Test.
- **N9**: **teilweise bestätigt** — die Save-Validierung war für Tokens/URLs plausibel, ließ aber eine fachlich ungültige manuelle `EAS Project ID` ungeprüft in den späteren Link-/Test-Flow.
- **K7**: **teilweise bestätigt** — Ownership-/Blocker-Gründe waren vor dem Anwenden sichtbar, gingen aber im nachgelagerten Bestätigungstext auf reine Zähler/Skip-Listen zurück; dieser UX-Rest wurde minimal nachgezogen.
- **K8**: im aktuellen Stand **nicht bestätigt** — Validator-/Explain-Fallbacks sind bereits als Chat-Hinweis sichtbar.
- **K9**: **nicht bestätigt** — der Chat-Flow hängt weiterhin bewusst an `lib/orchestrator`; `k1w1-handler` bleibt ein separater serverseitiger Edge-Pfad und ist kein fehlendes Client-Wiring.

## Verifikation

- `npm run typecheck`
- `npm run lint:ci`
- `npm run test:silent -- --runInBand __tests__/connectionsScreen.validation.test.ts __tests__/chatChangeSummary.test.ts __tests__/useChatAIFlow.validatorExplain.invariants.test.ts __tests__/connectionsScreen.easStatusSemantics.test.ts`
