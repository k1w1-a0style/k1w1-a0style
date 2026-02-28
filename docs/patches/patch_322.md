# Patch 322: contexts/types Shim-Migration (ProjectContext Start)

## Ziel

Einen weiteren Punkt aus der offenen Fix-Liste abarbeiten: schrittweise Migration weg vom `contexts/types.ts` Compatibility-Shim.

## Änderungen

- `contexts/ProjectContext.tsx`
  - `AutoFixRequest` und `LastPreviewMeta` werden nicht mehr aus `./types`, sondern direkt aus `shared/types/project` importiert.
  - `ProjectContextProps` bleibt aus `./types` importiert (Interface lebt dort weiterhin).

- `contexts/ProjectContext.types.ts`
  - Gleiches Import-Alignment wie in `ProjectContext.tsx`: Projekt-Domain-Typen kommen direkt aus `shared/types/project` statt aus dem Shim-Reexport.

- `docs/PROJECT_TODO.md`
  - Unter „TypeScript-Hygiene" einen erledigten Zwischenstand ergänzt, damit der Fortschritt der Shim-Migration transparent bleibt.

- `docs/patches/PATCHLOG_ROOT.md`
  - Root-Patchlog um Patch 322 ergänzt.

- `PROJECT_CHECKLOG.md`
  - Patch 322 eingetragen.

## Ergebnis

- Ein konkreter Teilpfad der Shim-Migration ist abgeschlossen, ohne Verhaltensänderung.
- Die noch offene vollständige Entfernung von `contexts/types.ts` bleibt als Folgearbeit sichtbar.
