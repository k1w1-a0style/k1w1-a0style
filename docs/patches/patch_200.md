# Patch 200 — Preview Screens Refactoring (PR-9 Stage 1)

## Warum

`PreviewScreen.tsx` (756 Zeilen) und `PreviewFullscreenScreen.tsx` (705 Zeilen) waren monolithische
Dateien — Logik, Animationen, Handler und JSX komplett vermischt, kein Hook, kein Splitting.

Zusätzlich enthielt `PreviewFullscreenScreen.tsx` einen **kritischen strukturellen Bug**:
Der `if (!mode)` Guard hatte kein schließendes `}` vor dem nachfolgenden
`if (mode === "url" && url && !baseOrigin)` Block. Dieser zweite Guard lag damit
innerhalb eines bereits abgeschlossenen `return` — vollständig totes Code-Pfad.
Wer mit einer invaliden URL navigierte, lief in den normalen Render-Pfad mit einem
`url!` Non-null-Assert und einem potenziellen WebView-Crash.

## Änderungen

### Neue Dateien
- `screens/PreviewScreen/PreviewScreen.tsx` — Komponente (nur Rendering)
- `screens/PreviewScreen/hooks/usePreviewScreen.ts` — Logik, Animationen, Hot-Reload
- `screens/PreviewScreen/index.tsx` — Re-export
- `screens/PreviewFullscreenScreen/PreviewFullscreenScreen.tsx` — Komponente (nur Rendering)
- `screens/PreviewFullscreenScreen/hooks/usePreviewFullscreen.ts` — Logik + Bug-Fix
- `screens/PreviewFullscreenScreen/index.tsx` — Re-export
- `screens/shared/preview/useWebViewNavigation.ts` — Gemeinsamer Hook (baseOrigin, originWhitelist, handleShouldStartLoad)
- `screens/shared/preview/useWebViewCrashRecovery.ts` — Gemeinsamer Hook (Crash-Recovery Logic)
- `screens/shared/preview/webViewTypes.ts` — Gemeinsame lokale WebView Event-Typen

### Ersetzte Dateien
- `screens/PreviewScreen.tsx` — wird zu 1-Zeiler Re-export Shim (→ `./PreviewScreen/index`)
- `screens/PreviewFullscreenScreen.tsx` — wird zu 1-Zeiler Re-export Shim (→ `./PreviewFullscreenScreen/index`)

### Gelöschte Dead Code Dateien
- `styles/previewScreenStyles.ts` — 0 Imports, nie verwendet
- `lib/previewSettings.ts` — 0 Imports, nie verwendet

## Bug-Fixes

### PreviewFullscreenScreen — Strukturell kaputtes `if (!mode)` Guard
**Vorher:** `if (mode === "url" && !baseOrigin)` war dead code (nach einem `return` ohne `}`)
**Nachher:** Beide Guards korrekt als separate `if`-Statements; `hasUrlParseError`-Flag im Hook

### PreviewFullscreenScreen — `console.error` → `logger`
3 direkte `console.error` Calls ersetzt durch `logger.error`

### PreviewScreen — `navigation` typed as `any`
`useNavigation<any>()` ersetzt durch korrekte `NativeStackNavigationProp<RootStackParamList>` Typisierung

## Duplikat-Code eliminiert

`useWebViewNavigation` ersetzt ~60 Zeilen identischen Code in beiden Screens:
- `baseOrigin` Berechnung
- `originWhitelist` Berechnung
- `handleShouldStartLoad` mit `decidePreviewNavigation`

`useWebViewCrashRecovery` kapselt die One-Shot-Recovery-Logik (bisher nur in Fullscreen,
jetzt geteilt und bereit für PreviewScreen).

`webViewTypes.ts` konsolidiert die 5 lokalen Event-Typ-Definitionen, die vorher
in beiden Dateien separat dupliziert waren.

## Erwartung

- Kein Behavior Change
- Typecheck/Lint/Tests grün
- `App.tsx` imports unverändert (flat shims bleiben kompatibel)
