# TODO

Stand: **2026-02-10**

## ✅ Done (CodeScreen)
- WebView-Editor (ohne gravierende UI-Änderung)
- RN↔WebView Bridge stabilisiert
- Focus-Tracking + Sync-Fix (keine Cursor-Sprünge durch externe Updates)
- Injection-Härtung beim Initialisieren des Editor-Inhalts
- WebCodeEditor CSS Textfarbe fix (kein [object Object])
- `isDirty` vereinheitlicht (Hook + UI, inkl. Preview)
- TXT-Export stabil (expo-file-system typings kompatibel)
- QoL:
  - Duplicate-Kollisionen verhindern
  - Dateiendung-Regeln (kein blindes `.tsx` für `Dockerfile`, `.env`, usw.)
  - Clipboard `await` + Fehlerhandling
  - SyntaxErrorBar stabile Keys (ohne fileName/column)
- Unsaved-Changes Flow hardened: "Speichern" navigiert nur weiter, wenn wirklich gespeichert wurde
- Wartbarkeit/Perf:
  - `useCodeScreen` in kleinere Hooks gesplittet (Explorer/Editor/Actions)
  - Validation debounced + per `InteractionManager.runAfterInteractions` deferred
- Security:
  - Bridge Message-Schema strikter validiert + Unit-Tests
- Typing-Hygiene:
  - `gap` RN-Types per global `.d.ts` ergänzt (kein `as any` mehr nötig)
  - `expo-file-system` Typen lokal ergänzt (kein `any`-Cast)

## ✅ Done (Maintenance)
- Patch-Skripte/Docs bereinigt und Handoff-Prompt angelegt.

## ✅ Done (Preview)
- Hardening: `createPreview` singleflight (kein Doppelklick-Race) + keine State-Updates nach Unmount.
- Fullscreen: WebView Callback Typing gehärtet (kompatibel mit `react-native-webview@13.15.x`).

## 🔧 Optional / Tech-Debt (CodeScreen)
- Performance (nur falls spürbar): Syntax-Validation/Quality-Checks weiter auslagern (Worker/Task) oder „progressive validation“.
- WebView/Bridge Paranoia: CSP / striktere WebView Settings (soweit Plattform zulässt).

## ⏭️ Next (CodeScreen)
- Nichts Kritisches offen.

## ➡️ Next: Preview
1) **PreviewScreen** komplett fertig machen (Funktionalität vor UI/Polish).
2) **PreviewFullscreen** danach.

### Preview – aktuelle Restpunkte (funktional first)
- PreviewScreen: Funktionalität komplett machen (Flows/Fehler/Retry), erst danach UI/Polish.
- Fullscreen: Navigation-Guards & Edgecases weiter härten.

## UI/UX Polish (ganz zum Schluss)
- Einheitliche Optik über alle Screens + kleine Grafik-/Spacing-Fixes.
