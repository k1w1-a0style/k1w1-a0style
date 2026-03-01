# Patch 326: contexts/types Shim final removal

## Ziel
Offenen Fix-Listenpunkt abschließen: verbleibenden Compatibility-Shim `contexts/types.ts` entfernen und den context-lokalen Typ `ProjectContextProps` in eine dedizierte Datei auslagern.

## Änderungen

### 1) Neue dedizierte Typdatei
- `contexts/projectTypes.ts` neu angelegt.
- Enthält `ProjectContextProps` als einzigen Context-API-Typ.
- Verwendet direkte Type-Imports aus `shared/types/*` (kein Shim).

### 2) Importe umgestellt
- `contexts/ProjectContext.tsx` importiert `ProjectContextProps` jetzt aus `./projectTypes`.

### 3) Legacy-Shims entfernt
- `contexts/types.ts` gelöscht.
- `contexts/ProjectContext.types.ts` gelöscht (war eine versehentlich verbliebene Duplikat-Datei mit ungenutztem Importblock).

### 4) Doku-Alignment
- `docs/PROJECT_TODO.md` aktualisiert (Shim-Migration als erledigt markiert).
- `docs/HANDOFF_NEXT_CHAT.md` aktualisiert (Punkt als abgeschlossen markiert).
- `PROJECT_CHECKLOG.md` ergänzt.
- `docs/patches/PATCHLOG_ROOT.md` ergänzt.

## Validierung

```bash
npm run typecheck
npm run lint:ci
npm run test:silent
```

Alle drei Checks liefen nach der Änderung erfolgreich durch.
