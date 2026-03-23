# Patch 548

## Ziel

Den produktiven KI-Runtime-Vertrag auf aktuelle serverseitig unterstuetzte Modell-Defaults ziehen, Runtime-Fallbacks im Orchestrator ehrlicher machen und den CI-Lite-`workflow_dispatch`-Vertrag auf explizites `job_id` + `ref` konsolidieren.

## Umgesetzte Aenderungen

- `contexts/AIContext/models.ts`
  - Provider-Defaults und sichtbarer Modellkatalog auf aktuell runtime-unterstuetzte IDs umgestellt.
- `supabase/functions/k1w1-handler/helpers.ts`
  - Edge-Defaults auf denselben Modellstand gezogen und `balanced`/`review` sauber auf Speed-/Quality-Defaults gemappt.
- `lib/orchestrator/index.ts`, `lib/orchestrator/types.ts`, `lib/orchestrator/k1w1Edge.ts`, `hooks/useChatAIFlow.ts`, `shared/types/chat.ts`
  - strukturierte Runtime-Fallbacks fuer `provider_env_missing`/`provider_model_not_found`/404 ergänzt,
  - ehrliche Runtime-Hinweise im Chat verdrahtet,
  - Abort-Race zwischen Rate-Limit-Check und Edge-Invoke geschlossen,
  - Fallback-Exhaustion mit expliziter „keine serverseitig nutzbare Fallback-Route“-Meldung versehen.
- `components/CiLiteHeaderButton/hooks/useCiLiteWorkflow.ts`, `components/CiLiteHeaderButton/hooks/workflowRunMatching.ts`
  - `workflow_dispatch` sendet `ref` jetzt sowohl top-level als auch in `inputs`,
  - manuelle CI-Lite-Runs verlangen wieder strikt den `job_id`-Marker,
  - die Lookup-Diagnose behaelt informative Contract-Mismatch-Hinweise bis zum Timeout.
- `.github/workflows/k1w1-ci-lite.yml`, `infra/github/workflowTemplates.ts`, `supabase/functions/github-workflow-dispatch/index.ts`
  - `workflow_dispatch.inputs.ref` auf `required: true` vereinheitlicht.
- Tests / kleine UI-Nachzuege
  - Orchestrator-, AI-Quality-, k1w1-handler- und CI-Lite-Regressions-/Invariant-Tests auf den neuen Vertrag aktualisiert.
  - `screens/DiagnosticScreen/index.tsx` benennt den Quick-Action-Button kompakter als `Im Chat`.

## Validierung

- `npm run typecheck`
- `npm run lint:ci`
- `npm run test:silent`
- `npm run test:silent -- --runInBand lib/__tests__/orchestrator.test.ts`
- `npm run test:silent -- --runInBand __tests__/useCiLiteWorkflow.behavior.test.tsx`
