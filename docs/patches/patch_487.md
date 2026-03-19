# Patch 487 — AI-Flow Welle 2: Input-Validierung, Prompt-Budget und diff-orientierte Confirm-UX

## Ziel

Die zweite AI-Flow-Welle schließt die produktiven Restpunkte im Chat-Flow konservativ:

- `validateChatInput()` hängt jetzt im echten Sendepfad und die sanitizte Eingabe wird weiterverwendet.
- Planner/Builder/Validator bekommen budgetierten, deterministisch gekürzten Kontext.
- Das Confirm-Modal zeigt kompakte Inhaltsdeltas statt fast nur Dateinamen/Summary.
- Validator-Herkunft und Advisory-/Fallback-Semantik werden im UX ehrlich angezeigt.

## Umgesetzt

- `hooks/useChatAIFlow.ts`
  - produktive Sendepfad-Validierung + Sanitizing vor Provider-Calls
  - budgetierte Provider-Kontexte für Planner/Builder/Validator aktiviert
  - Builder-vs-Validator-Herkunft als strukturierte PendingChange-Metadaten ergänzt
  - kompakte Change-Previews für Confirm-Review erzeugt
- `lib/promptEngine.ts` + `lib/aiContextBudget.ts`
  - deterministisches History-/Snapshot-/Ausschnitt-Trimming via Token-Heuristik
- `components/chat/ConfirmChangesModal.tsx`
  - diff-orientierte Bestätigungsansicht mit Datei-Vorschau / Delta-Ausschnitten
- Tests ergänzt für Sendepfad, Sanitizing, Budget und Confirm-/Validator-UX

## Checks

- `npm run typecheck`
- `npm run lint:ci`
- `npm run test:silent`
