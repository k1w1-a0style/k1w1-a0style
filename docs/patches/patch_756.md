# Patch 756: Diagnostic Upload non-throwing ID fallback hardening

## Kontext

Im Diagnostic-Upload blieb ein harter Restpfad offen: Wenn `expo-crypto`, WebCrypto **und** `uuidv4()` gleichzeitig ausfallen, durfte weder Device-ID-Erzeugung noch Copy-/Upload-Flow scheitern.

## Aenderungen

1. `screens/DiagnosticScreen/hooks/useDiagnosticUpload.ts`
   - Device-ID-Fallback-Kette final gehaertet:
     - A: `Crypto.getRandomBytesAsync(...)`
     - B: `globalThis.crypto.getRandomValues(...)`
     - C: `uuidv4()`
     - D: finaler non-throwing Rettungsanker (`timestamp + counter`)
   - Zusätzliche Absicherung: `clientRequestId` nutzt jetzt ebenfalls einen non-throwing UUID-Fallback, damit der Flow bei kaputtem UUID-Runtime-Pfad nicht erneut bricht.
   - Warn-Logs fuer Fallback-Eskalation bleiben sichtbar.

2. `__tests__/useDiagnosticUpload.silentCatchFollowup.test.tsx`
   - Runtime-Test fuer Triple-Fail (`expo-crypto` + WebCrypto + `uuidv4`) deckt jetzt ab, dass Copy weiterhin funktioniert.
   - Test fuer UUID-Fallback bei fehlendem WebCrypto, aber funktionierendem `uuidv4()` ergaenzt.
   - Warnpfade explizit verifiziert.

3. Release-Truthfulness-Klarstellung
   - `docs/runbooks/OPERATOR_EXECUTION_CHECKLIST.md`
   - `docs/runbooks/OPERATOR_SETUP_CHECKLIST.md`
   - `OK_WITH_SKIPS` ist dort jetzt explizit als partial/local evidence und **nicht** als Voll-Sign-off beschrieben.

## Verifikation

- `npm run -s test:silent -- --runInBand __tests__/useDiagnosticUpload.silentCatchFollowup.test.tsx lib/__tests__/sandpackBuilder.test.ts __tests__/releaseReadiness.execution.contract.test.ts __tests__/previewEdgeErrorContract.test.ts`
- `npm run -s typecheck`
- `npm run -s lint:ci`

