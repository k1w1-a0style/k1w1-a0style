# Patch 233: Docs/History wording purge (Android-only, no non-target platform mentions)

## Goals
- Remove remaining mentions of non-target platforms from **documentation and historical notes**.
- Keep runtime/build safety logic untouched (technical guards remain where required).

## Changes
- Updated historical/docs files to avoid explicit non-target platform naming:
  - `docs/PROJECT_CONTEXT.md`
  - `docs/patches/manifests/PATCH_README.txt`
  - `docs/patches/PATCH_53_NOTES.md`
  - `docs/patches/patch_222.md`
  - `docs/patches/patch_231.md`
  - `docs/patches/patch_232.md`
  - `docs/patches/PATCHLOG_ROOT.md`
  - `docs/reviews/PREVIEW_SCREENS_VERIFICATION.md`
  - `docs/reviews/CHAT_SCREEN_VERIFICATION.md`
  - `.github/copilot-instructions.md`

## Notes
- This patch intentionally avoids changing any workflow scripts or code paths that deal with native folders; it is a **text-only hygiene pass**.
