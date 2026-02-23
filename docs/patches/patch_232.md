# Patch 232: Android-only guard wording (EAS safety) + GH workflow README cleanup

## Goals
- Remove leftover **non-target platform** wording from user-facing docs/templates to keep the repo clearly Android-only.
- Keep the **technical safety guards** intact (incomplete non-target native folder handling stays because EAS can choke on half-existing native folders).

## Changes
- **.github/workflows/README.md**
  - Removed/rewrote non-target platform examples → Android-only wording.
  - Updated performance/optimization section to avoid non-target references.

- **templates/expo-sdk54-*.json**
  - Neutralized template comments: no multi-platform phrasing.
  - Reworded platform-block comments to neutral “unsupported platforms” wording.

- **screens/ChatScreen/index.tsx**
  - Reworded a comment to avoid non-target platform wording while preserving the rationale.

## Notes
- This patch is **docs/text only**. No runtime logic changes.
