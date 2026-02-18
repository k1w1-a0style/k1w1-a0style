# PROJECT_CHECKLOG — Append Patch 31

## Patch 31 — CodeScreen: isDirty vereinheitlicht

### Änderungen
- `screens/CodeScreen/hooks/useCodeScreen.ts`
  - `isDirty` ist jetzt **unabhängig vom `viewMode`**.
  - Vergleich: Original-Content (string oder JSON pretty) vs. `editingContent`.
  - `confirmLoseChanges` und `isDirty` werden im Return-Object bereitgestellt.
- `screens/CodeScreen/index.tsx`
  - UI verwendet `isDirty` aus dem Hook (kein Doppel-Compute).

### Hinweis
Dieser Append kann später in `PROJECT_CHECKLOG.md` gemerged werden.
