# Patch 458 — ChatScreen Attachment-Ehrlichkeit + Chat-History-Pruning + Flow-Cleanup

## Ziel
Die bestätigten Restpunkte im ChatScreen-/Chat-Flow konservativ schließen: ehrliches Attachment-Verhalten, begrenzte Chat-History, sauberes Modal-/Unmount-Cleanup und kleine Typing-/Artefakt-Bereinigung ohne Broad-Refactor.

## Umgesetzt
- **Attachment-/DocumentPicker-Flow ehrlicher gemacht**
  - `screens/ChatScreen/hooks/chatScreenTypes.ts`: neuer Helper `buildUserInputWithAttachmentNotice(...)` baut bei angehängter Datei eine explizite Nutzer-Notiz in den Prompt ein (klarer Hinweis: aktuell nur Dateiname/Metadaten, kein voller Dateiinhalt).
  - `screens/ChatScreen/hooks/useChatScreen.ts`: `handleSend` nutzt den Helper und übergibt den ehrlich erweiterten Prompt statt nur Dateinamen-Fallback.
  - `components/chat/ChatComposer.tsx`: sichtbarer Hinweis direkt im Attachment-Badge, damit vor dem Senden keine falsche Analyse-Erwartung entsteht.
- **Chat-History-Wachstum begrenzt**
  - `contexts/ProjectContext.tsx`: `addChatMessage` nutzt jetzt Retention-basiertes Trimmen sofort beim Anhängen neuer Messages (nicht erst indirekt beim Persistieren).
  - Retention-Limit wird aus `loadChatHistorySettings()` geladen (Fallback 200), damit In-Memory-/Persistenz-Verhalten konsistent bleiben.
- **Flow-/Unmount-Cleanup gehärtet**
  - `hooks/useChatAIFlow.ts`: neuer `resetTransientState()` räumt Streaming/Abort/Pending-Plan/Pending-Change/Modal-State konservativ auf.
  - `screens/ChatScreen/hooks/useChatScreen.ts`: ruft `resetTransientState()` bei Focus-Cleanup/Blur auf, um hängende Modal-/Pending-Zustände beim Verlassen des Screens zu vermeiden.
- **Typing-/Artefakt-Hygiene**
  - `hooks/chatAIFlowTypes.ts`: tote Imports entfernt, Datei auf tatsächliche Shared-Types reduziert, `extractRawOrchestratorResult` von `any` auf `ExtendedOrchestratorResult` typisiert.

## Tests
- Neu: `__tests__/chatScreenAttachmentNotice.test.ts`
  - prüft ehrliche Attachment-Hinweis-Texte inkl. Large-File-Hinweis.
- Neu: `__tests__/projectContext.chatRetention.test.ts`
  - prüft Retention-Pruning bei Message-Append und Limit-0-Verhalten.

## Verifikation
- `bash scripts/check_workflow_template_drift.sh` ✅
- `bash scripts/check_managed_workflows.sh` ✅
- `bash scripts/check_workflow_edge_contracts.sh` ✅
- `bash scripts/check_legacy_disabled_edges.sh` ✅
- `bash scripts/check_patch_docs_sync.sh` ✅
- `npm run typecheck` ✅
- `npm run lint:ci` ✅
- `npm run test:silent` ✅
