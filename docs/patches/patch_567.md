# Patch 567 — Risiko-`any` an zwei Netzwerk-/Action-Grenzen reduziert

## Ziel
In einem kleinen, mergefreundlichen Schritt die riskantesten `any`-Vertraege an zwei Hotspots reduzieren, ohne Funktionsumbau:

1. `screens/GitHubReposScreen/hooks/useGitHubReposScreen.ts`
2. `components/CiLiteHeaderButton/hooks/useCiLiteWorkflow.ts`

## Umsetzung

### 1) GitHubReposScreen-Hook: Fehlerpfade von `any` auf `unknown` + Guard gezogen
- Lokale Hilfsfunktion `getErrorMessage(error: unknown, fallback?: string)` eingefuehrt.
- Alle bisherigen `catch (e: any)` in den zentralen Repo-/Branch-/Pull-/Push-/EAS-Link-/Secrets-Action-Pfaden auf `catch (e: unknown)` umgestellt.
- UI-Fehlertexte (`Alert.alert(...)`, `setTokenError(...)`) lesen Fehlerdetails nur noch ueber den getypten Guard statt direkter `any`-Property-Zugriffe.

### 2) CI-Lite-Workflow-Hook: Run-Lookup-/Dispatch-Fehlervertraege gehaertet
- Lokale Hilfsfunktion `getErrorMessage(error: unknown, fallback?: string)` eingefuehrt.
- Die drei relevanten `catch (e: any)` im Chain-Lookup, Workflow-Lookup und Dispatch-Outer-Catch auf `unknown` + Guard umgestellt.
- Bestehendes Laufzeitverhalten bleibt erhalten (`message` falls vorhanden, sonst String-Fallback), aber ohne `any`-Bypass an den Fehlergrenzen.

## Runtime-Verhalten / Risiko
- Kein beabsichtigter API-/State-/Flow-Vertragswechsel.
- Kein Broad-Refactor, keine Dependency-Aenderung.
- Nur defensive Typ-Haertung an bestehenden Fehler- und Statusgrenzen.

## Validierung
- `npm run typecheck`
- `npm run lint:ci`
- `npm run test:silent -- --runInBand __tests__/githubReposScreen.easLinkStatusRace.test.tsx`
- `npm run test:silent -- --runInBand __tests__/useCiLiteWorkflow.behavior.test.tsx`
- `git diff --check`
- `bash scripts/check_patch_docs_sync.sh`
