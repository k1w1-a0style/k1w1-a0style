# Patch 391 - restore 5-provider support in k1w1-handler + provider invariants

## Goal
Bring the central Edge AI handler back to the intended 5-provider state:
- groq
- gemini
- openai
- anthropic
- huggingface

## Changes
- extend `DEFAULT_MODELS` in `k1w1-handler/helpers.ts`
- add:
  - `callOpenAI(...)`
  - `callAnthropic(...)`
  - `callHuggingFace(...)`
- update `k1w1-handler/index.ts` routing to support all 5 providers
- add invariant test `__tests__/k1w1Handler.providers.invariants.test.ts`

## Notes
This patch intentionally restores provider completeness first.
Model tuning / provider-specific defaults can still be adjusted later without losing the 5-provider contract.
