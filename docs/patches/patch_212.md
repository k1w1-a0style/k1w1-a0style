# Patch 212

Fixes syntax errors introduced in Patch 211 GitHub infra refactor.

## What changed

- `infra/github/repos.ts`
  - Fix missing closing `)`/`` ` `` in two `githubApiUrl(...)` call sites.
- `infra/github/compare.ts`
  - Fix malformed `githubApiUrl(...)` call (broken template literal + missing closing `)`).

## Why

Patch 211 centralizes GitHub API base + token keys. A couple of template literals were accidentally left with missing delimiters, breaking TypeScript parsing, ESLint parsing, and Jest.
