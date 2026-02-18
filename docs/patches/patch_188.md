# Patch 188 — RepoScreen Polish + Cleanup Ignore

Date: 2026-02-18

## Goals
- Make Repo selection feel like a proper dropdown (roll-down) and reduce clutter.
- Improve Diff/Secrets usability (copy/open, required vs optional).
- Prevent future repo pollution from Supabase CLI temp files and patch zips.

## Changes
### RepoScreen
- Header subtitle is now clickable and toggles repo list (chevron up/down).
- When repo list is open:
  - Added a clear “Repo Auswahl” header with close button.
  - Integrated existing filter UI (search + filter chips + recent repos).
- Diff Dateien:
  - Added quick chips: “Compare öffnen”, “Liste kopieren”, “Alle anzeigen”.
  - File rows are tappable (open file on GitHub) and show +additions / -deletions.
- Secrets:
  - Split expected secrets into Required vs Optional (admin key treated as optional).
  - Missing required secrets show as error.

### Hygiene
- .gitignore now ignores:
  - `supabase/.temp/`
  - `backups/`
  - `.signing_secrets.local`
  - `*.zip`

## Notes
- No API/behavior changes to build/diagnostic flows.
