# Patch 531 — Runtime-Dependency-Autofix ueber vorhandene npm-Lockfiles erweitern

## Ziel
Der Diagnose-Screen soll bei Runtime-Importen gegen `package.json` nicht nur wenige hart verdrahtete Expo-Pakete auto-fixen koennen, sondern auch bereits lokal aufgeloeste Paketversionen aus `package-lock.json` bzw. `npm-shrinkwrap.json` sicher wiederverwenden.

## Analyse
- Bisher war der Auto-Fix fuer `runtime-import-dependency-mismatches` absichtlich sehr konservativ:
  - Pakete aus `devDependencies` konnten uebernommen werden.
  - einige explizit bekannte Expo-SDK-54-Pakete hatten feste Safe-Mappings.
- Wenn ein Runtime-Paket zwar schon im Lockfile aufgeloest war, aber weder in `dependencies` noch in `devDependencies` stand, fiel der Check trotzdem auf „nur KI-/manuell“ zurueck.
- Das fuehrte bei realen Projekten zu neuen Diagnose-Fehlern ohne sichtbaren lokalen Auto-Fix, obwohl bereits eine exakte, repo-eigene Version vorlag.

## Änderungen
- `lib/diagnostics/checks/runtimeDependencies.ts`
  - liest jetzt zusaetzlich `package-lock.json` und `npm-shrinkwrap.json`,
  - extrahiert bevorzugt die exakte bereits aufgeloeste Version fuer ein fehlendes Runtime-Paket,
  - nutzt diese Lockfile-Version als sicheren Auto-Fix, bevor auf die kleinen Expo-SDK-Mappings zurueckgefallen wird,
  - kommuniziert manual-only Faelle ehrlicher als „Kein sicherer AutoFix“ statt nur als allgemeiner Install-Hinweis.
- `__tests__/preflight.runtimeImportDependencies.test.ts`
  - neue Regression: ein fehlendes Runtime-Paket mit vorhandener `package-lock.json`-Version wird auto-fixbar und korrekt in `package.json` eingetragen.

## Wirkung
- Der Diagnose-Screen bietet jetzt deutlich haeufiger einen echten lokalen Auto-Fix fuer Runtime-Dependency-Probleme an, wenn die Version im Repo bereits eindeutig durch npm-Lockfiles belegt ist.
- Unsichere Faelle ohne belastbare Versionsquelle bleiben bewusst weiter manuell/KI-gestuetzt.

## Tests
- `npm run test:silent -- --runInBand __tests__/preflight.runtimeImportDependencies.test.ts`
- `npm run typecheck`
- `npm run lint:ci`
- `npm run test:silent`
