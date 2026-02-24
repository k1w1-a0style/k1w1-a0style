# Patch 247: Auto-provision required GitHub workflows in linked project repo before triggering EAS build

## Summary

Ensures the linked *project repo* (the repo that receives the generated files, e.g. `musik-player`) always contains the required GitHub Actions workflows (`eas-link.yml`, `eas-build.yml`, `k1w1-triggered-build.yml`, etc.) **before** the app triggers the build via Supabase.

This fixes the common “Workflow not found (404)” situation when a freshly linked repo is missing the workflow YAMLs.

## Changes

- `project/services/buildStartService.ts`
  - After best-effort pushing generated project files to the linked repo, run `autoFixCIWorkflows()` as a best-effort step to create/update the managed workflow YAML files in that repo.

## Notes

- This keeps the architecture intact: **A0Style (builder app)** generates code → pushes into the **linked project repo** → triggers the **GitHub workflow in that same repo**.
- The workflow provisioning step is best-effort: if token/permissions are missing, build flow continues and logs a warning.
