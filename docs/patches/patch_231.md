# Patch 231: Android-only wording cleanup (remove iOS confusion)

## Goals
- Remove user-facing iOS wording that causes confusion.
- Keep the safety guard: incomplete `ios/` folder detection stays, because it can break EAS builds even for Android-only projects.

## Changes
- **Docs:** Adjusted `docs/SYSTEM_README.md` to be Android-only (removed iOS badge/keyboard references).
- **ChatScreen:** Updated the `removeClippedSubviews` comment to Android-only wording.

## Notes
- Historical patch notes may still reference iOS where it was relevant at the time; current product stance is **Android-only**.
