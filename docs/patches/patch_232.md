# Patch 232: Android-only guard wording (EAS safety) + GH workflow README cleanup

## Goals
- Remove leftover iOS/all wording from **user-facing docs/templates** to keep the repo clearly Android-only.
- Keep the **technical safety guards** intact (incomplete `ios/` folder handling stays because EAS can choke on half-existing native folders).

## Changes
- **.github/workflows/README.md**
  - Removed/rewrote iOS/all platform examples → Android-only wording.
  - Updated performance/optimization section to avoid iOS references.

- **templates/expo-sdk54-*.json**
  - Neutralized template comments: no “Android/iOS …” phrasing.
  - Reworded “never allow iOS” comment to neutral “unsupported platforms” wording.

- **screens/ChatScreen/index.tsx**
  - Reworded the FIX #16 comment to avoid iOS wording while preserving the rationale.

## Notes
- This patch is **docs/text only**. No runtime logic changes.
