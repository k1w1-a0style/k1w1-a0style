# Patch 663 — Refactor-Durchlauf 23 (remaining productive typing follow-up)

## Ziel
Den naechsten kleinen produktionsnahen Typing-/Error-Contract-Block helper-first nachziehen, ohne API-/KI-/Workflow-Vertraege zu aendern.

## Umsetzung
- `lib/validators.ts` liest die Back-compat-Groessenkonstanten jetzt ueber kleine Validation-Reader statt `cfg: any`.
- `supabase/functions/github-workflow-runs/index.ts` nutzt fuer Request-Body und GitHub-JSON jetzt Record-/String-/Number-Narrowing statt `body: any` / `json: any`.
- `supabase/functions/k1w1-handler/helpers.ts` extrahiert sichere `readGeminiTextParts(...)` / `readAnthropicTextParts(...)` statt lokaler `part: any`-Mappaths.
- `lib/__tests__/validators.test.ts` ergaenzt einen fokussierten Constants-Check.
- `__tests__/k1w1Handler.textExtraction.test.ts` deckt die neuen Textteil-Reader fuer Gemini/Anthropic ab.

## Vertragswirkung
- Keine API-/KI-/Workflow-Vertragsaenderung.
- Nur lokale Typisierung und Text-/JSON-Auslese enger gezogen.

## Naechster sinnvoller Schritt
- `project/services/templateLoader.ts`
- `lib/diagnostics/smartPatch.ts`
- `lib/diagnostics/buildPipelineDiagnostics.ts`
- `supabase/functions/github-workflow-logs/helpers.ts`
