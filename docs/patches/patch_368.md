# Patch 368 — CI-Lite smoke: better failure diagnostics + gitignore

## Why
The CI-Lite smoke script could tell you a run failed, but not *why*. This patch adds optional GitHub job/step introspection (if `GITHUB_TOKEN` is set) and a clear fallback hint using `gh run view`.

Also ensures local CI-Lite env files stay uncommitted via `.gitignore`.

## Changes
- `scripts/ci-lite-smoke.sh`
  - robust JSON payload via `jq`
  - polls until completion
  - on failure: prints failing job/step summary if `GITHUB_TOKEN` is set; otherwise prints a `gh` command
- `.gitignore`
  - ignores `.env.ci-lite.local` and variants

## How to use
```bash
chmod +x scripts/ci-lite-smoke.sh
./scripts/ci-lite-smoke.sh k1w1-a0style/musik-player k1w1-ci-lite-autofix.yml main
```

Optional (recommended) for better error output:
```bash
export GITHUB_TOKEN=... # needs repo:actions read
```
