# Patch 267: Redact GitHub token patterns in Edge error sanitization

**Date:** 2026-02-24

## Problem
`errorResponse()` sanitization redacted JWT/Bearer payloads but missed some GitHub token patterns when they were shorter than expected (e.g. `ghp_...` with < 20 chars), causing contract tests to fail and risking leakage.

## Fix
- Broaden GitHub token regex to match:
  - `ghp_`, `gho_`, `ghs_`, `ghu_`, `ghr_` with length >= 10
  - `github_pat_...` with length >= 10

## Result
- Edge error strings no longer leak GitHub token prefixes/payloads
- Contract test `edgeErrorResponseContracts` passes.
