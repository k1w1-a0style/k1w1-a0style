#!/usr/bin/env bash
set -euo pipefail
ZIP_PATH="${1:-}"
if [[ -z "$ZIP_PATH" ]]; then
  echo "Usage: ./apply_updated_files.sh /path/to/k1w1_updated_files.zip"
  exit 1
fi
if [[ ! -f "$ZIP_PATH" ]]; then
  echo "Zip not found: $ZIP_PATH"
  exit 1
fi
# Ensure we're in repo root (contains package.json)
if [[ ! -f package.json ]]; then
  echo "Run this from repo root (where package.json is)."
  exit 1
fi

echo "Applying updated files from: $ZIP_PATH"

# List of files in the zip (kept explicit for safety)
FILES=(
  "lib/RateLimiter.ts"
  "lib/autoSyncRepoSecrets.ts"
  "contexts/githubService.ts"
  "contexts/ProjectContext.tsx"
  "supabase/functions/trigger-eas-build/index.ts"
  "supabase/functions/preview_page/index.ts"
  "supabase/migrations/20260105000100_build_jobs.sql"
  ".github/workflows/k1w1-triggered-build.yml"
  ".github/workflows/eas-build.yml"
  ".github/workflows/release-build.yml"
  "screens/GitHubReposScreen.tsx"
  "screens/EnhancedBuildScreen.tsx"
  "screens/PreviewScreen.tsx"
  "hooks/usePreview.ts"
  "templates/expo-sdk54-base.json"
)

for f in "${FILES[@]}"; do
  dir=$(dirname "$f")
  mkdir -p "$dir"
  rm -f "$f"
  # extract single file to path
  unzip -p "$ZIP_PATH" "$f" > "$f"
  echo "✅ wrote $f"
done

echo "\nDone. Now run:\n  npm run typecheck && npm run lint:ci && npm run test:silent\n  git status\n"
