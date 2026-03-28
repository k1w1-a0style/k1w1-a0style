# Patch 569 – Kleine Typ-/Payload-Haertung in CI-Lite-Utils und AppInfo-Backup

Datum: 2026-03-28  
Branch: `codex`

## Ziel

Zwei kleine, mergefreundliche Hotspot-Haertungen ohne Flow-Umbau:

1. `components/ciLite/ciLiteUtils.ts`
2. `lib/appInfoBackup.ts`

Fokus: riskante `any`-Zugriffe reduzieren, `unknown` + Narrowing einsetzen, Fallback-Semantik beibehalten.

## Umgesetzte Aenderungen

### 1) `components/ciLite/ciLiteUtils.ts`

- `findWorkflowRunByJobId(...)` nutzt jetzt kleine Run-Kandidaten-Typen statt `any[]`.
- Neue lokale Guards:
  - `isRecord(...)`
  - `toWorkflowRunCandidate(...)`
  - `toWorkflowRunWithTitle(...)`
  - `getRunTitle(...)`
- Unvollstaendige/fremde Run-Objekte werden fail-safe ignoriert, Matching-Logik (exact marker zuerst, danach includes) bleibt unveraendert.
- `normalizePreflightPatch(...)` nimmt jetzt `unknown` statt `any`.
- Patch-Normalisierung liest `upsert`/`delete`/`jsonMerge` ueber sichere Array-Grenzen statt `as any`-Property-Ketten.
- Semantik bleibt gleich:
  - plain patch oder `{ patch: ... }` wird akzeptiert
  - nur vorhandene `upsert`/`delete`/`jsonMerge`/`explanation` werden uebernommen
  - ohne Operationen bleibt der bestehende Fehlervertrag erhalten.

### 2) `lib/appInfoBackup.ts`

- Weiche Objektzugriffe auf Backup-Importdaten wurden auf kleine Narrowing-Helfer gezogen:
  - `asRecord(...)`, `getString(...)`, `getNumber(...)`, `getBoolean(...)`
  - `isProvider(...)`, `normalizeQualityMode(...)`
- `validateApiBackupJson(...)` liest `config`/`apiKeys` ohne `as any`.
- `validateApiBackupJson(...)` baut das Rueckgabeobjekt explizit neu auf (inkl. optionaler `exportDate`/`appVersion`), statt blind zu casten.
- `sanitizeAiConfigFromBackup(...)` liest `apiKeys`, Provider, Mode, `qualityMode`, `agentEnabled` ueber echte Narrowing-Grenzen.
- Fallback-Semantik bleibt bewusst stabil:
  - fremde Provider fallen auf `fallback` zurueck
  - ungueltige mode-/boolean-Felder bleiben beim `fallback`
  - Legacy-Quality-Werte `fast`/`best` mappen weiterhin auf `speed`/`quality`.

## Tests / Regressionen

- `__tests__/ciLiteStatus.test.ts`
  - bestehender Stabilitaetsfall fuer unvollstaendige Run-Payloads bei `findWorkflowRunByJobId(...)` bleibt gruen.
- `__tests__/ciLiteArtifactParsing.test.ts`
  - neuer Fall fuer Legacy-Top-Level-Fallback bei invalidem `patch`-Wrapper plus fail-safe Fehlerverhalten bei invaliden Operationen.
- `__tests__/appInfoBackupPrivacy.test.ts`
  - neue Regression fuer Legacy-`selectedAutofixProvider` + ungueltige `config`/`apiKeys`-Payloads bei stabilen Provider-/Quality-Fallbacks.

## Checks

Ausgefuehrt:

- `npm run typecheck`
- `npm run lint:ci`
- `npm run test:silent -- --runInBand __tests__/ciLiteStatus.test.ts __tests__/ciLiteArtifactParsing.test.ts __tests__/appInfoBackupPrivacy.test.ts`
- `git diff --check`
- `bash scripts/check_patch_docs_sync.sh`

## Restpunkte (bewusst unveraendert)

- Kein Broad Refactor der CI-Lite-Flow-Hooks.
- Kein Schema-Framework fuer Backup-Import eingefuehrt.
- Weitere Typ-Schuld ausserhalb der zwei Hotspots bleibt fuer spaetere kleine Patches offen.
