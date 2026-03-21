# Patch 522 — Lokalen Edge-Admin-Key-Save-Flow im Credentials Wizard haerten

## Ziel

Der lokale Save-Flow fuer den Edge Admin Key soll dieselbe formale Validierungslogik nutzen wie
die bestehende Diagnose fuer `missing` / `invalid` / `rejected`. Leer oder nur Whitespace bleibt
weiter als bewusstes Loeschen erlaubt, aber nicht-leere formal ungueltige Werte duerfen nicht mehr
lokal persistiert werden.

## Root Cause

`onSaveAdminKey()` trimmte den eingegebenen Wert zwar, reichte danach aber jeden nicht-leeren
String direkt an `saveEdgeAdminKey(...)` weiter. Dadurch konnten lokal kaputte Werte in
SecureStore landen, obwohl `isLikelyValidAdminKey(...)` denselben Wert spaeter bereits als
formal ungueltig klassifiziert haette. Das erzeugte vermeidbare Folgefehler und unehrliche
`invalid`-/`rejected`-Zustaende nach dem Speichern.

## Umsetzung

1. `screens/CredentialsWizardScreen/hooks/useCredentialsWizardScreen.ts`
   - `onSaveAdminKey()` trimmt weiterhin zuerst den lokalen Eingabewert.
   - `trimmed === ""` bleibt der bestehende Loeschpfad und fuehrt weiter ueber `saveEdgeAdminKey("")`.
   - `trimmed !== "" && !isLikelyValidAdminKey(trimmed)` blockiert den Save jetzt vor Persistenz mit einer kurzen Alert-Meldung.
   - Nur formal gueltige, bereits getrimmte Werte werden gespeichert und danach wie bisher rehydriert.
2. `__tests__/credentialsWizard.trustSemantics.test.tsx`
   - deckt jetzt gezielt drei Save-Pfade ab: leer/Whitespace => loeschen, formal ungueltig => nicht speichern, formal gueltig => speichern.
3. Diagnose-Regression bleibt abgesichert
   - Die bestehenden Tests in `__tests__/localAdminKey.test.ts` halten die Zustandslogik fuer `missing` / `invalid` / `rejected` weiter regressionsfest.

## Tests / Checks

- `bash scripts/check_patch_docs_sync.sh`
- `npm run typecheck`
- `npm run lint:ci`
- `npm run test:silent`

## Risiko / Scope

- Kein Bearer-/Header-Umbau.
- Keine Aenderung an Preview, CI Lite, SecureStore-Architektur oder Auth-Flows.
- Nur der lokale Save-Flow im Credentials Wizard wurde minimal an die bestehende Validierungs-SoT angeglichen.
