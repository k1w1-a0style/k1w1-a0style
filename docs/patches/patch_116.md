# Patch 116: fix preflightChecks syntax + add safe workflow YAML name quoting check

## Why
Your local branch broke with a hard syntax error in `lib/diagnostics/preflightChecks.ts` (stray `: PreflightCheck = {`), which blocks **typecheck/lint** and can cascade into app/runtime failures.

At the same time, GitHub Actions YAML can fail to parse in some cases when a `name:` value contains an unquoted `": "` substring (e.g. step/job names like `Build: Android`). This patch adds a **non-invasive** preflight that detects and can auto-fix the obvious cases.

## What changed
- **Fix:** restore valid TypeScript in `lib/diagnostics/preflightChecks.ts`.
- **Add:** `workflow-yaml-step-name-quoting` preflight check:
  - Scans `.github/workflows/*.yml|yaml` inside the project snapshot.
  - Flags `name:` lines where the value contains `": "` and is not already quoted.
  - Offers an auto-fix that wraps the value in double quotes and escapes `"`.

## How to apply
```bash
cd ~/k1w1-a0style
unzip -o k1w1-a0style_patch_116.zip -d .
rm -f k1w1-a0style_patch_116.zip

npm run typecheck
npm run lint:ci
npm run test:silent
```

## Notes
- The check is conservative (only obvious `name:` lines). It’s meant to prevent "workflow file won’t even load" cases without creating noise.
