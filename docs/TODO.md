# TODO / Offene Punkte

> Stand: 2026-02-09

Dieses Dokument ist die **einzige Quelle der Wahrheit** für offene Punkte.
Wenn etwas erledigt ist: abhaken und in "Erledigt" verschieben oder löschen.


## P0 – Muss stabil sein

### CodeScreen
- [ ] **WebView-Editor**: End-to-end auf echten Geräten testen (Android + iOS), inkl. Fokus/Keyboard/Scroll.
- [ ] **Große Dateien**: Grenze/Warning definieren (z.B. >2k Zeilen) + "read-only" Fallback oder Split-View.
- [ ] **TXT Export**: Regression-Test (mind. 1 Integrationstest: exportiert, schreibt Datei, Sharing verfügbar/nicht verfügbar).

### Expo / EAS projectId
- [ ] Verifizieren, dass `extra.eas.projectId` wirklich in `npx expo config --json` auftaucht.
  - Workaround: CI soll `node scripts/getEasProjectId.js` als Source of Truth nutzen.

## P1 – Qualität / Performance

### ChatScreen (aus SONET-Auswertung)
- [ ] Rendering-Performance: lange Chats / viele Tokens → Virtualisierung / Memoization prüfen.
- [ ] Async/Side-Effects: zentrale Fehlerbehandlung + Abort/Cancel bei Screen-Wechsel.
- [ ] State-Entkopplung: große Hooks/Handler in kleinere Hooks trennen.

### PreviewScreens (aus SONET-Auswertung)
- [ ] Security/Privacy: klare Warnung, wenn ein Preview öffentlich ist (CodeSandbox) + UI "safe defaults".
- [ ] Payload-Limits: harte max Files / max Bytes enforce (Client + Server) + klare Fehlermeldung.
- [ ] Observability: debug meta (nur minimal) + bessere Log-Anzeige.

### ReposScreen (aus SONET-Auswertung)
- [ ] Caching/Pagination: Repo-Liste paginieren + Cache invalidation sauber.
- [ ] Token/Secrets: keine Logs mit Credentials; Redaction check.
- [ ] Race conditions: Pull-to-refresh + parallel fetches dedupen.

## P2 – Doku / Aufräumen

- [ ] **Docs-Struktur**: alle langen Notizen nach `docs/` verschieben; Root clean halten.
- [ ] Temporäre Patch-Hilfsdateien nicht committen; ggf. `.gitignore` erweitern.
- [ ] README aktualisieren: Links zu `docs/INDEX.md` + Patch-Workflow.
