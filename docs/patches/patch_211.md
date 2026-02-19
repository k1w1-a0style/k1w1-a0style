# Patch 211

## Ziel
Einheitliche **Source of Truth** für:
- GitHub API Base-URL
- Token-Keys (GitHub/Expo) inkl. Legacy-Migration

Damit gibt’s keine verstreuten Hardcodes mehr ("api.github.com", Token-Key-Strings), sondern einen zentralen Ort.

## Änderungen

### 1) GitHub API Base-URL zentralisiert
- Neu: `shared/constants/github.ts`
  - `GITHUB_API_BASE`
  - `githubApiUrl(path)`
- Alle direkten `https://api.github.com/...` Vorkommen (App + Supabase Functions) auf die zentrale Quelle umgestellt.

### 2) Token Keys zentralisiert
- Neu: `shared/constants/tokens.ts`
  - `TOKEN_KEYS` (`github_token`, `expo_token`)
  - `KNOWN_TOKEN_KEYS`
- `infra/github/tokenStore.ts`
  - nutzt jetzt `TOKEN_KEYS.*`
  - one-time Migration von Legacy-Keys: `github_pat_v1`, `expo_token_v1`
- `lib/SecureTokenManager.ts`
  - nutzt `KNOWN_TOKEN_KEYS` aus zentraler Quelle

## Hinweise
- Legacy-Keys werden automatisch migriert (einmalig) und anschließend gelöscht.
- Keine API-Änderung nach außen: nur interne Konsolidierung.
