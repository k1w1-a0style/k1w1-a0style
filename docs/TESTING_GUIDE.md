# Testing Guide

Stand: **2026-04-08 (Patch 760, LocalRemoteDiffSectionRefactor + RefactorSoTDrift abgeschlossen)**
<!-- Legacy marker for docs contract tooling: Stand: **2026-04-02 (Docs Konsolidierung)** -->

## NPM-Umgebungs-Hinweis (Proxy-Keys)

Falls deine Shell/CI alte env-Keys wie `npm_config_http-proxy`/`npm_config_https-proxy` setzt, kann npm warnen:

- `Unknown env config "http-proxy"`

Das ist kein Test-Fail im Repo, aber fuer saubere Runs kannst du die alten env-Keys vor dem Lauf entfernen:

```bash
env -u npm_config_http-proxy -u npm_config_https-proxy npm run typecheck
env -u npm_config_http-proxy -u npm_config_https-proxy npm run lint:ci
env -u npm_config_http-proxy -u npm_config_https-proxy npm run test:silent
```

## Kanonischer lokaler Ablauf

```bash
npm ci
npm run typecheck
npm run typecheck:edge
npm run typecheck:strict
npm run lint:ci
npm run test:silent
```

Optional:

```bash
npm run test:e2e:smoke
npm run verify:release (inkl. App-Typecheck nur, wenn `node_modules/expo/tsconfig.base.json` vorhanden ist)
```

## Read-only Live-/Staging-Checks

```bash
EDGE_BASE_URL="https://<project>.supabase.co/functions/v1" EDGE_OPERATOR_JWT="<extern provisionierter build_admin JWT>" npm run edge:check:live
```

Oder als kompletter Verify-Pfad:

```bash
EDGE_BASE_URL="https://<project>.supabase.co/functions/v1" EDGE_OPERATOR_JWT="<extern provisionierter build_admin JWT>" npm run verify:release
```

### Wichtige Grenze der Live-Contract-Checks (verify_jwt)

- `npm run edge:check:live` prueft aktuell API-Verhalten (z. B. Error-Codes/Antwortstruktur), nicht direkt Dashboard-Flags.
- Der operatorische Flag-Audit ist fuer den aktuellen Stand erfolgt: live ist fuer `save_preview` und `k1w1-handler` `verify_jwt=true` bestaetigt.
- Fuer kuenftige Releases bleibt ein expliziter Flag-Abgleich sinnvoll, weil ein spaeterer Dashboard-Drift durch reine Verhaltenschecks nicht sicher ausgeschlossen wird.

## Zweck

- lokale Verifikation reproduzierbar halten
- Edge-/Docs-/Contract-Checks nicht von Hauptsuite entkoppeln
- Read-only Live-Checks klar von produktiven Mutationen trennen

## Verweise

- `docs/FRESH_CHECKOUT_GREEN_PATH.md`
- `docs/04-testing-smoke-plan.md`
- `docs/08-test-coverage-matrix.md`
