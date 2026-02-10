#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

say() { printf "%s\n" "$*"; }

say "🧹 Cleanup: scanning for safe-to-remove artifacts..."

# 1) Stray patch zips (root)
shopt -s nullglob
ROOT_ZIPS=(k1w1-a0style_patch_*.zip)
if (( ${#ROOT_ZIPS[@]} )); then
  say "- Removing root patch zips: ${ROOT_ZIPS[*]}"
  rm -f "${ROOT_ZIPS[@]}"
fi

# 2) docs patch artifact zips (optional cache)
if [ -d "docs/patches/artefacts" ]; then
  ARTS=(docs/patches/artefacts/*.zip)
  if (( ${#ARTS[@]} )); then
    say "- Removing docs/patches/artefacts zips: ${ARTS[*]}"
    rm -f "${ARTS[@]}"
  fi
fi

# 3) Move UI helper scripts into scripts/ui (keep root copies if move fails)
mkdir -p scripts/ui
for f in apply_ui_polish_fix_dev_toggle_v2.sh k1w1_ui_polish_templates.sh; do
  if [ -f "$f" ]; then
    say "- Moving $f -> scripts/ui/$f"
    mv "$f" "scripts/ui/$f"
  fi
done

# 4) Move PROJECT_CHECKLOG_APPEND_* into docs/patches/checklog
mkdir -p docs/patches/checklog
APPENDS=(PROJECT_CHECKLOG_APPEND_PATCH_*.md)
if (( ${#APPENDS[@]} )); then
  say "- Moving PROJECT_CHECKLOG_APPEND_* -> docs/patches/checklog/"
  for f in "${APPENDS[@]}"; do
    mv "$f" "docs/patches/checklog/$f"
  done
fi

# 5) Known stray file from an earlier hotfix attempt
if [ -f "SyntaxErrorBar.tsx" ]; then
  say "- Removing stray root SyntaxErrorBar.tsx"
  rm -f SyntaxErrorBar.tsx
fi

say "✅ Cleanup done. Review with: git status"
