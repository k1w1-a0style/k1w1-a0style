#!/usr/bin/env bash
set -euo pipefail

# Quick guard against the malformed pattern that broke TS/Jest:
#   import type {
#   import type { Something } ...

echo "[patch_202_2] scanning for broken 'import type' blocks..."

bad_files=$(grep -RIn --exclude-dir=node_modules --exclude-dir=.git -E '^import type \{$' . | cut -d: -f1 | sort -u || true)

if [[ -n "${bad_files}" ]]; then
  echo "[patch_202_2] Found suspicious 'import type {' lines in:"
  echo "${bad_files}"
  echo "[patch_202_2] If your build is still failing, open the files above and ensure no 'import type { ...' appears inside another import block."
  exit 1
fi

echo "[patch_202_2] OK"
