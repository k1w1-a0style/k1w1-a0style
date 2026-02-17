# Patch 155 – PR-6 (Stage 1): Template checklist modularization

## Goal
Start PR-6 by modularizing the large `lib/templateChecklist.ts` without behavior changes.

## What changed
- Added `lib/diagnostics/templates/*` modules:
  - `templateSelection.ts` (template heuristics + auto resolution)
  - `templateChecklistTypes.ts` (checklist types)
  - `toolchain.ts` (DEFAULT_TOOLCHAIN)
  - `requiredFiles.ts` (required files/assets/workflows)
  - `assets.ts` (tiny PNG base64)
- Updated `lib/templateChecklist.ts`:
  - re-exports the public API (`TemplateId`, `CoreTemplateId`, checklist types, selection helpers)
  - imports toolchain/constants from the new modules

## Behavior
No intended runtime behavior changes. This is a structural split to make further PR-6 work smaller and safer.
