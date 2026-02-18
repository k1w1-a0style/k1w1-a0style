# PATCH 39 — CodeScreen gap typing cleanup

Ziel: **keine UI-Änderung**, nur TypeScript/Style-Typing aufräumen.

## Änderungen

- **CodeScreen styles:** alle `gap: <n> as any` Stellen entfernt.
- **WebCodeEditor:** `gap` in der Mini-Toolbar ohne `as any`.
- **Types:** `types/react-native-gap.d.ts` ergänzt/aktualisiert, damit `gap/rowGap/columnGap` sauber typisiert ist.
- **Docs:** `docs/TODO.md` aktualisiert.

## Warum?
RN unterstützt `gap`, aber die Typings sind je nach Version nicht komplett. Das `as any` streuen wir nicht mehr überall, sondern lösen es zentral über eine Type-Extension.

## Checks
- `npm run typecheck`
- `npm run lint:ci`
- `npm run test:silent`

