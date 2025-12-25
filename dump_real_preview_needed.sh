#!/usr/bin/env bash
set -e
cd ~/k1w1-a0style
OUT="real_preview_needed_dump.txt"

{
  echo "### App.tsx"
  echo
  sed -n '1,260p' App.tsx
  echo
  echo "### screens/PreviewScreen.tsx"
  echo
  sed -n '1,320p' screens/PreviewScreen.tsx
  echo
  echo "### screens/EnhancedBuildScreen.tsx (1)"
  echo
  sed -n '1,320p' screens/EnhancedBuildScreen.tsx
  echo
  echo "### screens/EnhancedBuildScreen.tsx (2)"
  echo
  sed -n '320,760p' screens/EnhancedBuildScreen.tsx
  echo
  echo "### components/CustomHeader.tsx (1)"
  echo
  sed -n '1,320p' components/CustomHeader.tsx
  echo
  echo "### components/CustomHeader.tsx (2)"
  echo
  sed -n '320,760p' components/CustomHeader.tsx
  echo
  echo "### contexts/githubService.ts (1)"
  echo
  sed -n '1,320p' contexts/githubService.ts
  echo
  echo "### contexts/githubService.ts (2)"
  echo
  sed -n '320,760p' contexts/githubService.ts
  echo
  echo "### lib/buildHistoryStorage.ts"
  echo
  sed -n '1,260p' lib/buildHistoryStorage.ts
  echo
  echo "### lib/supabaseTypes.ts"
  echo
  sed -n '1,260p' lib/supabaseTypes.ts
  echo
  echo "### SEARCH: trigger/check eas build"
  echo
  rg -n "trigger-eas-build|check-eas-build|functions.invoke|SUPABASE|EAS" -S . || true
} > "$OUT"

echo "✅ Dump geschrieben: $OUT"
