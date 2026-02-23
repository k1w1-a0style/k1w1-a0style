# Patch 231: Android-only wording cleanup (remove non-target platform confusion)

## Goals
- Remove user-facing wording about non-target platforms that causes confusion.
- Keep the safety guard: detection/removal of incomplete **non-target native folders** stays, because EAS can choke on half-existing native projects even in Android-only repos.

## Changes
- **Docs:** Adjusted `docs/SYSTEM_README.md` to be Android-only (removed non-target platform badges/keyboard references).
- **ChatScreen:** Updated the `removeClippedSubviews` comment to Android-only wording.

## Notes
- Historical patch notes were normalized to match the current stance: **Android-only**.
