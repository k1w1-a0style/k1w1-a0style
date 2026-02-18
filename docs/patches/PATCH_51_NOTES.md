# PATCH 51 — CI Workflow YAML Fix

**Date:** 2026-02-10

## Goal
Fix `actionlint` failures caused by invalid YAML in workflow files where bash heredoc terminators (`NODE`) were not indented inside `run: |` blocks.

## Changes
- Indented heredoc terminators so YAML remains valid while bash heredocs still terminate correctly after YAML dedent.
  - `.github/workflows/k1w1-diagnostics.yml`
  - `.github/workflows/release-build.yml`

## Verification
- GitHub Actions `Workflow Lint (dry)` should pass `actionlint` again.
