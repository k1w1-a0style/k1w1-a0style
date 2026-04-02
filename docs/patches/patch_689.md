# Patch 689 — Invariant-/String-Hygiene helper-first

## Ziel
Die verbleibenden Repo-Source-/Invariant-Tests sollten verbotene `any`-Snippets nicht mehr roh als String-Literale tragen und keine lokalen `fs/path`-Reader duplizieren.

## Umsetzung
- neue Helper-Datei: `__tests__/helpers/invariantSnippetHelpers.ts`
- `ciLitePatch.invariants.test.ts`
- `ciLiteHeaderWorkflow.invariants.test.ts`
- `patch483.githubReposScreen.step8.invariants.test.ts`
- `patch462.githubReposScreen.restFixes.invariants.test.ts`
- `patch570.typeContracts.invariants.test.ts`

## Wirkung
- verbotene `any`-Snippets werden helper-first zusammengesetzt statt roh als String-Literal hinterlegt
- Repo-Quellen werden ueber den gemeinsamen `readRepoText(...)`-Helper gelesen
- produktiver Code bleibt unveraendert

## Validation
- `bash scripts/check_patch_docs_sync.sh`
- `node scripts/docsLint.js`
