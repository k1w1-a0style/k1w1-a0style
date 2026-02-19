# Patch 195: Storage key cleanup + API key masking unification

## Summary
This patch addresses two issues highlighted in the external code review:

1) **AsyncStorage key drift for Supabase service role key**
   - Removed the redundant `SUPABASE_SERVICE_ROLE_KEY_LEGACY` constant (it had the same string value as the non-legacy key).
   - Updated all call-sites to use a single, canonical key: `STORAGE_KEYS.SUPABASE_SERVICE_ROLE_KEY`.

2) **Inconsistent API key masking between screens**
   - Settings UI now uses the canonical masking function from `lib/apiKeyMasking.ts`.

## Files changed
- `lib/storageKeys.ts`
- `screens/AppInfoScreen/hooks/useAppInfoScreen.ts`
- `screens/ConnectionsScreen/hooks/useConnectionsScreen.ts`
- `lib/autoSyncRepoSecrets.ts`
- `screens/SettingsScreen/components/ApiKeysSection.tsx`
