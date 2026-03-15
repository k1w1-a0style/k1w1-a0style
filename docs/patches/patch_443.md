# Patch 443

Datum: 2026-03-15

## Ziel
Kleine, minimal-invasive Härtung verbleibender Provider-Randfälle im Supabase-Edge-Handler `k1w1-handler` für Anthropic/Gemini, um leere/irreführende Requests zu vermeiden.

## Änderungen
- **Anthropic (`supabase/functions/k1w1-handler/helpers.ts`)**
  - `system`-Nachrichten werden weiterhin separat als `system`-String zusammengeführt.
  - Neu: Wenn nach dem Entfernen von `system`-Messages keine Dialog-Nachricht übrig bleibt, wird ein konservativer Fallback-User-Turn gesetzt (`Please respond to the system instructions.`), damit kein leeres `messages`-Array an Anthropic gesendet wird.
- **Gemini (`supabase/functions/k1w1-handler/helpers.ts`)**
  - `system`-Nachrichten werden nicht mehr still als `user`-Content gemappt, sondern explizit in `systemInstruction` überführt.
  - `contents` werden aus Nicht-System-Nachrichten gebaut; wenn nur `system` vorhanden ist, wird ein minimaler Fallback-User-Turn erzeugt, damit der Request robust nicht-leer bleibt.
  - Kleines No-op bereinigt: doppeltes Nullish-Coalescing bei `parts` entfernt.
- **Tests (`__tests__/k1w1Handler.providers.invariants.test.ts`)**
  - Invariants ergänzt für Anthropic-Guard gegen leeres `messages`-Array.
  - Invariants ergänzt für explizite Gemini-Systembehandlung + nicht-leere `contents`-Fallback-Logik.
  - Invariant ergänzt, dass das doppelte Nullish-Coalescing nicht wieder eingeführt wird.

## Verifikation
- `bash scripts/check_workflow_template_drift.sh`
- `bash scripts/check_managed_workflows.sh`
- `bash scripts/check_workflow_edge_contracts.sh`
- `bash scripts/check_legacy_disabled_edges.sh`
- `bash scripts/check_patch_docs_sync.sh`
- `npm run typecheck`
- `npm run lint:ci`
- `npm run test:silent`

## Hinweis
Bewusst keine neue Provider-Abstraktion und kein Broad-Refactor: nur lokale Guard-/Mapping-Härtungen mit realem Laufzeitnutzen.
