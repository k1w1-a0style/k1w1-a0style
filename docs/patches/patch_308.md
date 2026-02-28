# Patch 308 — TODO/Backlog Status-Sync (Connections + Persistenz + Logger)

## Ziel
Offene Punkte aus `docs/TODO.md` gegen den aktuellen Implementierungsstand prüfen und erledigte Punkte sauber abhaken.

## Verifiziert und auf ✅ gesetzt

### Patch 217 — Connection Screen SoT
- E1 (EAS Link Workflow SoT):
  - Confirm-Dialog bei fehlender EAS Project ID
  - Start von `eas-link.yml` ohne `eas_project_id` bei „OK"
  - Persistentes EAS-Status-Lämpchen über `STORAGE_KEYS.CONN_EAS_OK`
- E2 (Persistente Lampen):
  - Persistenz über `lib/storageKeys.ts` und Laden/Schreiben in `useConnectionsScreen`
- E3 (GitHub Username + Scopes):
  - Username Persistenz/Anzeige (`CONN_GITHUB_USER`)
  - Scopes aus `x-oauth-scopes` Persistenz/Anzeige (`CONN_GITHUB_SCOPES`)

### Patch 226 — Cleanup
- Logger sweep in GitHub/Storage Hooks als erledigt markiert (kein verbleibender `console.*`-Einsatz in den Ziel-Hooks).

## Doku-Sync
- `README.md` Patch-Stand auf Patch 308 aktualisiert.
- `docs/patches/PATCHLOG_ROOT.md` und `PROJECT_CHECKLOG.md` ergänzt.

## Checks
```bash
npm run typecheck
npm run lint:ci
npm run test:silent
```
