#!/usr/bin/env bash
set -euo pipefail

# Move root-level markdown notes into docs/ to keep repo clean.
# Safe to run multiple times.

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

mkdir -p docs/notes docs/patches docs/snippets

# helper: use git mv if possible
move() {
  local src="$1" dst="$2"
  [ -e "$src" ] || return 0
  mkdir -p "$(dirname "$dst")"
  if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    if git ls-files --error-unmatch "$src" >/dev/null 2>&1; then
      git mv -f "$src" "$dst"
    else
      mv -f "$src" "$dst"
    fi
  else
    mv -f "$src" "$dst"
  fi
}

# Notes & one-off analysis
move CHECKLOG_MERGE_NOTE.md docs/notes/CHECKLOG_MERGE_NOTE.md
move CHECKLOG_SONET_NOTE.md docs/notes/CHECKLOG_SONET_NOTE.md

# CI snippets
move PATCH_21_CI_CORE_SNIPPET.md docs/snippets/PATCH_21_CI_CORE_SNIPPET.md

# Patch-related notes that accidentally got committed
move PATCH_23_NOTES.md docs/patches/PATCH_23_NOTES.md
move USE_CODESCREEN_FILE_SYSTEM_PATCH.md docs/patches/USE_CODESCREEN_FILE_SYSTEM_PATCH.md
move README_PATCH.txt docs/patches/README_PATCH.txt

# Big docs – prefer docs/
move README_EXTENDED.md docs/README_EXTENDED.md
move SYSTEM_README.md docs/SYSTEM_README.md
move TESTING_GUIDE.md docs/TESTING_GUIDE.md
move REFACTORING_SUMMARY.md docs/REFACTORING_SUMMARY.md
move PROJECT_CONTEXT.md docs/PROJECT_CONTEXT.md

# Old incremental checklog append files (should be merged already)
for f in PROJECT_CHECKLOG_APPEND_*.md; do
  [ -e "$f" ] || continue
  echo "Removing obsolete: $f"
  rm -f "$f"
  # if tracked, ensure removed from git index too
  if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    git rm -f --ignore-unmatch "$f" >/dev/null 2>&1 || true
  fi
done

# Ensure docs index exists
if [ ! -f docs/INDEX.md ]; then
  echo "docs/INDEX.md missing – did you apply the docs patch zip?"
fi

echo "✅ docs organization done. Review with: git status"
