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

require_exists() {
  local file="$1"
  [ -f "$file" ] || {
    echo "Missing file: $file" >&2
    exit 1
  }
}

patch_id="$({
  grep -Eom1 'Zuletzt abgeschlossen: \*\*Patch [A-Za-z0-9._-]+\*\*' README.md \
    | sed -E 's/^Zuletzt abgeschlossen: \*\*Patch ([A-Za-z0-9._-]+)\*\*$/\1/' || true;
})"

stand_line="$({
  grep -Eom1 'Stand: \*\*[^*]+\*\*' README.md || true;
})"

if [ -n "${patch_id:-}" ]; then
  patch_file="docs/patches/patch_${patch_id}.md"
  require_exists "$patch_file"
  require_fixed README.md "Zuletzt abgeschlossen: **Patch ${patch_id}**"
  require_regex PROJECT_CHECKLOG.md "Patch ${patch_id}:"
  require_regex docs/patches/PATCHLOG_ROOT.md "- Patch ${patch_id}:"
  require_fixed "$patch_file" "# Patch ${patch_id}"

  checklog_top="$(grep -Eom1 'Patch [A-Za-z0-9._-]+:' PROJECT_CHECKLOG.md | sed -E 's/^Patch ([A-Za-z0-9._-]+):$/\1/')"
  patchlog_top="$(grep -Eom1 -- '- Patch [A-Za-z0-9._-]+:' docs/patches/PATCHLOG_ROOT.md | sed -E 's/^- Patch ([A-Za-z0-9._-]+):$/\1/')"

  [ "$checklog_top" = "$patch_id" ] || {
    echo "PROJECT_CHECKLOG.md top patch (${checklog_top:-<none>}) does not match README patch ${patch_id}" >&2
    exit 1
  }

  [ "$patchlog_top" = "$patch_id" ] || {
    echo "PATCHLOG_ROOT.md top patch (${patchlog_top:-<none>}) does not match README patch ${patch_id}" >&2
    exit 1
  }
elif [ -n "${stand_line:-}" ]; then
  require_fixed docs/INDEX.md "$stand_line"
  require_fixed docs/TESTING_GUIDE.md "$stand_line"
  require_fixed docs/FRESH_CHECKOUT_GREEN_PATH.md "$stand_line"
  require_fixed docs/TODO.md "$stand_line"
  require_fixed docs/reviews/Review.md "$stand_line"

  stand_date="$(printf '%s' "$stand_line" | sed -E 's/^Stand: \*\*([0-9]{4}-[0-9]{2}-[0-9]{2}).*$/\1/')"
  [ -n "$stand_date" ] || {
    echo "Could not determine current stand date from README.md" >&2
    exit 1
  }

  require_regex PROJECT_CHECKLOG.md "^- ${stand_date}:"
  require_regex docs/patches/PATCHLOG_ROOT.md "^- ${stand_date}:"
else
  echo "Could not determine current patch id or stand line from README.md" >&2
  exit 1
fi

require_fixed docs/WORKFLOW_PATCHING.md 'rm -rf <PATCH_PACKAGE_DIR>'
require_fixed docs/WORKFLOW_PATCHING.md 'rm -f <PATCH_ZIP>'
require_fixed docs/INDEX.md '[EDGE_FUNCTIONS_STATUS.md](EDGE_FUNCTIONS_STATUS.md)'
require_exists docs/EDGE_FUNCTIONS_STATUS.md
require_fixed docs/06-build-readiness.md 'K1W1_EDGE_WORKFLOW_JWT'

[ ! -e WORKFLOW_SUPABASE_MD_DEEP_ANALYSE_2026-03-08.md ] || {
  echo "Root analysis artifact should not exist: WORKFLOW_SUPABASE_MD_DEEP_ANALYSE_2026-03-08.md" >&2
  exit 1
}

echo 'Patch/docs sync check passed.'
