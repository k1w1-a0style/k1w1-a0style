# Patch 757: PreviewEvalTradeoff + PreviewSecretGate konsistent abschliessen

## Ziel
Die zwei offenen Restpunkte wurden ohne Grossumbau abgeschlossen:
1. `PreviewEvalTradeoff`
2. `PreviewSecretGate`

## Aenderungen

### 1) PreviewEvalTradeoff (`supabase/functions/preview_page/helpers.ts`)
- Der verbleibende CSP-Sandbox-Tradeoff ist jetzt direkt im Code klar benannt:
  - `unsafe-eval` kann fuer Sandpack weiterhin notwendig sein.
  - `https://esm.sh` bleibt als bewusst genutzter CDN-Importpfad moeglich.
  - Das ist explizit **kein voll risikofreier/strict geschlossener CSP-Pfad**.
- Kleine Low-Risk-Haertung ohne Default-Break:
  - `PREVIEW_STRICT_CSP=true` deaktiviert `unsafe-eval` zusaetzlich zu `TEST_STRICT_CSP=true`.
  - `PREVIEW_ALLOW_UNSAFE_EVAL=false` deaktiviert `unsafe-eval` weiter explizit.
  - `PREVIEW_ALLOW_ESM_SH_CDN=false` entfernt `https://esm.sh` aus `script-src`.
- Default-Verhalten bleibt absichtlich kompatibel, um den Preview-Pfad nicht zu brechen.

### 2) PreviewSecretGate (`supabase/config.toml`, `docs/EDGE_FUNCTIONS_STATUS.md`)
- Secret-Gate-Sonderpfad wurde sprachlich/vertraglich enger gemacht:
  - `preview_page` bleibt bewusst `verify_jwt=false`.
  - explizit als **kein normaler JWT-Endpunkt** markiert.
  - Dokumentation nennt weiterhin klar Fragment->Header-Handoff, Secret-Format-Guard, TTL/Expiry-Delete, durable Rate-Limit.
- Dadurch sind Config + Status-Doku + Runtime-Vertrag konsistent lesbar.

## Verifikation
- `npm run -s test:silent -- --runInBand __tests__/previewEdgeErrorContract.test.ts __tests__/patch514.buildPreviewEnvSharedHelpers.invariants.test.ts`
- `npm run -s typecheck`
- `npm run -s lint:ci`

Alle Checks liefen gruen.

## Ergebnis / Rest-Tradeoff
- `PreviewEvalTradeoff`: bewusst verbleibend, jetzt enger steuerbar und ehrlich dokumentiert.
- `PreviewSecretGate`: bewusst verbleibend, klar als Sonderpfad abgegrenzt (kein JWT-Standardpfad).
