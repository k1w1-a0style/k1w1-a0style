# Patch 160

## Summary

PR-7 Stage 2: migrate internal imports away from facade modules to their canonical locations.

Facades remain for compatibility, but app/runtime code now prefers:
- `infra/github/githubService` over `contexts/githubService`
- `infra/storage/projectPersistence` over `contexts/projectStorage`
- `lib/diagnostics/templates` over `lib/templateChecklist`

## Changes

- GitHub imports
  - Update hooks, screens and diagnostics to import from `infra/github/githubService`.

- Storage imports
  - Update `contexts/ProjectContext.tsx` and `project/services/projectArchiveService.ts` to import from `infra/storage/projectPersistence`.

- Template checklist imports
  - Update remaining call sites to import from `lib/diagnostics/templates` (runner + helpers).

## Why

This reduces dependency on temporary facade files and makes the later removal of facades low-risk.
