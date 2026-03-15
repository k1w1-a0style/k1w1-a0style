# Patch 460 — Chat Attachment-only Regression-Fix nach PR #273

## Ziel
Den verbliebenen Regression-Punkt aus PR #273 schließen: Attachment-only-Sendefälle durften nicht mehr durch eine zu frühe `rawInput`-Leereprüfung in `handleSendWithMeta(...)` verloren gehen.

## Umgesetzt
- **Früher Abbruch nur noch bei wirklich leerem Request**
  - `hooks/useChatAIFlow.ts`: `handleSendWithMeta` bricht jetzt nur ab, wenn **sowohl** `rawInput.trim()` als auch `aiInput.trim()` leer sind.
- **Meta-/lokale Kommandos bleiben auf Raw-Input**
  - Meta-Command-Routing nutzt weiterhin ausschließlich den unveränderten `rawInput` (`userContent`) und bleibt damit kompatibel zu Full-line-Kommandos.
- **Attachment-only landet deterministisch im AI-Pfad**
  - Für die User-Nachricht wird bei leerem `rawInput` auf `aiInput` zurückgefallen; der AI-Request nutzt weiter `aiContent || userContent`.

## Tests
- Aktualisiert: `__tests__/useChatAIFlow.metaCommandAttachment.regression.test.ts`
  - Invariant: Guard akzeptiert Attachment-only (`!userContent && !aiContent` als einziger Abort).
  - Invariant: Meta-Routing bleibt an `userContent` (Raw-Input) gebunden.
  - Invariant: User-Message/AI-Payload nutzen Fallback auf `aiContent`, damit Attachment-only nicht still verloren geht.

## Verifikation
- `bash scripts/check_workflow_template_drift.sh` ✅
- `bash scripts/check_managed_workflows.sh` ✅
- `bash scripts/check_workflow_edge_contracts.sh` ✅
- `bash scripts/check_legacy_disabled_edges.sh` ✅
- `bash scripts/check_patch_docs_sync.sh` ✅
- `npm run typecheck` ✅
- `npm run lint:ci` ✅
- `npm run test:silent` ✅
