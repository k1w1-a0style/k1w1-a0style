# Testing Guide

Stand: **2026-04-24 (Patch 786, GradleWrapperShaAndroidTaskVerification)**
<!-- Legacy marker for docs contract tooling: Stand: **2026-04-02 (Docs Konsolidierung)** -->

Ziel: klare Trennung zwischen **Pflichtchecks** (lokaler Gate-Basispfad) und **optionalen Zusatzchecks**.

## 1) Pflichtchecks (lokaler Standard-Gate)

```bash
npm ci
npm run typecheck
npm run typecheck:edge
npm run typecheck:strict
npm run lint:ci
npm run test:silent
```

## 2) Optionale Zusatzchecks (kontextabhaengig)

```bash
npm run test:e2e:smoke
npm run docs:sync:smoke
npm run verify:release
```

Hinweis zu `verify:release`:
- ohne `EDGE_BASE_URL` + `EDGE_OPERATOR_JWT` bleibt der ehrliche Status `OK_WITH_SKIPS`
- `OK_FULL` gilt nur mit gesetzten Live-Variablen
- App-Typecheck-Anteil in `verify:release` gilt nur, wenn `node_modules/expo/tsconfig.base.json` vorhanden ist

## 3) Read-only Live-/Staging-Checks

```bash
EDGE_BASE_URL="https://<project>.supabase.co/functions/v1" EDGE_OPERATOR_JWT="<extern provisionierter build_admin JWT>" npm run edge:check:live
```

oder als Vollpfad:

```bash
EDGE_BASE_URL="https://<project>.supabase.co/functions/v1" EDGE_OPERATOR_JWT="<extern provisionierter build_admin JWT>" npm run verify:release
```

### Variable-/Secret-Bezug fuer Live-Checks

Pflichtvariablen:
- `EDGE_BASE_URL`
- `EDGE_OPERATOR_JWT`

Sichere Bezugswege:
1. CI/Runner masked secrets (bevorzugt)
2. lokaler URL-Fallback mit eigenem Projekt-Ref
3. kurzlebiger `build_admin`-JWT fuer interaktive Operatorchecks

Wichtig:
- keine JWTs/API-Keys in Dateien, Commits oder Logs
- `service_role` ist kein gleichwertiger Ersatz fuer den usergebundenen `k1w1-handler`-Operator-Live-Contract

## 4) NPM-Umgebungs-Hinweis (Proxy-Keys)

Falls deine Umgebung alte `npm_config_http-proxy`/`npm_config_https-proxy` setzt, kann npm warnen (`Unknown env config "http-proxy"`).
Optional fuer saubere Runs:

```bash
env -u npm_config_http-proxy -u npm_config_https-proxy npm run typecheck
env -u npm_config_http-proxy -u npm_config_https-proxy npm run lint:ci
env -u npm_config_http-proxy -u npm_config_https-proxy npm run test:silent
```

## Verweise

- `docs/FRESH_CHECKOUT_GREEN_PATH.md`
- `docs/04-testing-smoke-plan.md`
- `docs/08-test-coverage-matrix.md`
