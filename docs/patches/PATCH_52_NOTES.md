# Patch 52 – Docs: merge PROJECT_CHECKLOG append files

## Changes
- Merge legacy `PROJECT_CHECKLOG_APPEND_PATCH_36.md`, `..._37.md`, `..._39.md`, `..._39_HOTFIX1.md`, `..._40.md` into `PROJECT_CHECKLOG.md` under a dedicated “Merged Append-Logs” section.
- Keep the append files but mark them as merged (so they can be deleted later without losing history).

## Verification
- `npm run typecheck`
- `npm run lint:ci`
- `npm run test:silent`
