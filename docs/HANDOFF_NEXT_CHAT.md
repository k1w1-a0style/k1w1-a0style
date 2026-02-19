# Next-Chat Handoff

Stand: **2026-02-19** (Europe/Berlin)

## Repo
- https://github.com/k1w1-a0style/k1w1-a0style
- Branch: `work`

## Letzter Patch
**Patch 200 — PR-9 Stage 1: Preview Screens Refactoring**

## Aktueller Status

### ✅ Gerade fertig: Preview Screens (Patch 200)
- `PreviewScreen` und `PreviewFullscreenScreen` sind jetzt modular aufgebaut
- Logik in eigene Hooks extrahiert (`usePreviewScreen`, `usePreviewFullscreen`)
- Gemeinsame WebView-Logik in `screens/shared/preview/`:
  - `useWebViewNavigation` — baseOrigin, originWhitelist, handleShouldStartLoad
  - `useWebViewCrashRecovery` — One-Shot Crash Recovery
  - `webViewTypes.ts` — lokale Event-Typen (kein `any`)
- **Bug gefixt:** `if (!mode)` Guard in PreviewFullscreenScreen war strukturell kaputt (dead code nach return)
- Dead Code gelöscht: `styles/previewScreenStyles.ts`, `lib/previewSettings.ts`
- Flat-Shims (`screens/PreviewScreen.tsx`, `screens/PreviewFullscreenScreen.tsx`) bleiben als 1-Zeiler Re-exports → `App.tsx` unverändert

## Offene Punkte (Priorität)

### Sofort machbar (kleine Patches)
1. **logger.ts aktivieren** — existiert seit Patch ~199 aber hat 0 Imports. `console.log` in ProjectContext (13x), projectPersistence (10x), buildHistoryStorage (7x) → `logger.log` migrieren. Dann ESLint `no-console` warn aktivieren.
2. **apiKeyMasking konsolidieren** — `lib/apiKeyMasking.ts` und `screens/SettingsScreen/utils/keyMasking.ts` haben unterschiedliche Implementierungen. SettingsScreen-Version hat `looksLikeApiKey` Helper → in lib übernehmen, SettingsScreen re-exportiert.
3. **contexts/types.ts Shim-Migration** — 36 Imports zeigen noch auf den Shim. Schrittweise auf `shared/types/*` umstellen, dann Shim löschen.

### Mittelfristig
4. **PR-9 Stage 2** — PreviewScreen Komponente weiter splitten: `DeviceFrame.tsx`, `PreviewToolbar.tsx`, `PreviewStatusBar.tsx` (optional, Screen ist jetzt schon lesbar)
5. **any-Annotationen** — 382 Stück. Start mit `lib/orchestrator.ts` (größter Offender)

## Patch-Workflow
```bash
unzip -o <PATCH>.zip -d .
rm -f <PATCH>.zip

npm run typecheck
npm run lint:ci
npm run test:silent

git add -A
git commit -m "Patch XXX: <message>"
git push
```

## Projekt-Struktur (Stand Patch 200)
```
screens/
  PreviewScreen/                 ← NEU (Patch 200)
    PreviewScreen.tsx
    hooks/usePreviewScreen.ts
    index.tsx
  PreviewScreen.tsx              ← 1-Zeiler Shim → PreviewScreen/index
  PreviewFullscreenScreen/       ← NEU (Patch 200)
    PreviewFullscreenScreen.tsx
    hooks/usePreviewFullscreen.ts
    index.tsx
  PreviewFullscreenScreen.tsx    ← 1-Zeiler Shim → PreviewFullscreenScreen/index
  shared/preview/                ← NEU (Patch 200)
    useWebViewNavigation.ts
    useWebViewCrashRecovery.ts
    webViewTypes.ts
  [alle anderen Screens bereits in Folder-Struktur mit hooks/ + components/]
lib/
  logger.ts                      ← vorhanden, aber noch nicht genutzt
  apiKeyMasking.ts               ← TODO: mit SettingsScreen/utils/keyMasking.ts konsolidieren
contexts/
  types.ts                       ← Compatibility Shim (deprecated), 36 Imports noch aktiv
shared/types/
  build.ts                       ← Single source of truth für Build-Typen
  chat.ts
  project.ts
  github.ts
```
