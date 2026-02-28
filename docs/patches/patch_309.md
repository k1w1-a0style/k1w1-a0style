# Patch 309 — TODO/Backlog-Doku synchronisieren (Patch 217/SoT)

## Ziel
Dokumentationsstand an den implementierten Code angleichen, damit offene Aufgabenliste verlässlich bleibt.

## Änderungen

### 1) `docs/TODO.md`
- Patch-217 Unterpunkte E1–E3 (Connections SoT) auf erledigt gesetzt.
- Hintergrund: EAS-Link Confirm-Flow, persistente Connection-Lampen und GitHub User/Scopes Persistenz sind im Code vorhanden.

### 2) `docs/PROJECT_TODO.md`
- Historische Patch-A/B/C/D-Items auf erledigt gesetzt (stale Einträge bereinigt).
- Abschnitt `Patch 217 (pending)` auf `Patch 217 (done)` aktualisiert.
- Nur der optionale Performance-Nachlauf in `useBuildStatus` bleibt als optional offen.

### 3) Patchlog/Checklog
- `docs/patches/PATCHLOG_ROOT.md` um Patch 309 ergänzt.
- `PROJECT_CHECKLOG.md` um Patch-309-Dokutask ergänzt.

## Checks
```bash
npm run typecheck
npm run lint:ci
npm run test:silent
```
