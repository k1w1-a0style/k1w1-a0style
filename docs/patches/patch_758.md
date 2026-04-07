# Patch 758

## Ziel

Offene Restpunkte `DocsSyncGap`, `LegacyCryptoSurface`, `PreviewEvalTradeoff`, `SilentCatchLeftovers`, `ReleasePartial` mit kleinem, sicherem Scope abschliessen.

## Umsetzung

1. `scripts/check_patch_docs_sync.sh` auf echten Kern-SoT-Scope gehaertet (keine stillen Gruenlaeufe bei Kern-MD-Drift).
2. `androidKeystoreCrypto.ts` Legacy-Fläche enger und klarer als Compat-only benannt (kein Einfluss auf v3-Writepfad).
3. Restliche stille Catchs in `WebCodeEditor.tsx` und `ConfirmChangesModal.tsx` in sichtbare Warnungen umgestellt.
4. Kern-MDs (`README`, `TODO`, `Review`, `INDEX`, `TESTING_GUIDE`, `FRESH_CHECKOUT_GREEN_PATH`, `EDGE_FUNCTIONS_STATUS`, `PROJECT_CHECKLOG`, `PATCHLOG_ROOT`) auf denselben Stand synchronisiert.

## Verifikation

- `bash scripts/check_patch_docs_sync.sh`
- `npm run -s test:silent -- --runInBand __tests__/androidKeystoreCrypto.contract.test.ts __tests__/releaseReadiness.execution.contract.test.ts __tests__/previewEdgeErrorContract.test.ts`
- `npm run -s lint:ci`
- `npm run -s typecheck`
