# Patch 280: CI Lite palette fix

## Fix
- Replace `theme.palette.danger` with `theme.palette.error` in `components/CiLiteHeaderButton.tsx`.

## Note
If you accidentally created a root-level `CiLiteHeaderButton.tsx` (wrong unzip path), delete it:
- `rm -f CiLiteHeaderButton.tsx`

