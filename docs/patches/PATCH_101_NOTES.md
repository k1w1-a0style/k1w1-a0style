# Patch 101 – Supabase Preview Safe Logging + Template Fix + Docs Refresh

**Datum:** 2026-02-13  
**Typ:** Security (Defense-in-depth) + Bugfix + Docs  

## Summary

- `preview_page` Edge Function: **alle Error-Logs werden sanitisiert**, damit Secrets nicht über Exception-Messages/URLs in Logs landen.
- `create_codesandbox`: Fix für **falsche Imports im generierten App.tsx Template** (Copy/Paste Bug).
- Docs: TODO/Verification/Checklog aktualisiert.

> Hinweis: Die `preview_page` Response war bereits generisch (`Internal Server Error`). Der echte Fix ist **Log-Sanitization**.

## Änderungen

### 1) `supabase/functions/preview_page/index.ts`
- nutzt `sanitizeErrorText(...)` nicht nur im Top-Level `catch`, sondern auch in:
  - JSON-Parse-Fehlerpfad
  - `fetchPreviewRecord` catch
  - `deletePreviewRecord` catch

### 2) `supabase/functions/create_codesandbox/index.ts`
- entfernt zwei falsche Edge-Imports aus dem generierten React Template (`src/App.tsx`).

### 3) Docs
- `docs/TODO.md`: Patch 101 im Kurzlog ergänzt.
- `docs/reviews/SUPABASE_MIGRATION_VERIFICATION.md`: Patch 100/101 Follow-ups dokumentiert.
- `PROJECT_CHECKLOG.md`: Patch 101 Eintrag ergänzt.

## Verifikation

```bash
npm run typecheck
npm run lint:ci
npm run test:silent

# optional (wenn du Supabase deployest)
supabase functions deploy
```

## Files

- `supabase/functions/preview_page/index.ts`
- `supabase/functions/create_codesandbox/index.ts`
- `docs/TODO.md`
- `docs/reviews/SUPABASE_MIGRATION_VERIFICATION.md`
- `PROJECT_CHECKLOG.md`
- `docs/patches/PATCH_101_NOTES.md`
