# Patch 28 (CodeScreen) - Large file guardrails (no UI change)

## Why
On large files, `validateSyntax` + `validateCodeQuality` on every edit can cause lag and memory spikes.

## What changed
- Live validation now uses a policy:
  - Normal files: debounce 500ms, run syntax + quality checks
  - Large files (>200k chars or >5000 lines): debounce 1500ms, run syntax only
  - Huge files (>600k chars): skip live validation entirely (editor stays responsive)

## No UI changes
This patch only affects background validation frequency.
