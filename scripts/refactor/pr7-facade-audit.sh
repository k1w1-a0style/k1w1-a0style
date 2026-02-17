#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

echo "== PR-7 Stage 3: Facade import audit =="
echo "Repo: $ROOT"
echo

# We only flag *actual imports/requires* of the facade entrypoints (not docs/comments).
# Goal: ensure runtime code uses the new modules (infra/*, lib/diagnostics/*).

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
  "--exclude-dir=docs"
  "--exclude-dir=backups"
)

INCLUDES=(
  "--include=*.ts"
  "--include=*.tsx"
  "--include=*.js"
  "--include=*.jsx"
)

# Regexes: import ... from 'X'  OR  require('X')
REGEXES=(
  "from[[:space:]]+['\"](\./|\.\./|\.\./\.\./|\.\./\.\./\.\./)?contexts/githubService['\"]"
  "require\([[:space:]]*['\"](\./|\.\./|\.\./\.\./|\.\./\.\./\.\./)?contexts/githubService['\"][[:space:]]*\)"
  "from[[:space:]]+['\"](\./|\.\./|\.\./\.\./|\.\./\.\./\.\./)?contexts/projectStorage['\"]"
  "require\([[:space:]]*['\"](\./|\.\./|\.\./\.\./|\.\./\.\./\.\./)?contexts/projectStorage['\"][[:space:]]*\)"
  "from[[:space:]]+['\"](\./|\.\./|\.\./\.\./|\.\./\.\./\.\./)?lib/templateChecklist['\"]"
  "require\([[:space:]]*['\"](\./|\.\./|\.\./\.\./|\.\./\.\./\.\./)?lib/templateChecklist['\"][[:space:]]*\)"
)

FOUND=0
TMP="/tmp/facade_audit_hits.txt"
rm -f "$TMP" || true

for rx in "${REGEXES[@]}"; do
  echo "-- searching for regex: $rx"
  if grep -RInE "${EXCLUDES[@]}" "${INCLUDES[@]}" "$rx" "$ROOT" >>"$TMP" 2>/dev/null; then
    # Don't dump the entire file; show the matches only.
    tail -n 200 "$TMP" | sed 's|^|  |'
    FOUND=1
  fi
done

rm -f "$TMP" || true

if [[ "$FOUND" -eq 1 ]]; then
  echo
  echo "❌ Facade imports detected."
  echo "Fix by switching imports to:"
  echo "  - infra/github/githubService"
  echo "  - infra/storage/projectPersistence"
  echo "  - lib/diagnostics/templates"
  exit 1
fi

echo "✅ No facade imports found."
