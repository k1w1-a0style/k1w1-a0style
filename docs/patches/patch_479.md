# Patch 479 — Schritt 3 Restpunkt-Prüfung: Validator-Fallback im Chat sichtbar gemacht

## Was wurde geändert?

- `hooks/useChatAIFlow.ts`: Wenn der optionale Validator fehlschlägt, non-ok zurückliefert oder keine gültige Dateiliste erzeugt, bleibt der Builder-Fallback bestehen **und** der Nutzer bekommt jetzt einen expliziten Hinweis im Chat statt nur eines Log-Eintrags.
- `__tests__/useChatAIFlow.validatorExplain.invariants.test.ts`: gezielte Invariants sichern, dass Validator-Fallbacks nutzersichtbar bleiben und der Explain-Fallback weiterhin explizit im Chat signalisiert wird.

## Bewertung der geprüften Restpunkte

- **N6**: im aktuellen Stand **nicht bestätigt** — der Connections-/EAS-Flow setzt nach `eas-link` bewusst nicht optimistisch auf grün, sondern neutralisiert `EAS_OK` bis zum echten Test.
- **N9**: **nicht bestätigt** als technischer Defekt — `validateBeforeSave(...)` ist weiterhin nur Format-/Plausibilitätsprüfung vor dem Speichern; echte Reachability-/Credential-Validierung bleibt getrennt über die expliziten Test-Aktionen.
- **K7**: im aktuellen Stand **nicht bestätigt** — Ownership-Blocks landen bereits mit Gründen in `mergeResult.errors` und werden im Änderungsdialog explizit als „Geblockt/Hinweise“ ausgegeben.
- **K8**: **teilweise bestätigt** — Explain ist bereits transparent, aber Validator-Ausfälle waren bislang nur geloggt; dieser Restpunkt ist mit dem Nutzerhinweis jetzt minimal geschlossen.
- **K9**: **nicht bestätigt** — der Chat-Flow hängt bewusst an `lib/orchestrator`, während `supabase/functions/k1w1-handler` ein separater serverseitiger Edge-Pfad ist; „unreferenziert“ ist hier kein eigenständiger Defekt.

## Verifikation

- `npm run typecheck`
- `npm run lint:ci`
- `npm run test:silent -- --runInBand __tests__/useChatAIFlow.validatorExplain.invariants.test.ts`
