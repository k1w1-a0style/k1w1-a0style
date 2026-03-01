# Patch 324: Fix-Liste erstellt + erste Punkte umgesetzt (Orchestrator Typing)

## Ziel
Aus dem aktuellen Audit eine priorisierte Fix-Liste ableiten und die ersten, risikoarmen Punkte direkt umsetzen.

## Fix-Liste (priorisiert)
1. TypeScript-Hygiene in `lib/orchestrator/*` weiter verbessern (`any` in Catch-/Response-Pfaden reduzieren).
2. Restliche `any`-Hotspots in weiteren Providern (`gemini`, `groq`, `huggingface`) schrittweise abbauen.
3. `contexts/types.ts`-Shim-Migration weiterführen (`shared/types/*` als SoT).
4. E2E-Test-Backlog (Detox Mindestpfad für Kernflows) starten.

## In diesem Patch umgesetzt (erste Punkte)
- `lib/orchestrator/providers/openai.ts`
  - API-Response intern typisiert (`output_text` / `output[].content`).
  - `any` in Output-Mapping entfernt.
  - Catch-Block von `error: any` auf `unknown` umgestellt.
  - Kleine Helpers für Abort-/Error-Message ergänzt.
- `lib/orchestrator/providers/anthropic.ts`
  - API-Response intern typisiert (`content[]`).
  - `any` in Content-Extraktion entfernt.
  - Catch-Block auf `unknown` + typisierte Fehlerbehandlung.
- `lib/orchestrator/index.ts`
  - Top-level Catch von `error: any` auf `unknown` umgestellt.
  - Abort-/Error-Handling helper-basiert vereinheitlicht.

## Warum sicher
- Keine Dependency-Änderungen.
- Keine Business-Logik-Änderung am Provider-Routing.
- Nur Typ-/Fehlerpfad-Härtung mit identischer funktionaler Semantik.

## Validierung
```bash
npm run typecheck
npm run lint:ci
npm run test:silent
```

Alle Checks grün.
