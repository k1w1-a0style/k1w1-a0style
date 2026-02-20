# Patch 223 — CI Lite Status persistieren + Build Checklist

Stand: **2026-02-20**

## Ziel

- **CI Lite** (Header-Button: ESLint + TypeScript) soll nach einem erfolgreichen Run **persistent** bleiben.
- **EnhancedBuildScreen** soll den CI Lite Status als Checklist-Item anzeigen (non-blocking), damit man sofort sieht ob TS/Lint zuletzt grün war.

## Änderungen

- `components/CiLiteHeaderButton.tsx`
  - Persistiert nach `workflowRun.status === "completed"` die CI Lite Ergebnisse in AsyncStorage:
    - `CI_LITE_LINT_OK`, `CI_LITE_TYPECHECK_OK`, `CI_LITE_LAST_RUN_AT`
- `lib/storageKeys.ts`
  - Neue zentrale Keys für CI Lite (SoT)
- `screens/EnhancedBuildScreen/hooks/useBuildPreconditions.ts`
  - Lädt CI Lite Status aus AsyncStorage und exposed `hasCiLiteOk`
- `screens/EnhancedBuildScreen/hooks/useEnhancedBuildScreen.ts`
  - Checklist Item: **"CI Lite gruen (TS + ESLint)"**

## Patch anwenden

```bash
# 1) ZIP entpacken
unzip -o k1w1-a0style_patch_223.zip -d .

# 2) ZIP löschen
rm -f k1w1-a0style_patch_223.zip

# 3) Checks
npm run typecheck
npm run lint:ci
npm run test:silent

# 4) Commit + Push
git add -A
git commit -m "Patch 223: persist CI Lite status + show in Build checklist"
git push
```

## Akzeptanz

- Nach einem erfolgreichen CI Lite Run bleibt der Status nach App-Restart erhalten.
- EnhancedBuildScreen zeigt CI Lite als Checklist-Item (non-blocking) und verweist auf den Header-Button.
