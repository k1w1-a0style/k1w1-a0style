# Patch 488 — Gemeinsame Secret-/EAS-/Readiness-Semantik gegen Cross-Screen-Drift vereinheitlicht

## Was wurde geändert?

- `lib/status/verificationContract.ts`: kleiner gemeinsamer Status-Contract ergänzt. Er unterscheidet jetzt zentral zwischen `verified`, `missing`, `unknown`, `auth_error` und `stale` sowie zwischen hart fehlend vs. unsicher/nicht verifizierbar.
- `screens/ConnectionsScreen/hooks/useConnectionsScreen.ts` + `screens/ConnectionsScreen/components/StatusCard.tsx`: EAS-Status speichert/verwendet jetzt den normalisierten Contract statt nur eines Bool-Lichts. Auth-/Permission-/Unklar-/Stale-Fälle werden im StatusCard ehrlich als `ZUGRIFF`, `UNKLAR` oder `ALT` kommuniziert und nicht mehr implizit wie „fehlt“ behandelt.
- `screens/EnhancedBuildScreen/hooks/buildReadinessState.ts` + `useBuildPreconditions.ts` + `useEnhancedBuildScreen.ts` + `useOneClickDeploy.ts`: Diagnostic-/CI-Lite-Readiness wird jetzt ebenfalls über denselben Contract beschrieben. Unsichere oder stale Zustände blocken Builds weiterhin konservativ, erscheinen im UI aber als pending/unsicher statt als harter Missing-/Fail-Pfad.
- `lib/diagnostics/buildPipelineDiagnostics.ts`: Repo-Secret-Prüfungen unterscheiden jetzt sauber zwischen wirklich fehlenden Secrets und Auth-/Permission-/Unklar-Fällen beim Secret-Listing. Fix-Hints schlagen bei 401/403/unklaren Fehlern keine falschen Missing-Reparaturen mehr vor.
- Gezielt ergänzt/angepasst: `__tests__/verificationContractSemantics.test.ts`, `__tests__/connectionsScreen.statusCardSemantics.test.tsx`, `__tests__/connectionsScreen.easStatusSemantics.test.ts`, `__tests__/buildReadinessState.test.ts`, `__tests__/pipelineDiagnostics.secretContractSemantics.test.ts`.

## Kritische Einordnung

- Kein Broad Refactor und keine neue Status-Architektur: nur eine kleine gemeinsame Semantik-Quelle plus enge Anpassungen in Connections, Build-Readiness und Diagnostics.
- Bereits gemergte Busy-Guard-, Repo/Branch-SoT-, CI-Lite- und AI-Flow-Fixes bleiben unberührt.
- Builds bleiben bewusst konservativ geblockt, wenn Diagnose/CI-Lite nicht sicher bestätigt sind; geändert wurde die Wahrheitsdarstellung, nicht die Sicherheitsgrenze.

## Verifikation

- `npm run typecheck`
- `npm run lint:ci`
- `npm run test:silent -- --runInBand __tests__/verificationContractSemantics.test.ts __tests__/connectionsScreen.easStatusSemantics.test.ts __tests__/connectionsScreen.statusCardSemantics.test.tsx __tests__/buildReadinessState.test.ts __tests__/pipelineDiagnostics.secretContractSemantics.test.ts`
- `npm run test:silent`
