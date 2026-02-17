# Patch 175 — AppInfoScreen Key Backup: include signing keys + token bundle

## What was updated

- **AppInfoScreen Full Backup (export/import)**
  - Export now includes a normalized `tokens` bundle (GitHub/Expo/Edge admin/Supabase service role).
  - Export adds an optional `ciSecrets` map to mirror common CI/Edge secret names.
  - Import can restore from either `tokens.*` **or** `ciSecrets.*` (fallback) to support older/newer backup shapes.

- **SecureStore support for signing master key**
  - Added optional SecureStore helpers for `SIGNING_MASTER_KEY` so it can be backed up/restored when present.

## Files changed

- `screens/AppInfoScreen/types.ts`
- `screens/AppInfoScreen/hooks/useAppInfoScreen.ts`
- `infra/github/tokenStore.ts`

## Verify

```bash
npm run typecheck
npm run lint:ci
npm run test:silent
```

Manual sanity:
- AppInfoScreen → Full Backup export includes `tokens` + `ciSecrets`.
- Importing the same JSON restores tokens/keys without crashes.
