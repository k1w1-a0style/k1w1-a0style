#!/usr/bin/env bash
set -euo pipefail

ROOT="$(pwd)"

echo "== PR-8 Stage 3: Type drift audit (Build types) =="
echo "Repo: $ROOT"
echo

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
)

# We only allow these build-related type definitions in ONE place:
#   shared/types/build.ts
ALLOWED_FILE="shared/types/build.ts"

declare -a PATTERNS=(
  "export[[:space:]]+type[[:space:]]+BuildStatus[[:space:]]*="
  "interface[[:space:]]+BuildStatusDetails"
  "export[[:space:]]+interface[[:space:]]+BuildStatusDetails"
  "interface[[:space:]]+BuildHistoryEntry"
  "export[[:space:]]+interface[[:space:]]+BuildHistoryEntry"
  "type[[:space:]]+BuildHistoryEntry[[:space:]]*="
  "export[[:space:]]+type[[:space:]]+BuildHistoryEntry[[:space:]]*="
)

found=0

for pat in "${PATTERNS[@]}"; do
  # get matches excluding the allowed file
  matches="$(grep -RIn -E "${EXCLUDES[@]}" "${INCLUDES[@]}" "$pat" . 2>/dev/null | grep -v -E "^\./${ALLOWED_FILE}:" || true)"
  if [ -n "$matches" ]; then
    echo "❌ Found forbidden duplicate definition for regex: $pat"
    echo "$matches" | head -n 200
    echo
    found=1
  fi
done

if [ "$found" -eq 1 ]; then
  echo "Type drift detected. Build-related types must be defined only in: $ALLOWED_FILE"
  exit 1
fi

echo "✅ No duplicate Build* type definitions found (single source of truth enforced)."
