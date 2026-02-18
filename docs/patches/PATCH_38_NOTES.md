# PATCH 38 — CodeScreen: typing cleanups + docs hygiene

## Ziele
- TypeScript/ESLint sauber halten (ohne `gap: ... as any` Workarounds).
- Docs/Repo aufräumen (verwaiste Patch-Notizen / Artefakte).

## Änderungen
### CodeScreen
- **`screens/CodeScreen/styles.ts`**: `gap`-Styles ohne `as any`.
- **`screens/CodeScreen/components/WebCodeEditor.tsx`**: Toolbar-`gap` ohne `as any`.
  - Hinweis: der verbleibende `(webRef.current as any)?.postMessage` ist ein runtime-Ref-Edgecase der WebView-Types.

### Types
- **`types/react-native-gap.d.ts`**: `gap/rowGap/columnGap` auf `ViewStyle` erweitert.
  - Ergebnis: keine `as any`-Hacks mehr für `gap`.

### Docs / Cleanup
- **`docs_PATCH_28_NOTES.md`** (Root) → **`docs/patches/PATCH_28_NOTES.md`** (korrekter Ort).
- `docs/patches/artifacts/Mobile-APK-Builder-PATCH39.zip` entfernt (Artefakt, nicht nötig fürs Repo).

## Checks
- `npm run typecheck`
- `npm run lint:ci`
- `npm run test:silent`
