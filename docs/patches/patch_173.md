# Patch 173 — PR-8 Stage 7 (Normalize & Docs)

## What changed
- Normalized the blocking import drift audit script for Build domain types.
- Added `preflight:fast` for quick local verification without running tests.
- Updated `PROJECT_CHECKLOG.md` with PR-8 patch entries.

## Files included in this patch zip
- `scripts/refactor/pr8-context-import-audit.sh`
- `package.json`
- `PROJECT_CHECKLOG.md`
- `PATCH_173.md`

## How to apply (from repo root)
```bash
unzip -o k1w1-a0style_patch_173.zip -d .
rm -f k1w1-a0style_patch_173.zip

npm run preflight:fast
# optional full:
npm run preflight

git add -A
git commit -m "Patch 173: PR-8 stage 7 normalize import audit + preflight:fast + docs"
git push
```
