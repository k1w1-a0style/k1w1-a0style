# Patch 318: Critical lint follow-up for patches 314/316/317

## Ziel

Gemeldete Restfehler aus den letzten Preview-Patches kritisch prüfen und nachhaltig beheben, insbesondere die nicht-autofixbaren Typing-Warnungen.

## Änderungen

- `hooks/usePreview.ts`
  - Neue Type-Guard-Funktion `isProjectFile(...)` ergänzt.
  - Filter auf `projectData.files` auf den Type-Guard umgestellt (entfernt `any`-Casts).
  - `invokeOpts` nicht mehr als `any` getypt (Inference reicht aus).

- `supabase/functions/save_preview/helpers.ts`
  - Internen Input-Typ `SnackFileInput` ergänzt.
  - `sanitizeFiles(...)` ohne `any`-Casts umgesetzt.
  - `type` wird jetzt nur gesetzt, wenn tatsächlich ein String vorliegt.

- `supabase/functions/preview_page/index.ts`
  - Internen Typ `PreviewMeta` ergänzt.
  - Zugriff auf `record.meta.template` ohne `any`-Cast umgesetzt.

## Ergebnis / Einordnung

- Die kritischen, nicht-autofixbaren Typing-Probleme in den betroffenen Patch-Bereichen sind entfernt.
- Projektweite Pflichtchecks laufen weiterhin grün.

## Checks

```bash
npm run typecheck
npm run lint:ci
npm run test:silent
```
