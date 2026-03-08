#!/usr/bin/env bash
set -euo pipefail

fail() {
  echo "[FAIL] $1" >&2
  exit 1
}

require_file() {
  local file="$1"
  [ -f "$file" ] || fail "Missing file: $file"
}

require_fixed() {
  local file="$1"
  local text="$2"
  grep -Fq -- "$text" "$file" || fail "Missing '$text' in $file"
}

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

TRIGGER_EDGE="supabase/functions/trigger-eas-build/index.ts"
CHECK_EDGE="supabase/functions/check-eas-build/index.ts"
ARTIFACT_EDGE="supabase/functions/github-run-artifact-json/index.ts"
RUNS_EDGE="supabase/functions/github-workflow-runs/index.ts"
LOGS_EDGE="supabase/functions/github-workflow-logs/index.ts"
KEYSTORE_EDGE="supabase/functions/android-keystore-export/index.ts"
TRIGGER_WF=".github/workflows/k1w1-triggered-build.yml"
EAS_WF=".github/workflows/eas-build.yml"
EDGE_STATUS_DOC="docs/EDGE_FUNCTIONS_STATUS.md"

for f in "$TRIGGER_EDGE" "$CHECK_EDGE" "$ARTIFACT_EDGE" "$RUNS_EDGE" "$LOGS_EDGE" "$KEYSTORE_EDGE" "$TRIGGER_WF" "$EAS_WF" "$EDGE_STATUS_DOC"; do
  require_file "$f"
done

require_fixed "$TRIGGER_EDGE" 'event_type: "trigger-eas-build"'
require_fixed "$TRIGGER_EDGE" 'job_id: jobId'
require_fixed "$TRIGGER_EDGE" 'build_profile: buildProfile'
require_fixed "$TRIGGER_EDGE" 'buildProfile: buildProfile'
require_fixed "$TRIGGER_EDGE" 'ref: branch ?? null'
require_fixed "$TRIGGER_EDGE" 'branch: branch ?? null'

require_fixed "$TRIGGER_WF" "job_id: \${{ github.event.client_payload.job_id || github.event.inputs.job_id || '' }}"
require_fixed "$TRIGGER_WF" "autofix: \${{ github.event.client_payload.autofix || (github.event_name == 'workflow_dispatch' && inputs.autofix) || false }}"
require_fixed "$TRIGGER_WF" "strict_lockfile: \${{ github.event.client_payload.strict_lockfile || (github.event_name == 'workflow_dispatch' && inputs.strict_lockfile) || 'auto' }}"

require_fixed "$EAS_WF" '/functions/v1/android-keystore-export'
require_fixed "$EAS_WF" 'status:"building"'
require_fixed "$EAS_WF" 'status:"completed"'
require_fixed "$EAS_WF" 'status:"error"'
require_fixed "$EAS_WF" 'source_commit_sha'
require_fixed "$EAS_WF" 'build_url:(process.argv[3]||null)'

require_fixed "$CHECK_EDGE" 'source_commit_sha'
require_fixed "$CHECK_EDGE" 'const urls = {'
require_fixed "$CHECK_EDGE" 'githubRun: githubRunUrl'
require_fixed "$CHECK_EDGE" 'artifacts: artifactsUrl'
require_fixed "$CHECK_EDGE" 'const artifact ='
require_fixed "$CHECK_EDGE" 'job: {'
require_fixed "$CHECK_EDGE" 'artifact,'

require_fixed "$ARTIFACT_EDGE" 'text,'
require_fixed "$ARTIFACT_EDGE" 'json: parsed'
require_fixed "$ARTIFACT_EDGE" 'artifactId: artifact.id'
require_fixed "$ARTIFACT_EDGE" 'artifactName: artifact.name'
require_fixed "$ARTIFACT_EDGE" 'filePath,'

require_fixed "$RUNS_EDGE" 'note: "workflowId not found; returned repo-wide workflow runs instead"'
require_fixed "$LOGS_EDGE" 'logsText: text'
require_fixed "$LOGS_EDGE" 'truncated,'

require_fixed "$KEYSTORE_EDGE" 'alias: parsed.alias'
require_fixed "$KEYSTORE_EDGE" 'keystoreBase64: parsed.keystoreBase64'
require_fixed "$KEYSTORE_EDGE" 'keystorePassword: parsed.keystorePassword'
require_fixed "$KEYSTORE_EDGE" 'keyPassword: parsed.keyPassword'

require_fixed "$EDGE_STATUS_DOC" '`trigger-eas-build`'
require_fixed "$EDGE_STATUS_DOC" '`check-eas-build`'
require_fixed "$EDGE_STATUS_DOC" '`github-run-artifact-json`'
require_fixed "$EDGE_STATUS_DOC" '`android-keystore-export`'

echo "Workflow edge contracts look consistent."
