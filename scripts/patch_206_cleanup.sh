#!/usr/bin/env bash
set -euo pipefail

# Patch 206: remove clearly unused UI section components left behind after refactors.
# Safe to re-run.

FILES=(
  "screens/DiagnosticScreen/components/IssuesTabSection.tsx"
  "screens/DiagnosticScreen/components/NonIssuesTabSection.tsx"
  "screens/EnhancedBuildScreen/components/DiffSection.tsx"
  "screens/EnhancedBuildScreen/components/GitHubActionsSection.tsx"
  "screens/GitHubReposScreen/components/ActionsSection.tsx"
  "screens/GitHubReposScreen/components/RepoListSection.tsx"
  "screens/GitHubReposScreen/components/WorkflowRunsSection.tsx"
)

removed_any=0
for f in "${FILES[@]}"; do
  if [ -f "$f" ]; then
    removed_any=1
    if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
      git rm -f "$f" >/dev/null 2>&1 || rm -f "$f"
    else
      rm -f "$f"
    fi
    echo "removed: $f"
  fi
done

# Sanity: ensure no remaining imports reference deleted modules.
PATTERNS=(
  "IssuesTabSection"
  "NonIssuesTabSection"
  "DiffSection"
  "GitHubActionsSection"
  "ActionsSection"
  "RepoListSection"
  "WorkflowRunsSection"
)

found=0
for p in "${PATTERNS[@]}"; do
  if rg -n "$p" screens components hooks lib project utils contexts 2>/dev/null | grep -v "node_modules" >/dev/null 2>&1; then
    echo "[warn] Found references to '$p' after cleanup. Please check manually."
    found=1
  fi
done

if [ "$removed_any" -eq 0 ]; then
  echo "Patch 206 cleanup: nothing to remove (already clean)."
else
  echo "Patch 206 cleanup done."
fi

exit 0
