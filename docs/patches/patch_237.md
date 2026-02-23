# Patch 237 — Remove placeholder contextWindow metadata

## Why
Some model entries used `contextWindow: '—'` as a placeholder. This is noisy in UI/reviews and doesn't add real value.

## What changed
- `ModelInfo.contextWindow` is now optional.
- Removed placeholder `contextWindow: '—'` from all model entries where the context size is unknown.
- Kept real values where known (Gemini models keep `1M`).

## Files
- `contexts/AIContext.tsx`
