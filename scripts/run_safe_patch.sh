#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<USAGE
Usage:
  scripts/run_safe_patch.sh <patch-zip> <package-dir> <apply-script> [extra-check ...]

Example:
  scripts/run_safe_patch.sh \
    k1w1-patch-401-context-guards-r1.zip \
    patch_401_context_guards_r1_package \
    apply_patch_401_context_guards_r1.sh

What it does:
  1) unzip patch zip into repo root
  2) delete the zip immediately
  3) run the patch apply script
  4) delete the extracted patch package before typecheck/lint/tests
  5) run npm run typecheck && npm run lint:ci && npm run test:silent
  6) optional extra checks are run after the standard checks
USAGE
}

if [[ $# -lt 3 ]]; then
  usage
  exit 1
fi

PATCH_ZIP="$1"
PACKAGE_DIR="$2"
APPLY_SCRIPT_NAME="$3"
shift 3
EXTRA_CHECKS=("$@")

REPO_ROOT="$(pwd)"
PACKAGE_PATH="${REPO_ROOT}/${PACKAGE_DIR}"
APPLY_PATH="${PACKAGE_PATH}/${APPLY_SCRIPT_NAME}"

cleanup() {
  rm -rf -- "${PACKAGE_PATH}" 2>/dev/null || true
}
trap cleanup EXIT

if [[ ! -f "${PATCH_ZIP}" ]]; then
  echo "[FAIL] Patch zip not found: ${PATCH_ZIP}" >&2
  exit 1
fi

rm -rf -- "${PACKAGE_PATH}"
unzip -o "${PATCH_ZIP}" -d .
rm -f -- "${PATCH_ZIP}"

if [[ ! -f "${APPLY_PATH}" ]]; then
  echo "[FAIL] Apply script not found after unzip: ${APPLY_PATH}" >&2
  exit 1
fi

chmod +x "${APPLY_PATH}"
"${APPLY_PATH}"

# Important: remove extracted patch package before TypeScript/Jest scan the repo.
rm -rf -- "${PACKAGE_PATH}"

npm run typecheck
npm run lint:ci
npm run test:silent

if [[ ${#EXTRA_CHECKS[@]} -gt 0 ]]; then
  for check_cmd in "${EXTRA_CHECKS[@]}"; do
    echo "[info] running extra check: ${check_cmd}"
    bash -lc "${check_cmd}"
  done
fi

echo
echo "Safe patch run completed."
