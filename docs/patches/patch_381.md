# Patch 381 — CI Lite SoT hardening + build gate metadata persistence

## Why

The automatic APK builder flow already had the right direction (Repo/Branch as SoT, CI Lite before Build),
but a few important details were still too soft:

- CI Lite results were not persisted with enough context to safely reuse them later
- the artifact fetch path in the header did not correctly distinguish CI Lite vs. CI Lite Autofix
- `requireSupabaseEdgeUrl()` was used without `await` in the artifact fetch path
- build start still had a fallback to `CONFIG.BUILD.GITHUB_REPO`, which weakens the app-side SoT
- `github-workflow-dispatch` contained a broken `lastDetails` reference in the 422/bootstrap recovery path

## What changed

- Extended `STORAGE_KEYS` with CI Lite metadata:
  - `CI_LITE_LAST_REPO`
  - `CI_LITE_LAST_BRANCH`
  - `CI_LITE_LAST_WORKFLOW`
  - `CI_LITE_LAST_JOB_ID`
  - `CI_LITE_LAST_RUN_ID`
  - `CI_LITE_LAST_CONCLUSION`
- `useCiLiteWorkflow` now:
  - awaits `requireSupabaseEdgeUrl()` correctly
  - resolves the correct artifact name / file path for CI Lite vs. CI Lite Autofix
  - resets artifact state when visibility / workflow / run changes
  - persists CI Lite result metadata together with lint/typecheck state
- `buildStartService` now:
  - requires a valid linked repo and linked branch
  - removes the build fallback to `CONFIG.BUILD.GITHUB_REPO`
  - blocks build start when CI Lite is red, stale, or belongs to another repo/branch
- Tightened types in CI Lite UI components (`ChatMessage` instead of `any`)
- Fixed the workflow-dispatch recovery path so 422 `Unexpected inputs provided` can be analyzed safely

## Notes

This patch intentionally hardens the existing Repo/Branch-based design.
Commit-SHA binding is still a sensible next step, but it should come as a dedicated follow-up patch.
