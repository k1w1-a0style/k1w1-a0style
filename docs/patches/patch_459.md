# Patch 459 — Chat-Regression-Fix: Attachment-Hinweis nach Meta-Command-Routing

## Ziel
Rest-Regression aus PR #272 konservativ schließen: lokale/meta Kommandos (`cat <pfad>`, `zeige datei <pfad>`) dürfen durch den Attachment-Hinweis nicht ihren Full-line-Match verlieren.

## Umgesetzt
- **Command-Routing wieder auf Raw-Input**
  - `hooks/useChatAIFlow.ts`: `handleSendWithMeta` akzeptiert jetzt getrennt `rawInput` und optional `aiInput`.
  - Meta-/lokale Kommandos laufen auf `rawInput.trim()` (unverändert), bevor der normale AI-Pfad gebaut wird.
- **Attachment-Hinweis nur im normalen AI-Request**
  - `screens/ChatScreen/hooks/useChatScreen.ts`: beim Senden wird `rawInput` separat gehalten und `currentInput` (mit Attachment-Hinweis) nur als `aiInput` übergeben.
  - Ergebnis: lokale/meta Kommandos behalten ihr Match-Verhalten, der ehrliche Attachment-Hinweis bleibt für echte AI-Requests aktiv.
- **Kleiner Typing-Nachzug**
  - `screens/ChatScreen/hooks/chatScreenTypes.ts`: Helper nimmt jetzt `AttachmentNoticeAsset` (`name`/`size`) statt vollem Picker-Asset an (minimalere Kopplung).

## Tests
- Neu: `__tests__/useChatAIFlow.metaCommandAttachment.regression.test.ts`
  - Invariant: `handleMetaCommand(...)` nutzt weiter den Raw-Input.
  - Invariant: Attachment-Hinweis fließt erst in `processAIRequest(...)` ein.

## Verifikation
- `bash scripts/check_workflow_template_drift.sh` ✅
- `bash scripts/check_managed_workflows.sh` ✅
- `bash scripts/check_workflow_edge_contracts.sh` ✅
- `bash scripts/check_legacy_disabled_edges.sh` ✅
- `bash scripts/check_patch_docs_sync.sh` ✅
- `npm run typecheck` ✅
- `npm run lint:ci` ✅
- `npm run test:silent` ✅
