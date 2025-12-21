# PROJECT_TODO / Bauplan (k1w1-a0style)

Stand: (Datum eintragen)
Ziel: Stabil + wartbar + schneller iterieren, ohne „Fratze geht“ bei Commits.

---

## Status / Wo wir sind

Aktuell grün:

- ✅ eslint (`npm run lint:ci`)
- ✅ typecheck (`npm run typecheck`)
- ✅ tests (`npm run test:silent`)

Zuletzt umgesetzt (ChatScreen-Aufräumen):

- ✅ Styles aus ChatScreen ausgelagert (`styles/chatScreenStyles.ts`)
- ✅ ConfirmChangesModal extrahiert (`components/chat/ConfirmChangesModal.tsx`)
- ✅ Prettier + Husky + lint-staged + .editorconfig eingeführt (Pre-Commit Formatierung)
- ✅ Chat weiter “verschlankt” durch Extraktionen (Composer/Loading/Error/Scroll Button) – je nach aktuellem Stand im Repo

Hinweis:

- MessageItem existiert als eigenes Component – das ist okay. ChatScreen nutzt es weiterhin über MessageList/RenderItem.

---

## Wichtig: Regeln für “Safe Refactor”

Immer so arbeiten:

1. Kleine, isolierte Extraktion (1 Baustein)
2. Prettier nur für betroffene Dateien
3. `npm run lint:ci && npm run typecheck && npm run test:silent`
4. Commit
5. Nächster Schritt

---

## To-Do Liste (Projektweit)

### A) Chat / UI (sicher & sinnvoll)

- [ ] (SAFE) ChatMessageList extrahieren (nur FlatList + onContentSizeChange + renderFooter Hookup)
- [ ] (SAFE) useKeyboardHeight Hook extrahieren (Keyboard listeners raus aus ChatScreen)
- [ ] (SAFE) useChatAutoScroll Hook extrahieren (hardScrollToBottom + focus effect + isAtBottom tracking)
- [ ] (SAFE) Streaming-Simulation in Hook auslagern (useSimulatedStreaming)
- [ ] (SAFE) Konstanten in `constants/chat.ts` (INPUT_BAR_MIN_H, SELECTED_FILE_ROW_H, KEYBOARD_NUDGE, …)
- [ ] (SAFE) processAIRequest “Service” auslagern (z.B. `lib/chatFlow.ts`) → leichter testbar

### B) Tooling / Format / “Nichts geht kaputt”

- [ ] `.prettierignore` ergänzen (node_modules, dist, coverage, expo build artefacts, patch backups, etc.)
- [ ] Script: `"format": "prettier --write ."` + `"format:check": "prettier --check ."`
- [ ] lint-staged: nur sinnvolle Patterns, kein Formatieren von Build/Lockfiles wenn’s nervt (optional)
- [ ] Husky Warnung fixen (deprecated shim lines entfernen falls noch drin)

### C) Projektgröße / Performance (Audit)

- [ ] Große Dateien identifizieren & “splitten” (Screens, utils, Services)
- [ ] Assets checken (Bilder/Audio/JSON): unnötig große Assets raus / komprimieren
- [ ] Unused deps prüfen (depcheck) & entfernen
- [ ] “Backups”/alte Dateien konsequent in ignore oder aus Repo

### D) Reliability / Fehlerklassen

- [ ] Netzwerkfehler/Retry Logik zentralisieren (ein Modul)
- [ ] Einheitliche Error-Messages & UI-Banner
- [ ] Agent/Validator Flow robuster: klare Fallbacks, Telemetrie minimal (optional)

---

## “Sonet”-Hinweise (kritisch bewertet)

Kurzfazit:

- Die Grundidee “aus ChatScreen extrahieren” ist richtig.
- In den Sonet-Snippets waren typische Stolperfallen:
  - Styles/Keys passten nicht zu deinem echten `theme` (z.B. `palette.surface` existiert bei dir nicht)
  - Style-Namen/Exports uneinheitlich → TypeScript Fehler (`styles.modalCard` etc.)
  - Teilweise unvollständig (Snippet abgebrochen) → gefährlich beim Copy/Paste

Regel:

- Extraktionen nur dann “safe”, wenn:
  1. die Styles exakt existieren,
  2. Imports/Exports eindeutig sind,
  3. Lint+Typecheck+Tests grün laufen.

---

## Nächster sinnvoller Schritt (Empfehlung)

1. useKeyboardHeight Hook (klein, sehr safe)
2. useChatAutoScroll Hook
3. ChatMessageList Component

Danach ist ChatScreen deutlich kürzer, ohne Logik zu riskieren.
