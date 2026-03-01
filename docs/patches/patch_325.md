# Patch 325: Orchestrator Provider Typing-Hardening (Gemini/Groq/HuggingFace)

## Ziel
Einen weiteren Punkt aus der offenen Fix-Liste abschließen: verbleibende `any`-Hotspots in den Orchestrator-Providern (`gemini`, `groq`, `huggingface`) sauber entfernen und Fehlerpfade vereinheitlichen.

## In diesem Patch umgesetzt
- `lib/orchestrator/providers/gemini.ts`
  - Unbenutzte Helper-Imports bereinigt.
  - API-Request/Response intern typisiert (`GeminiContent`, `GeminiResponse`).
  - `any`-Casts in `contents`-Filter und Response-Parts-Mapping entfernt.
  - Catch-Block von `error: any` auf `unknown` umgestellt + helper-basiertes Abort-/Fehlerhandling.

- `lib/orchestrator/providers/groq.ts`
  - Unbenutzte Helper-Imports bereinigt.
  - API-Response intern typisiert (`GroqResponse`).
  - Catch-Block auf `unknown` + konsistentes Error-Message-Handling umgestellt.

- `lib/orchestrator/providers/huggingface.ts`
  - Unbenutzte Helper-Imports bereinigt.
  - API-Response intern typisiert (`HuggingFaceResponse`).
  - Catch-Block auf `unknown` + konsistentes Abort-/Fehlerhandling umgestellt.

- `docs/PROJECT_TODO.md`
  - TypeScript-Hygiene-Fixlistenpunkt zu Provider-Hotspots als erledigt markiert (Patch 325).

## Warum sicher
- Keine neue Dependency.
- Keine Änderung an API-Endpunkten oder Modellrouting.
- Fokus rein auf Typing-/Fehlerpfad-Härtung bei unveränderter funktionaler Semantik.

## Validierung
```bash
npm run typecheck
npm run lint:ci
npm run test:silent
```
