# Next-Chat Handoff

Stand: **2026-02-19** (Europe/Berlin)

## Repo
- https://github.com/k1w1-a0style/k1w1-a0style
- Branch: `work`

## Letzter Patch
**Patch 207 — Fix Test-Mocks nach Cleanup (Patch 206)**

## Aktueller Status

### ✅ Gerade fertig: Preview Screens (Patch 200) + Cleanup
- `PreviewScreen` und `PreviewFullscreenScreen` sind jetzt modular aufgebaut
- Logik in eigene Hooks extrahiert (`usePreviewScreen`, `usePreviewFullscreen`)
- Gemeinsame WebView-Logik in `screens/shared/preview/`:
  - `useWebViewNavigation` — baseOrigin, originWhitelist, handleShouldStartLoad
  - `useWebViewCrashRecovery` — One-Shot Crash Recovery
  - `webViewTypes.ts` — lokale Event-Typen (kein `any`)
- **Bug gefixt:** `if (!mode)` Guard in PreviewFullscreenScreen war strukturell kaputt (dead code nach return)
- Dead Code gelöscht: `styles/previewScreenStyles.ts`, `lib/previewSettings.ts`
- Weitere Shims/Dead Code entfernt (Patches 205–206):
  - `lib/supabaseTypes.ts`
  - `shared/types/github.ts`
  - Diverse ungenutzte UI-Sektionen in Diagnostic/GitHubRepos/EnhancedBuild
- Flat-Shims (`screens/PreviewScreen.tsx`, `screens/PreviewFullscreenScreen.tsx`) bleiben als 1-Zeiler Re-exports → `App.tsx` unverändert

## Offene Punkte (Priorität)

### Sofort machbar (kleine Patches)
1. **Docs/Checklogs aufräumen** — Hand-off/ToDo enthalten teils alte Punkte (logger/keyMasking/github types).
2. **contexts/types.ts Aufräumen** — Shared-Type-Imports sind migriert. In `contexts/types.ts` sind jetzt nur noch Context-lokale Typen (z.B. `ProjectContextProps`) + deprecated Re-exports. Nächster Schritt: diese lokalen Typen in eine dedizierte Datei (z.B. `contexts/projectTypes.ts`) verschieben und dann `contexts/types.ts` entfernen.
3. **Console → logger** (optional) — logger existiert und ist in Preview-Hooks nutzbar; bei Bedarf weitere Hotspots migrieren und ESLint `no-console` schärfen.

### Mittelfristig
4. **PR-9 Stage 2** — Preview UI weiter splitten (optional, bereits ok lesbar)
5. **any-Annotationen** — schrittweise reduzieren (Start: größte Offender)

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
```
