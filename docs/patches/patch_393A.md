# Patch 393A

Datum: 2026-03-08

## Ziel
CI Lite und CI Lite Autofix härten, ohne den bestehenden Header-/Artifact-Contract zu brechen.

## Enthalten
- `.github/workflows/k1w1-ci-lite.yml`
- `.github/workflows/k1w1-ci-lite-autofix.yml`
- `infra/github/workflowTemplates.ts`
- `__tests__/invariants.strings.test.ts`
- `.github/workflows/README.md`
- `docs/patches/PATCHLOG_ROOT.md`
- `docs/patches/patch_393A.md`
- `PROJECT_CHECKLOG.md`
- `README.md`

## Änderungen
- `tee`-Pipelines in CI Lite und Autofix auf `set -o pipefail` umgestellt.
- GitHub Actions auf Full-SHA-Pinning angehoben:
  - `actions/checkout@34e114876b0b11c390a56381ad16ebd13914f8d5`
  - `actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020`
  - `actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02`
- Expo-Preflight ergänzt (`npx --no-install expo config --json`) und robust an `ci-core.yml` angeglichen:
  - liest `const projectId = (data?.expo ?? data)?.extra?.eas?.projectId;`
- Result-JSONs bleiben kompatibel und erweitern um `expo_exit`; `ok` bleibt erhalten.
- Template-Quelle in `infra/github/workflowTemplates.ts` mitgezogen, damit kein stiller Drift entsteht.
- Invariant-Test ergänzt, der `pipefail`, SHA-Pins, Expo-Preflight und JSON-Felder absichert.

## Warum
Der bisherige `tee`-Aufbau konnte wegen fehlendem `pipefail` false-green Exit-Codes erzeugen. Das ist für den Header-Status kritisch. Zusätzlich fehlte in CI Lite der Expo-Preflight, obwohl `ci-core.yml` denselben Readiness-Punkt bereits als wichtig behandelt.

## Nicht enthalten
- Kein Supabase-Deploy-Umbau. Das folgt separat in Patch 393B.
- Kein Cleanup-/Delete-Paket. Das folgt, falls nötig, gesammelt in 393C.

## Nach dem Einspielen
```bash
npm run typecheck
npm run lint:ci
npm run test:silent
```

Optional zusätzlich:
```bash
npx jest __tests__/invariants.strings.test.ts --runInBand
```
