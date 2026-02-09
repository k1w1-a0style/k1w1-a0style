# Patch 18 – Notes / Manual Append for PROJECT_CHECKLOG.md

Date: 2026-02-09

## What was fixed
- CI failure: `expo.extra.eas.projectId` was `undefined` in `npx expo config --json` (GitHub Actions).
  - Root cause: `app.config.js` relied on `process.cwd()`; Expo CLI can evaluate config with a different cwd.
  - Fix: read `eas-project.json` via `__dirname` first (fallback to `process.cwd()`).
- Workflow Lint (actionlint/shellcheck) failures:
  - `k1w1-diagnostics.yml`: fixed SC2129 by grouping writes to `$GITHUB_STEP_SUMMARY` and `$GITHUB_OUTPUT`.
  - `release-build.yml`: fixed SC2259 by removing `echo "$RESP" | node - <<'NODE'` (pipe + heredoc conflict). Pass JSON via env instead.
  - Also cleaned up quoting and output appends for robustness.

## How to verify
- Local:
  - `npx expo config --json | node -e 'const c=require("fs").readFileSync(0,"utf8"); const j=JSON.parse(c); console.log(j?.expo?.extra?.eas?.projectId)'`
    → should print a UUID.
- CI:
  - `CI / ci / ci` should pass the “Expo config smoke test (projectId present)” step.
  - `Workflow Lint (dry)` should pass actionlint.

## Commit message suggestion
fix(ci): make expo projectId deterministic; fix workflow-lint shellcheck warnings
