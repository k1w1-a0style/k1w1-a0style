# Patch 421

## Summary

Minimale Traceability-Härtung für gestartete Builds:

- Effektiv verwendete Build-Werte (`repo`, `branch`, `buildProfile`) werden beim Start und im laufenden Statusfluss konsistent in `currentBuild` und Build-Historie weitergetragen.
- Build-Status-Karte zeigt explizit die effektiv verwendeten Werte (Repo/Branch/Profil) statt nur Job/Status.
- Build-Historie zeigt `branch` + `sourceCommitSha` und exportiert diese Felder ebenfalls in CSV.
- Invariant-Tests schützen gegen Regressionen in Transparenz/Weitergabe.

## Included

- `shared/types/build.ts`
- `contexts/projectTypes.ts`
- `contexts/ProjectContext.tsx`
- `screens/EnhancedBuildScreen/components/BuildStatusSection.tsx`
- `screens/EnhancedBuildScreen/components/BuildHistorySection.tsx`
- `__tests__/buildTraceability.transparency.invariants.test.ts`
- `docs/patches/patch_421.md`
- `docs/patches/PATCHLOG_ROOT.md`
- `PROJECT_CHECKLOG.md`

## Notes

- Keine neue Source-of-Truth eingeführt.
- Keine Build-Start-Architektur geändert; nur bestehende Flüsse transparenter und konsistenter gemacht.
