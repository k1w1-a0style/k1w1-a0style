# 04 — Testing Smoke Plan (Build Readiness + Diagnostics)

## Ziel
Schnelle, reproduzierbare Smoke-Ausführung für Build-Startbarkeit nach Diagnostics/Fixes.

## Smoke-Matrix (minimal, verbindlich)

| Smoke-Case | Fokus | Erwartung |
|---|---|---|
| S1: Readiness-Gate Blocker | Repo/Branch/Profile/Tokens/Diagnostics/Signing | Build startet **nicht**, klarer Blockertext |
| S2: Diagnostics Full Run | Local + Pipeline Checks | Alle Checks laufen, IDs/Status stabil |
| S3: AutoFix Batch + Re-Run | Fixbare Issues anwenden | Issue-Status verbessert sich, keine neuen Criticals |
| S4: CI Workflow Readiness | Pflicht-Workflows + Secrets | Fehlende Workflows/Secrets werden klar als Fix/Manual ausgewiesen |
| S5: Profile-Switch | development/preview/production | Profilabhängige Checks reagieren korrekt |

## Smoke-Kommandos

```bash
npm run typecheck
npm run lint:ci
npm run test:silent
```

## Priorisierte Smoke-Tests (aus Matrix 08)

### High
1. Build-Service blockiert ohne Branch (kein stiller `main` fallback).
2. Build-Service blockiert bei ungültigem Repo/Profile.
3. Pipeline-Diagnostics liefert stabile Kern-IDs (`repo.easProfile.*`, `repo.secret.expoToken`, `repo.easProjectId`).
4. Workflow-Security-Checks schlagen bei Leak/YAML-Falle korrekt an.
5. `autoFixCIWorkflows` (create/update/no-op) branch-sicher.

### Medium
1. `eas-withoutcredentials-debug` erzeugt zielgenauen Fix-Patch.
2. `eas-profiles` failt bei AAB und bietet APK-Fix.
3. `quality-scripts` meldet fehlende deps korrekt.
4. Status-Mapping in `runPipelineChecks` bleibt konsistent.

## Invariant-String-Smoke (schnell, regressionssicher)
- Kein harter `|| "main"`-Fallback im kritischen Buildstartpfad.
- Check-IDs für kritische Security/Readiness-Checks bleiben unverändert.
- `REQUIRED_SECRETS` enthält mindestens `EXPO_TOKEN`.
- Production-Workflow validiert `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`.

## Exit-Kriterien
- Typecheck/Lint/Tests grün.
- Für jeden verbleibenden Diagnostic-Fail ist „AutoFix“ **oder** „Manual Steps“ eindeutig dokumentiert.
- Buildflow ist mit explizit ausgewähltem Repo/Branch/Profile startbar.

