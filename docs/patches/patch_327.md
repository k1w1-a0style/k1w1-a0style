# Patch 327: ProjectContext TS-Hardening (error handling ohne `any`)

## Ziel
Nächsten Fix-Listenpunkt aus der TypeScript-Hygiene abarbeiten: verbleibende `catch (error: any)`-Stellen in `ProjectContext` auf `unknown` umstellen und Fehlertexte sicher extrahieren.

## Änderungen

### 1) Lokaler Error-Helper ergänzt
- `contexts/ProjectContext.tsx`: `getErrorMessage(error, fallback)` ergänzt.
- Verhalten:
  - nutzt `error.message`, wenn `Error`
  - nutzt String-Fehler, wenn vorhanden
  - fällt sonst auf den übergebenen Fallback zurück

### 2) `any` in Catch-Pfaden entfernt
Folgende Catch-Blöcke wurden von `any` auf `unknown` umgestellt und auf den Helper migriert:
- `createNewProject`
- `exportProjectAsZip`
- `exportTextFilesAsZip`
- `importProjectFromZip`
- `startBuild`

### 3) TODO/Checklog/Patchlog synchronisiert
- `docs/PROJECT_TODO.md`: Restpunkt zu `: any`-Annotationen fortgeschrieben (382 → 377).
- `PROJECT_CHECKLOG.md`: Patch-327 Eintrag ergänzt.
- `docs/patches/PATCHLOG_ROOT.md`: Patch-327 Eintrag ergänzt.

## Validierung

```bash
npm run typecheck
npm run lint:ci
npm run test:silent
```

Alle drei Checks sind grün.
