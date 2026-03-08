#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$root"

require() {
  local file="$1"
  local pattern="$2"
  if ! grep -Fq -- "$pattern" "$file"; then
    echo "Missing pattern in $file: $pattern" >&2
    exit 1
  fi
}

require README.md 'Letzter Stand im Repo: **Patch 393C**'
require README.md '- Zuletzt: Patch 393C'
require README.md '- Nächster: TBD'
require README.md 'Siehe `docs/patches/patch_393C.md`'
require PROJECT_CHECKLOG.md 'Patch 393C: documentation/checklog/patchlog sync + patch workflow instructions tightened + guard script added'
require docs/patches/PATCHLOG_ROOT.md '- Patch 393C: documentation/checklog/patchlog sync + patch workflow instructions tightened + guard script added'
require docs/patches/patch_393C.md '# Patch 393C'
require docs/WORKFLOW_PATCHING.md 'rm -rf <PATCH_PACKAGE_DIR>'
require docs/WORKFLOW_PATCHING.md 'rm -f <PATCH_ZIP>'

echo 'Patch docs sync check passed.'
