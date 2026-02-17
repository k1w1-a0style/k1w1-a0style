#!/usr/bin/env bash
set -euo pipefail

ROOT="$(pwd)"

echo "== PR-7 Stage 5: Facade removal verification =="
echo "Repo: $ROOT"
echo

# Notes:
# - We flag actual imports/requires of removed facade entrypoints.
# - Docs/comments can still mention historical paths.
# - This script is intended to be CI-friendly.

EXCLUDES=(
  "--exclude-dir=node_modules"
  "--exclude-dir=.git"
  "--exclude-dir=dist"
  "--exclude-dir=build"
  "--exclude-dir=android"
  "--exclude-dir=ios"
  "--exclude-dir=web-build"
  "--exclude-dir=.expo"
  "--exclude-dir=.expo-shared"
  "--exclude-dir=coverage"
  "--exclude-dir=backups"
)

INCLUDES=(
  "--include=*.ts"
  "--include=*.tsx"
  "--include=*.js"
  "--include=*.jsx"
)

# 1) The facade files themselves must be gone.
for f in "contexts/githubService.ts" "contexts/projectStorage.ts" "lib/templateChecklist.ts"; do
  if [ -f "$ROOT/$f" ]; then
    echo "❌ Facade file still exists: $f"
    exit 1
  fi
done

found=0

# 2) Common failure mode: relative imports to the old contexts-local helpers.
RELATIVE_PATTERNS=(
  "from[[:space:]]+['\"]\\./githubService['\"]"
  "require\\([[:space:]]*['\"]\\./githubService['\"][[:space:]]*\\)"
  "from[[:space:]]+['\"]\\./projectStorage['\"]"
  "require\\([[:space:]]*['\"]\\./projectStorage['\"][[:space:]]*\\)"
  "from[[:space:]]+['\"]\\.\\./lib/templateChecklist['\"]"
  "from[[:space:]]+['\"]\\.\\./templateChecklist['\"]"
)

for pat in "${RELATIVE_PATTERNS[@]}"; do
  if grep -RIn -E "${EXCLUDES[@]}" "${INCLUDES[@]}" "$pat" . >/dev/null 2>&1; then
    echo "-- searching for regex: $pat"
    grep -RIn -E "${EXCLUDES[@]}" "${INCLUDES[@]}" "$pat" . | head -n 50 || true
    found=1
  fi
done

# 3) Direct imports/requires of the removed facade entrypoints.
PATTERNS=(
  "from[[:space:]]+['\"](\\./|\\.\\./|\\.\\./\\.\\./|\\.\\./\\.\\./\\.\\./)?contexts/githubService['\"]"
  "require\\([[:space:]]*['\"](\\./|\\.\\./|\\.\\./\\.\\./|\\.\\./\\.\\./\\.\\./)?contexts/githubService['\"][[:space:]]*\\)"
  "from[[:space:]]+['\"](\\./|\\.\\./|\\.\\./\\.\\./|\\.\\./\\.\\./\\.\\./)?contexts/projectStorage['\"]"
  "require\\([[:space:]]*['\"](\\./|\\.\\./|\\.\\./\\.\\./|\\.\\./\\.\\./\\.\\./)?contexts/projectStorage['\"][[:space:]]*\\)"
  "from[[:space:]]+['\"](\\./|\\.\\./|\\.\\./\\.\\./|\\.\\./\\.\\./\\.\\./)?lib/templateChecklist['\"]"
  "require\\([[:space:]]*['\"](\\./|\\.\\./|\\.\\./\\.\\./|\\.\\./\\.\\./\\.\\./)?lib/templateChecklist['\"][[:space:]]*\\)"
)

for pat in "${PATTERNS[@]}"; do
  if grep -RIn -E "${EXCLUDES[@]}" "${INCLUDES[@]}" "$pat" . >/dev/null 2>&1; then
    echo "-- searching for regex: $pat"
    grep -RIn -E "${EXCLUDES[@]}" "${INCLUDES[@]}" "$pat" . | head -n 50 || true
    found=1
  fi
done

if [ "$found" -eq 1 ]; then
  echo
  echo "❌ Legacy imports detected."
  echo "Fix by switching imports to:"
  echo "  - infra/github/githubService"
  echo "  - infra/storage/projectPersistence"
  echo "  - lib/diagnostics/templates"
  exit 1
fi

echo "✅ No legacy/facade imports found."
