#!/usr/bin/env bash
set -u

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

CHECK_NAMES=()
CHECK_STATUS=()
CHECK_NOTE=()
REQUIRED_FAIL=0
OPTIONAL_SKIP=0

trim() {
  local input="$1"
  # shellcheck disable=SC2001
  echo "$(echo "$input" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')"
}

run_check() {
  local name="$1"
  local mode="$2"
  local hint="${3:-}"
  shift 3
  local cmd=("$@")

  echo "[release:ready] $name"
  local output
  output="$(${cmd[@]} 2>&1)"
  local exit_code=$?

  local status="PASS"
  local note="${hint:-ok}"

  if [[ $exit_code -ne 0 ]]; then
    status="FAIL"
    note="$(trim "$(echo "$output" | tail -n1)")"
    REQUIRED_FAIL=1
  fi

  CHECK_NAMES+=("$name")
  CHECK_STATUS+=("$status")
  CHECK_NOTE+=("$note")

  if [[ "$status" == "FAIL" ]]; then
    echo "[release:ready] FAIL: $name"
    echo "$(echo "$output" | tail -n20)"
  elif [[ "$status" == "SKIP" ]]; then
    echo "[release:ready] SKIP: $name (${note})"
  else
    echo "[release:ready] PASS: $name"
  fi
}

version_check() {
  node - <<'NODE'
const fs = require('fs');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const engines = pkg.engines || {};
const nodeReq = engines.node || '';
const npmReq = engines.npm || '';
const nodeVersion = process.version.replace(/^v/, '');
const npmVersion = (process.env.npm_config_user_agent || '').match(/npm\/(\d+\.\d+\.\d+)/)?.[1] || '';

function parse(v){ return v.split('.').map((n)=>parseInt(n,10)); }
function gte(a,b){
  const pa=parse(a), pb=parse(b);
  for(let i=0;i<3;i++){ const av=pa[i]||0, bv=pb[i]||0; if(av>bv) return true; if(av<bv) return false; }
  return true;
}
function minFromRange(range){
  const m=(range||'').match(/(\d+\.\d+\.\d+|\d+\.\d+|\d+)/);
  if(!m) return null;
  const parts=m[1].split('.');
  while(parts.length<3) parts.push('0');
  return parts.join('.');
}

if (nodeReq) {
  const min = minFromRange(nodeReq);
  if (min && !gte(nodeVersion, min)) {
    console.error(`Node version too low: ${nodeVersion} < ${min}`);
    process.exit(1);
  }
}
if (npmReq) {
  if (!npmVersion) {
    console.error('Could not detect npm version');
    process.exit(1);
  }
  const min = minFromRange(npmReq);
  if (min && !gte(npmVersion, min)) {
    console.error(`npm version too low: ${npmVersion} < ${min}`);
    process.exit(1);
  }
}
console.log('Engine versions satisfy package.json constraints');
NODE
}

lockfile_check() {
  npm ci --dry-run --ignore-scripts >/dev/null
}

preview_prod_env_defaults_check() {
  npm run -s test:silent -- --runInBand __tests__/patch514.buildPreviewEnvSharedHelpers.invariants.test.ts
}

android_backup_status_check() {
  npm run -s test:silent -- --runInBand __tests__/androidManifest.backup.invariants.test.ts
}

live_edge_check() {
  bash scripts/check_edge_live_contracts.sh
}

run_check "Node/npm version" required "package.json engines" version_check
run_check "npm lockfile consistency" required "npm ci --dry-run" lockfile_check
run_check "TypeScript App" required "npm run typecheck" npm run -s typecheck
run_check "TypeScript Edge Functions" required "npm run typecheck:edge" npm run -s typecheck:edge
run_check "Lint" required "npm run lint:ci" npm run -s lint:ci
run_check "Tests" required "npm run test:silent" npm run -s test:silent
run_check "verify:release" required "existing release guard script" npm run -s verify:release
run_check "Preview Production ENV Defaults" required "preview env invariant" preview_prod_env_defaults_check
run_check "Android Backup Status" required "manifest backup invariant" android_backup_status_check
run_check "GitHub Actions permission sanity checks" required "managed workflows guard" bash scripts/check_managed_workflows.sh
run_check "Supabase function config sanity checks" required "workflow/edge contract guard" bash scripts/check_workflow_edge_contracts.sh

if [[ -n "${EDGE_BASE_URL:-}" && -n "${EDGE_OPERATOR_JWT:-}" ]]; then
  run_check "Optionale Live-Checks" optional "live contracts with env" live_edge_check
else
  CHECK_NAMES+=("Optionale Live-Checks")
  CHECK_STATUS+=("SKIP")
  CHECK_NOTE+=("ENV fehlt: EDGE_BASE_URL und/oder EDGE_OPERATOR_JWT (Werte werden nicht geloggt)")
  OPTIONAL_SKIP=1
  echo "[release:ready] SKIP: Optionale Live-Checks (ENV fehlt)"
fi

echo
echo "Check | Status | Hinweis"
echo "--- | --- | ---"
for i in "${!CHECK_NAMES[@]}"; do
  echo "${CHECK_NAMES[$i]} | ${CHECK_STATUS[$i]} | ${CHECK_NOTE[$i]}"
done

echo
if [[ "$REQUIRED_FAIL" -eq 1 ]]; then
  echo "🔴 ROT: Mindestens ein Pflichtcheck ist fehlgeschlagen."
  exit 1
fi

if [[ "$OPTIONAL_SKIP" -eq 1 ]]; then
  echo "🟡 GELB: Pflichtchecks bestanden, optionale Live-Checks wurden wegen fehlender ENV nicht gestartet."
  exit 0
fi

echo "🟢 GRÜN: Alle Pflichtchecks bestanden."
exit 0
