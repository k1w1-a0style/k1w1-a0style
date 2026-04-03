# Patch 733 — Template-Workflow-Paritaet + Guard-Nachzug

## Kontext / Ursache

- Das offene Review-Feedback war korrekt: nach dem Pinwechsel auf `actions/upload-artifact` waren die eingebetteten Workflow-Kopien in `templates/expo-sdk54-base.json` und `templates/expo-sdk54-full.json` nicht vollstaendig mit den Live-Workflows synchron.
- Dadurch meldete `__tests__/patch422.templateWorkflowBaseline.invariants.test.ts` Drift fuer `release-build.yml` und `eas-build.yml`.

## Umsetzung

1. Template-Workflow-Pins auf denselben Full-SHA wie die Live-Workflows gezogen:
   - `ea165f8d65b6e75b540449e92b4886f43607fa02`
2. `SUPABASE_RAW`-Persistenz defensiv gehaertet:
   - `normalizeStoredSupabaseRaw(...)` verwirft Legacy-Secret-Kompositwerte `url:::key` explizit.
3. Durable rate-limit fallback klarer signalisiert:
   - Fallback-Warnungen enthalten jetzt explizit `fallback_mode=local_in_memory_best_effort` und `cluster_safe=false`.
4. verify_jwt-Drift-Grenze dokumentiert:
   - Testing-/Status-/Release-Doku macht explizit, dass Behavior-Checks allein kein vollstaendiger Beweis fuer unveraenderte Live-`verify_jwt`-Flags sind.

## Verifikation

- `npm run test:silent -- --runInBand __tests__/patch422.templateWorkflowBaseline.invariants.test.ts __tests__/supabaseRawNormalization.test.ts __tests__/auth.failClosedAndDurableRateLimit.test.ts __tests__/releaseReadiness.contracts.test.ts`
- `bash scripts/check_workflow_template_drift.sh`
- `npm run typecheck`
- `npm run typecheck:edge`
- `npm run lint:ci`
- `npm run test:silent`
- `npm run verify:release`
