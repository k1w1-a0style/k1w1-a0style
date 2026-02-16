# Patch 146: CI Lite TypeScript Hotfix (fehlende Style Keys)

## Problem
Patch 145 hat das CI Lite UI umgebaut. Dabei wurden ein paar `StyleSheet`-Keys umbenannt,
aber einige Render-Blöcke referenzierten noch die alten Namen.

Dadurch brach `npm run typecheck` mit Fehlern wie `Property 'stepPill' does not exist ...` ab.

## Fix
- `components/CiLiteHeaderButton.tsx`
  - fehlende Style-Keys als **Compat/Alias-Styles** ergänzt
  - keine UI/Logic Änderung, nur TS-Fix

## Dateien geändert
- `components/CiLiteHeaderButton.tsx`
- `docs/patches/PATCHLOG_ROOT.md`
- `docs/patches/patch_146.md`
- `PROJECT_CHECKLOG.md`

## Test
```bash
npm run typecheck
npm run lint:ci
npm run test:silent
```
