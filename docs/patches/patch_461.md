# Patch 461 — Chat-Restregressionen aus PR #272/#273 gemeinsam final geschlossen

## Ziel
Die zwei verbliebenen kleinen Chat-Regressionen gemeinsam und minimal schließen:
1. Meta-/lokale Kommandos dürfen durch den Attachment-Hinweis nicht verfälscht werden.
2. Attachment-only-Nachrichten dürfen auch im Pending-Plan-Handoff nicht still verloren gehen.

## Umgesetzt
- **Meta-/lokale Kommandos weiter strikt auf `rawInput`**
  - `handleSendWithMeta(rawInput, aiInput)` prüft lokale/meta Kommandos weiterhin nur auf `userContent` (trimmed `rawInput`).
  - Der Attachment-Hinweis bleibt auf den normalen AI-Pfad begrenzt.
- **Attachment-only auch im Pending-Plan-Handoff abgesichert**
  - `hooks/useChatAIFlow.ts`: Beim Kombinieren der Nutzerdetails mit einer offenen Planner-Antwort wird nun `aiContent || userContent` genutzt.
  - Dadurch gehen Attachment-only-Details nicht verloren, wenn `rawInput` leer ist, aber `aiInput` den Attachment-Hinweis trägt.

## Tests
- Aktualisiert: `__tests__/useChatAIFlow.metaCommandAttachment.regression.test.ts`
  - Invariant: Meta-Routing bleibt an unverändertem Raw-Input.
  - Invariant: AI-Payload bleibt `aiContent || userContent`.
  - Neu: Pending-Plan-Handoff nutzt bei leerem Raw-Input den `aiInput`-Fallback.

## Verifikation
- `bash scripts/check_workflow_template_drift.sh` ✅
- `bash scripts/check_managed_workflows.sh` ✅
- `bash scripts/check_workflow_edge_contracts.sh` ✅
- `bash scripts/check_legacy_disabled_edges.sh` ✅
- `bash scripts/check_patch_docs_sync.sh` ✅
- `npm run typecheck` ✅
- `npm run lint:ci` ✅
- `npm run test:silent` ✅
