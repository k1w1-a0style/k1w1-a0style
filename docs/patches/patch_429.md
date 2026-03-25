# Patch 429 – KI-Provider/Modelle: konservatives Erreichbarkeits- und Default-Audit

## Kontext
Im Repo gab es zwei getrennte Modell-Wahrheiten: App-seitige Provider-/Modellkataloge waren neuer, aber der Supabase-Edge-Handler (`k1w1-handler`) nutzte teils ältere oder weniger konsistente Default-Modelle (u.a. Gemini 1.5, Anthropic `-latest`, HF Mistral/Llama).

## Historischer Hinweis (nach spaeteren Merges)
Diese Notiz beschreibt den Stand vom 2026-03-14. Der aktuell gueltige Modell-/Default-Stand liegt inzwischen in `contexts/AIContext/models.ts`, `shared/ai/providerDefaults.ts` und `shared/ai/modelRuntimeMap.ts` (u.a. Gemini `gemini-3.1-flash-lite`/`gemini-3.1-pro`).

## Probleme
- Edge-Defaults drifteten gegen die App-Defaults (`contexts/AIContext/models.ts`).
- Anthropic-Defaults nutzten `-latest` Aliase statt stabilen, datierten IDs.
- Groq-Defaults waren nicht auf den appweiten Speed-Default (`groq/compound-mini`) ausgerichtet.

## Minimaler Fix
- `supabase/functions/k1w1-handler/helpers.ts`:
  - Defaults aktualisiert auf app-konsistente IDs:
    - Groq: `groq/compound-mini` / `llama-3.3-70b-versatile`
    - Gemini: `gemini-2.5-flash-lite` / `gemini-2.5-flash`
    - OpenAI: unverändert `gpt-4o-mini` / `gpt-4o`
    - Anthropic: `claude-3-5-haiku-20241022` / `claude-3-5-sonnet-20241022`
    - HuggingFace: `Qwen/Qwen2.5-7B-Instruct` / `Qwen/Qwen2.5-Coder-32B-Instruct`
  - Groq-Request robust gemacht: bei model-not-found mit `groq/`-Präfix wird einmal ohne Präfix erneut versucht.
  - Gemini-URL-Parameter (`model`, `apiKey`) sicher URL-encodiert.
- `__tests__/k1w1Handler.providers.invariants.test.ts`:
  - neue Invariants für aktualisierte Default-IDs
  - Guard gegen Rückfall auf Legacy-IDs (`gemini-1.5-*`, `claude-*-latest`)
  - Invariant für Groq-Präfix-Fallback vorhanden

## Online-Checks (ehrlich eingeordnet)
Online-Provider-Checks ohne produktive Keys sind nur als Transport-/Endpoint-Check sinnvoll. Deshalb wurden keine „Modell ist erreichbar“-Behauptungen ohne Auth gemacht.

## Verifikation
- `bash scripts/check_workflow_template_drift.sh`
- `bash scripts/check_managed_workflows.sh`
- `bash scripts/check_workflow_edge_contracts.sh`
- `bash scripts/check_legacy_disabled_edges.sh`
- `bash scripts/check_patch_docs_sync.sh`
- `npm run typecheck`
- `npm run lint:ci`
- `npm run test:silent`
