# Patch 366 — CI-Lite Smoke Runner + github-workflow-logs run metadata

## Warum
Im Terminal willst du schnell prüfen, ob CI-Lite wirklich **grün/rot** ist (GitHub Truth), ohne in der App raten zu müssen.

Zusätzlich hat `github-workflow-logs` zwar Logs geliefert, aber **keine Run-Metadaten** (status/conclusion/url). Dadurch kann die UI “grün” wirken, obwohl der Run in GitHub rot ist.

## Änderungen

### 1) `scripts/ci-lite-smoke.sh`
- Dispatch → Poll Runs → Logs (inkl. *exit code 1* bei Failure)
- Parst korrekt die `github-workflow-runs` Response (`data.workflow_runs[0]`)
- Zeigt „GitHub truth“ (status/conclusion/html_url)

### 2) `supabase/functions/github-workflow-logs/index.ts`
- Fehlende Imports ergänzt (Deno bundling + Runtime stabil)
- Added **run metadata** (`run: { status, conclusion, html_url, … }`) im Response
- Token-Source vereinheitlicht: request token → env token (`getGithubToken()`)

## Nutzung

```bash
set -a && source ./.env.ci-lite.local && set +a
chmod +x scripts/ci-lite-smoke.sh
./scripts/ci-lite-smoke.sh k1w1-a0style/musik-player k1w1-ci-lite-autofix.yml main
```
