# Patch 92 Notes

## Fix
- GitHubReposScreen: `splitFullName` rejected whitespace inside segments but still accepted whitespace around `/` (e.g. `a /b`, `a/ b`).
- Now rejects **any** whitespace in the trimmed `owner/repo` identifier before splitting.

## Impact
- No UI/visual changes.
- More robust parsing of repo identifiers; invalid inputs are now ignored consistently.

## Verification
- `npm run typecheck` ✅
- `npm run lint:ci` ✅
- `npm run test:silent` ✅ (includes `githubReposParsing` whitespace cases)
