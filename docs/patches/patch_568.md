# Patch 568 – Typ-/Fehlervertrags-Haertung in GitHub-Files + Diagnostic-Fix-Runner

Datum: 2026-03-28  
Branch: `codex`

## Ziel

Kleiner, gezielter Sicherheits-/Typvertragsschritt in zwei Hotspots:

1. `infra/github/files.ts` (GitHub API/I-O Grenze)  
2. `screens/DiagnosticScreen/hooks/useDiagnosticFixRunner.ts` (Runner-Status-/Error-Grenzen)

Kein Broad Refactor, kein Flow-Umbau, kein Dependency-Update.

## Umgesetzte Aenderungen

### 1) `infra/github/files.ts`

- Kleine, explizite Response-Typen fuer riskante GitHub-API-Payloads eingefuehrt:
  - Message-/Fehlerpayload
  - Contents-File-Payload
  - Branch-/Commit-/Tree-Payloads
- Unsichere JSON-Grenzen auf `unknown`-sichere Helfer gezogen:
  - `readJsonSafe(...)`
  - `pickGitHubMessage(...)`
  - `isObjectRecord(...)`
- `createOrUpdateFile(...)` und `deleteRepoFile(...)` verwenden keine losen `any`-Payloads mehr fuer API-Responses/Fehlermeldungen.
- `pushFilesToRepoAdvanced(...)` liest Branch-/Commit-/Tree-/Ref-Responses ueber klare kleine Typen statt `any`.
- `listRepoBlobEntries(...)` nutzt getypte Tree-Entries und fail-safe Fallbacks ohne `any`-Kette.
- Catch-Pfade auf `unknown` gehaertet; Hash-Fehler im Vergleichspfad werden defensiv geloggt, Verhalten bleibt unveraendert.
- `getRepoFileText(...)` liest Contents-Response ueber getypten Safe-Parse und validiert weiter fail-safe auf `base64` + `content`.

### 2) `useDiagnosticFixRunner.ts`

- Lokale, kleine Error-Guards fuer unbekannte Fehlerobjekte eingefuehrt:
  - `getErrorMessage(...)`
  - `getFixRuntimeMeta(...)` (`partial`/`localChangeApplied`)
  - `isRecord(...)`
- Riskante `catch (e: any)`-Stellen an zentralen Runner-Step-Grenzen auf `unknown` umgestellt:
  - `applyIssueFix(...)` Step-Runner (apply/dispatch/sync/rerun)
  - Batch-Runner (`applyFixList`)
  - Single-Runner (`applySingle`)
- UI-/Toast-Semantik bleibt erhalten: gleiche Statuslogik, gleiche Failure-Klassen, aber ohne unsichere Property-Zugriffe auf unbekannte Error-Objekte.

## Tests / Regressionen

Gezielt ergaenzt (keine Testflut):

- `__tests__/githubFiles.contracts.test.ts`
  - fail-safe Verhalten bei unvollstaendiger GitHub-Contents-Response (`getRepoFileText`)
  - Fallback-Fehlermeldung bei fehlendem `message`-Feld in GitHub-Errorpayload (`createOrUpdateFile`)
- `__tests__/useDiagnosticFixRunner.fixSemantics.test.tsx`
  - unbekanntes geworfenes Fehlerobjekt wird fail-safe behandelt (keine unsicheren Property-Zugriffe), inklusive stabiler Teilfehler-Semantik

## Checks

Ausgefuehrt:

- `npm run typecheck`
- `npm run lint:ci`
- `npm run test:silent -- --runInBand __tests__/githubFiles.contracts.test.ts`
- `npm run test:silent -- --runInBand __tests__/useDiagnosticFixRunner.fixSemantics.test.tsx`
- `git diff --check`
- `bash scripts/check_patch_docs_sync.sh`

## Restpunkte (bewusst unveraendert)

- Kein Umbau der GitHub-Abstraktionsschicht als Ganzes.
- Kein kompletter Hook-Refactor von `useDiagnosticFixRunner`.
- Weitere `any`-Altlasten ausserhalb der zwei Hotspots bleiben fuer spaetere kleine Patches.
