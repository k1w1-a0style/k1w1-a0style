# Patch 174 — Fix PR-8 import drift audit script

## What was fixed
- `scripts/refactor/pr8-context-import-audit.sh`
  - Fixed broken quoting that caused: `unexpected EOF while looking for matching '"`
  - Restored executable permission (`chmod +x`)

## Verify
```bash
npm run audit:imports
npm run preflight:fast
# optional
npm run preflight
```
