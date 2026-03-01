# 08 — Test Coverage Matrix (Build Readiness / Diagnostics)

## Coverage Matrix (Ist vs Gap)

| Item/Invariante | Vorhandene Tests | Status | Fehlt | Prio |
|---|---|---|---|---|
| Repo valid + Branch gesetzt | `__tests__/invariants.selection.test.ts` | Teilweise | kein funktionaler Service-Gate-Test | High |
| Profil nur dev/preview/prod | `lib/__tests__/buildStartService.integration.test.ts` | Teilweise | negativer invalid-profile Test | High |
| Tokens Pflicht | `__tests__/oneClickDeploy.test.tsx` | Teilweise | hard-fail im Service vor network calls | High |
| Diagnostics grün Pflicht | indirekt | Gering | expliziter Gate-Test fehlt | High |
| Signing je Profil | `__tests__/oneClickDeploy.test.tsx` | Gut (UI) | service assertion fehlt | Medium |
| Workflow/Secrets Readiness | keine dedizierten ciAutoFix unit tests | Gering | create/update/no-op + missing secrets tests | High |
| EAS profiles/APK policy | keine dedizierten pipeline-check tests | Gering | Check-ID/Status-Regression ungeschützt | High |
| EAS projectId source precedence | keine dedizierten Tests | Gering | source fallback chain ungetestet | Medium |
| Security checks (leak/forbidden/yaml) | keine dedizierten Tests | Gering | hohe Regression-Gefahr | High |

## Neue Tests (18, nur High/Med)

### High (12)
1. `startBuildJob` fail ohne `linkedBranch` (keine externen Calls).
2. `startBuildJob` fail bei invalid repo.
3. `startBuildJob` fail bei invalid profile.
4. `runBuildPipelineDiagnostics` liefert stabile Kern-IDs.
5. `repo.secret.expoToken` = fail wenn Secret fehlt.
6. `repo.easProjectId` source precedence (`eas-project.json` > `app.json` > `app.config`).
7. `workflow-yaml-name-colon-quoting` erkennt + fixt.
8. `security-workflow-service-role-key` fail bei hardcoded key.
9. `security-forbidden-files` fail bei `.jks`/private key marker.
10. `autoFixCIWorkflows` erstellt fehlende Pflicht-Workflows.
11. `autoFixCIWorkflows` no-op bei identischen Dateien.
12. `checkRepoSecrets` required/present/missing korrekt.

### Medium (6)
13. `eas-withoutcredentials-debug` patcht nur fehlende profile.
14. `eas-profiles` failt bei AAB und bietet APK-fix.
15. `quality-scripts` meldet/patched fehlende deps.
16. `useDiagnosticFixRunner.shouldSyncPatch` synct nur relevante Dateien.
17. `runPipelineChecks` status/severity mapping korrekt.
18. `buildBlockedReason` Prioritätsreihenfolge stabil.

## Bonus: 8 Invariant String Tests
1. Kein `|| "main"` im kritischen Buildstartpfad.
2. Keine stillen branch-hardcodes in Diagnostic-CI-Autofix-Pfad.
3. `useDiagnosticFixRunner` nutzt SoT-branch statt hardcode.
4. `repo.secret.expoToken` Check-ID stabil.
5. `workflow-yaml-name-colon-quoting` Check-ID stabil.
6. `security-forbidden-files` Check-ID stabil.
7. `REQUIRED_SECRETS` enthält `EXPO_TOKEN`.
8. `.github/workflows/eas-build.yml` validiert prod supabase secrets.

## Priorisierte Ausführung
1. String- und Unit-Guards (schnell).  
2. Pipeline-Diagnostics + ciAutoFix fixtures.  
3. Integration-ish Service/UI Gate-Tests.
