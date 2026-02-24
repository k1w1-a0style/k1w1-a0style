# Patch 259: Build-start integration test scaffold

## Changes
- Add integration-ish Jest coverage for `project/services/buildStartService.startBuildJob`
  - GitHub push + default branch resolution
  - CI workflow auto-provision call
  - Supabase Edge `functions.invoke` payload + admin header
  - validation of returned jobId UUID

## Rationale
Prevents regressions in the core builder flow: generated project -> GitHub repo -> workflow trigger.
