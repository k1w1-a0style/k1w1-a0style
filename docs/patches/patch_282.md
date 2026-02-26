# Patch 282: Blueprint docs + branch selection invariant (no silent main fallback)

## Was ist neu
- Neue Doku **`docs/APP_BLUEPRINT.md`** als "Single Source of Truth" (worum geht’s, wichtigste Regeln, Haupt-Flows).
- Neue Arbeitsliste **`docs/SCREEN_BY_SCREEN_CHECKLIST.md`** für den Screen-für-Screen Abgleich.
- Build-Screen blockt jetzt, wenn **kein Branch** gewählt ist (statt still `main` zu nehmen).
- Neuer "YES-Test" (Invariants): verhindert, dass der Build Screen wieder `main` hardcodet.

## Dateien
- `screens/EnhancedBuildScreen/hooks/useEnhancedBuildScreen.ts`
- `__tests__/invariants.selection.test.ts`
- `docs/APP_BLUEPRINT.md`
- `docs/SCREEN_BY_SCREEN_CHECKLIST.md`

## Warum
Die App lebt davon, dass **Repo/Branch/Workflow aus der In-App Auswahl** kommen. Ein stiller Default wie `main` sorgt sonst für schwer zu debuggende Fehler.
