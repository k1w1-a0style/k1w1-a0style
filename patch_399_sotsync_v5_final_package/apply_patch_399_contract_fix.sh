#!/usr/bin/env bash
set -euo pipefail
ROOT="$(pwd)"
PKG_DIR="${ROOT}/patch_399_contract_fix_package"
FILES_DIR="${PKG_DIR}/files"

for rel in   "__tests__/invariants.selection.test.ts"   "docs/patches/PATCHLOG_ROOT.md"   "PROJECT_CHECKLOG.md"   "README.md"   "docs/patches/patch_399.md"
do
  mkdir -p "${ROOT}/$(dirname "$rel")"
  cp "${FILES_DIR}/${rel}" "${ROOT}/${rel}"
  echo "updated: ${rel}"
done

echo
echo "Patch 399 contract fix applied."
echo
echo "Now run:"
echo "bash scripts/check_workflow_template_drift.sh"
echo "npm run typecheck && npm run lint:ci && npm run test:silent"
