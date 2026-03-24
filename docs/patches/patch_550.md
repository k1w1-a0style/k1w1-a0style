# Patch 550

## Ziel

Die noch realen PR-408-Reviewpunkte auf dem aktuellen Branch-Stand schliessen: ehrliche Provider-Defaults fuer Anthropic beibehalten/aktualisieren, App-/Edge-Defaults an eine gemeinsame Quelle binden und Runtime-Fallback-Hinweise aus spaeteren LLM-Prompts fernhalten.

## Umgesetzte Aenderungen

- `shared/ai/providerDefaults.ts`
  - Neue gemeinsame Source-of-Truth fuer die app- und edge-seitig verwendeten Provider-Default-Modelle.
  - Anthropic-Quality-Default auf `claude-sonnet-4-20250514` aktualisiert; Groq/Gemini bleiben auf den bereits runtime-gueltigen IDs.
- `contexts/AIContext/models.ts`
  - `PROVIDER_DEFAULTS` auf die gemeinsame Default-Quelle umgestellt.
  - `Claude Sonnet 4` als verfuegbares Anthropic-Qualitaetsmodell in den sichtbaren Katalog aufgenommen.
- `supabase/functions/k1w1-handler/helpers.ts`
  - Edge-Handler-Defaults auf dieselbe gemeinsame Default-Quelle umgestellt, damit App und Edge nicht wieder driften koennen.
- `lib/promptSanitizer.ts`
  - `runtimeNote` als explizites Meta-Flag fuer prompt-auszuschliessende Chat-Historie aufgenommen.
  - Runtime-Fallback-Hinweise bleiben sichtbar im Chat, werden aber nicht mehr in spaetere Provider-Prompts uebernommen.
- Tests
  - Regressionen fuer gemeinsame Default-IDs, Anthropic-Default-Mapping, Groq-Qwen-Katalogeintrag sowie Runtime-Note-Sanitizing ergaenzt/aktualisiert.

## Validierung

- `npm run typecheck`
- `npm run lint:ci`
- `npm run test:silent`
- `git diff --check`
