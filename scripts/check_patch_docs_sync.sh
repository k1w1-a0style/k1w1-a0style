#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$root"

require_fixed() {
  local file="$1"
  local pattern="$2"
  if ! grep -Fq -- "$pattern" "$file"; then
    echo "Missing pattern in $file: $pattern" >&2
    exit 1
  fi
}

require_regex() {
  local file="$1"
  local pattern="$2"
  if ! grep -Eq -- "$pattern" "$file"; then
    echo "Missing regex in $file: $pattern" >&2
    exit 1
  fi
}

PATCH_ID="$({
  grep -Eo 'Zuletzt abgeschlossen: \*\*Patch [A-Za-z0-9._-]+\*\*' README.md \
    | sed -E 's/^Zuletzt abgeschlossen: \*\*Patch ([A-Za-z0-9._-]+)\*\*$/\1/' \
    | head -n1;
})"

if [ -z "${PATCH_ID:-}" ]; then
  echo "Could not determine current patch id from README.md" >&2
  exit 1
fi

PATCH_FILE="docs/patches/patch_${PATCH_ID}.md"
[ -f "$PATCH_FILE" ] || {
  echo "Missing current patch file: $PATCH_FILE" >&2
  exit 1
}

require_fixed README.md "Zuletzt abgeschlossen: **Patch ${PATCH_ID}**"
require_regex PROJECT_CHECKLOG.md "Patch ${PATCH_ID}:"
require_regex docs/patches/PATCHLOG_ROOT.md "- Patch ${PATCH_ID}:"
require_fixed "$PATCH_FILE" "# Patch ${PATCH_ID}"
require_fixed docs/WORKFLOW_PATCHING.md 'rm -rf <PATCH_PACKAGE_DIR>'
require_fixed docs/WORKFLOW_PATCHING.md 'rm -f <PATCH_ZIP>'
require_fixed docs/INDEX.md '[EDGE_FUNCTIONS_STATUS](EDGE_FUNCTIONS_STATUS.md)'
[ -f docs/EDGE_FUNCTIONS_STATUS.md ] || { echo 'Missing docs/EDGE_FUNCTIONS_STATUS.md' >&2; exit 1; }
require_fixed docs/06-build-readiness.md 'K1W1_EDGE_WORKFLOW_JWT'

checklog_top="$(grep -Eo 'Patch [A-Za-z0-9._-]+:' PROJECT_CHECKLOG.md | head -n1 | sed -E 's/^Patch ([A-Za-z0-9._-]+):$/\1/')"
patchlog_top="$(grep -Eo -- '- Patch [A-Za-z0-9._-]+:' docs/patches/PATCHLOG_ROOT.md | head -n1 | sed -E 's/^- Patch ([A-Za-z0-9._-]+):$/\1/')"

[ "$checklog_top" = "$PATCH_ID" ] || {
  echo "PROJECT_CHECKLOG.md top patch (${checklog_top:-<none>}) does not match README patch ${PATCH_ID}" >&2
  exit 1
}

[ "$patchlog_top" = "$PATCH_ID" ] || {
  echo "PATCHLOG_ROOT.md top patch (${patchlog_top:-<none>}) does not match README patch ${PATCH_ID}" >&2
  exit 1
}

[ ! -e WORKFLOW_SUPABASE_MD_DEEP_ANALYSE_2026-03-08.md ] || {
  echo "Root analysis artifact should not exist: WORKFLOW_SUPABASE_MD_DEEP_ANALYSE_2026-03-08.md" >&2
  exit 1
}

echo 'Patch docs sync check passed.'
