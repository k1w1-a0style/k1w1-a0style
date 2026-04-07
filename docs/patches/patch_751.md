# Patch 751 - Preview-Secret/RateLimit/Release-Depth Hardening

## Ziel
Kleine, risikoarme Haertungen fuer offene Security-/Truthfulness-Restpunkte ohne grossen Umbau.

## Aenderungen

1. Preview-Secret-Modell
- `save_preview` speichert Preview-Secrets nur noch gehasht (`hashPreviewSecret(...)`) statt Klartext.
- `preview_page` lookuped hash-first und fallbackt fuer alte Klartext-Datensaetze kompatibel auf raw-secret.

2. Preview-Auth-Boundary
- `preview_page` akzeptiert nur noch `GET`/`HEAD`.
- Fragment-Handoff bleibt erhalten (`x-k1w1-preview-secret`), Query-Secret wird nicht reaktiviert.

3. LocalPreviewEval
- `buildSandpackHtml(...)` erlaubt lokalen Eval-/CDN-Fallback nie in `NODE_ENV=production`, auch nicht bei explizitem Opt-in.

4. RateLimitDegradation
- `requireDurableRateLimit(...)` unterstuetzt `enforceDurable: true`.
- Bei erzwungenem Durable-Mode liefert Ausfall jetzt `503 rate_limit_unavailable` statt stiller local-only Degradation.
- `save_preview` und `preview_page` setzen `enforceDurable: true`.

5. ReleaseReadinessTestDepth
- Neuer Execution-Contract-Test fuehrt `scripts/check_release_readiness.sh` in einer isolierten Stub-Umgebung aus und prueft:
  - mandatory-check failure stoppt den Lauf,
  - `OK_WITH_SKIPS` bei legitimen Skips,
  - `OK_FULL` ohne Skips.

6. SilentCatchDebt
- `lib/chatPrivacySettings.ts` ersetzt stille Catch-Pfade durch warn-logging mit sicherem Default-/best-effort-Verhalten.

7. HistoricalChecklogDrift
- Checklog-/Patch-SoT auf Patch 751 hochgezogen; Historie bleibt append-only und nicht alleinige Release-Wahrheit.

## Validation
- `npm run -s typecheck`
- `npm run -s lint:ci`
- `npm run -s test:silent -- --runInBand __tests__/previewEdgeErrorContract.test.ts __tests__/edgeRateLimitCoverage.invariants.test.ts __tests__/edgeRateLimitHighRiskRoutes.invariants.test.ts __tests__/auth.failClosedAndDurableRateLimit.test.ts lib/__tests__/sandpackBuilder.test.ts __tests__/releaseReadiness.contracts.test.ts __tests__/releaseReadiness.execution.contract.test.ts`
- `npm run -s docs:lint`
- `npm run -s docs:check:contracts`
- `bash scripts/check_patch_docs_sync.sh`
