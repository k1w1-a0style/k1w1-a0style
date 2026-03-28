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

require_pattern() {
  local file="$1"
  local pattern="$2"
  grep -Eq -- "$pattern" "$file" || fail "Missing pattern /$pattern/ in $file"
}

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

TRIGGER_EDGE="supabase/functions/trigger-eas-build/index.ts"
CHECK_EDGE="supabase/functions/check-eas-build/index.ts"
ARTIFACT_EDGE="supabase/functions/github-run-artifact-json/index.ts"
RUNS_EDGE="supabase/functions/github-workflow-runs/index.ts"
LOGS_EDGE="supabase/functions/github-workflow-logs/index.ts"
KEYSTORE_EDGE="supabase/functions/android-keystore-export/index.ts"
DISPATCH_EDGE="supabase/functions/github-workflow-dispatch/index.ts"
TRIGGER_WF=".github/workflows/k1w1-triggered-build.yml"
EAS_WF=".github/workflows/eas-build.yml"
EDGE_STATUS_DOC="docs/EDGE_FUNCTIONS_STATUS.md"
AUTH_SHARED="supabase/functions/_shared/auth.ts"

for f in "$TRIGGER_EDGE" "$CHECK_EDGE" "$ARTIFACT_EDGE" "$RUNS_EDGE" "$LOGS_EDGE" "$KEYSTORE_EDGE" "$DISPATCH_EDGE" "$TRIGGER_WF" "$EAS_WF" "$EDGE_STATUS_DOC" "$AUTH_SHARED"; do
  require_file "$f"
done

require_fixed "$TRIGGER_EDGE" 'event_type: "trigger-eas-build"'
require_fixed "$TRIGGER_EDGE" 'job_id: jobId'
require_fixed "$TRIGGER_EDGE" 'build_profile: buildProfile'
require_fixed "$TRIGGER_EDGE" 'buildProfile: buildProfile'
require_fixed "$TRIGGER_EDGE" 'ref: branch ?? null'
require_fixed "$TRIGGER_EDGE" 'branch: branch ?? null'
require_pattern "$TRIGGER_EDGE" 'requireScopedEdgeAuth\(req,\s*\{'
require_pattern "$CHECK_EDGE" 'requireScopedEdgeAuth\(req,\s*\{'
require_pattern "$ARTIFACT_EDGE" 'requireScopedEdgeAuth\(req,\s*\{'
require_pattern "$RUNS_EDGE" 'requireScopedEdgeAuth\(req,\s*\{'
require_pattern "$LOGS_EDGE" 'requireScopedEdgeAuth\(req,\s*\{'
require_pattern "$KEYSTORE_EDGE" 'requireScopedEdgeAuth\(req,\s*\{'
require_pattern "$DISPATCH_EDGE" 'requireScopedEdgeAuth\(req,\s*\{'

require_fixed "$TRIGGER_EDGE" 'adminSecretEnv: "K1W1_EDGE_WORKFLOW_ADMIN_KEY"'
require_fixed "$TRIGGER_EDGE" 'allowCiBearer: true'
require_fixed "$TRIGGER_EDGE" 'ciBearerSecretEnv: "K1W1_EDGE_WORKFLOW_CI_BEARER"'
require_fixed "$TRIGGER_EDGE" 'isScopedCiBearerRequest(req, "K1W1_EDGE_WORKFLOW_CI_BEARER")'
require_fixed "$TRIGGER_EDGE" 'allowJwtAuthHeaderWithAdmin: true'
require_fixed "$TRIGGER_EDGE" 'allowedRoles: ["service_role", "authenticated"]'
require_fixed "$CHECK_EDGE" 'adminSecretEnv: "K1W1_EDGE_WORKFLOW_ADMIN_KEY"'
require_fixed "$CHECK_EDGE" 'allowCiBearer: true'
require_fixed "$CHECK_EDGE" 'ciBearerSecretEnv: "K1W1_EDGE_WORKFLOW_CI_BEARER"'
require_fixed "$CHECK_EDGE" 'isScopedCiBearerRequest(req, "K1W1_EDGE_WORKFLOW_CI_BEARER")'
require_fixed "$CHECK_EDGE" 'allowJwtAuthHeaderWithAdmin: true'
require_fixed "$CHECK_EDGE" 'allowedRoles: ["service_role", "authenticated"]'
require_fixed "$ARTIFACT_EDGE" 'adminSecretEnv: "K1W1_EDGE_WORKFLOW_ADMIN_KEY"'
require_fixed "$ARTIFACT_EDGE" 'allowCiBearer: true'
require_fixed "$ARTIFACT_EDGE" 'ciBearerSecretEnv: "K1W1_EDGE_WORKFLOW_CI_BEARER"'
require_fixed "$ARTIFACT_EDGE" 'isScopedCiBearerRequest(req, "K1W1_EDGE_WORKFLOW_CI_BEARER")'
require_fixed "$ARTIFACT_EDGE" 'allowJwtAuthHeaderWithAdmin: true'
require_fixed "$ARTIFACT_EDGE" 'allowedRoles: ["service_role", "authenticated"]'
require_fixed "$RUNS_EDGE" 'adminSecretEnv: "K1W1_EDGE_WORKFLOW_ADMIN_KEY"'
require_fixed "$RUNS_EDGE" 'allowCiBearer: true'
require_fixed "$RUNS_EDGE" 'ciBearerSecretEnv: "K1W1_EDGE_WORKFLOW_CI_BEARER"'
require_fixed "$RUNS_EDGE" 'isScopedCiBearerRequest(req, "K1W1_EDGE_WORKFLOW_CI_BEARER")'
require_fixed "$RUNS_EDGE" 'allowJwtAuthHeaderWithAdmin: true'
require_fixed "$RUNS_EDGE" 'allowedRoles: ["service_role", "authenticated"]'
require_fixed "$LOGS_EDGE" 'adminSecretEnv: "K1W1_EDGE_WORKFLOW_ADMIN_KEY"'
require_fixed "$LOGS_EDGE" 'allowCiBearer: true'
require_fixed "$LOGS_EDGE" 'ciBearerSecretEnv: "K1W1_EDGE_WORKFLOW_CI_BEARER"'
require_fixed "$LOGS_EDGE" 'isScopedCiBearerRequest(req, "K1W1_EDGE_WORKFLOW_CI_BEARER")'
require_fixed "$LOGS_EDGE" 'allowJwtAuthHeaderWithAdmin: true'
require_fixed "$LOGS_EDGE" 'allowedRoles: ["service_role", "authenticated"]'
require_fixed "$DISPATCH_EDGE" 'adminSecretEnv: "K1W1_EDGE_WORKFLOW_ADMIN_KEY"'
require_fixed "$DISPATCH_EDGE" 'allowCiBearer: true'
require_fixed "$DISPATCH_EDGE" 'ciBearerSecretEnv: "K1W1_EDGE_WORKFLOW_CI_BEARER"'
require_fixed "$DISPATCH_EDGE" 'isScopedCiBearerRequest(req, "K1W1_EDGE_WORKFLOW_CI_BEARER")'
require_fixed "$DISPATCH_EDGE" 'allowJwtAuthHeaderWithAdmin: true'
require_fixed "$DISPATCH_EDGE" 'allowedRoles: ["service_role", "authenticated"]'
require_fixed "$KEYSTORE_EDGE" 'allowCiBearer: false'
require_fixed "$KEYSTORE_EDGE" 'adminSecretEnv: "K1W1_EDGE_ANDROID_KEYSTORE_EXPORT_ADMIN_KEY"'

require_fixed "$AUTH_SHARED" 'export function requireScopedEdgeAuth(req: Request, cfg: ScopedEdgeAuthConfig): Response | null {'
require_fixed "$AUTH_SHARED" '"Missing required auth secrets for this Edge Function."'
require_fixed "$AUTH_SHARED" '"Unauthorized: send either admin key OR bearer token, not both."'
require_fixed "$AUTH_SHARED" '"Unauthorized: missing authentication header."'

require_fixed "$TRIGGER_WF" "job_id: \${{ steps.resolve.outputs.job_id }}"
require_fixed "$TRIGGER_WF" "autofix: \${{ steps.resolve.outputs.autofix }}"
require_fixed "$TRIGGER_WF" "strict_lockfile: \${{ steps.resolve.outputs.strict_lockfile }}"
require_fixed "$TRIGGER_WF" "job_id: \${{ needs.resolve.outputs.job_id }}"
require_fixed "$TRIGGER_WF" "autofix: \${{ fromJSON(needs.resolve.outputs.autofix) }}"
require_fixed "$TRIGGER_WF" "strict_lockfile: \${{ needs.resolve.outputs.strict_lockfile }}"

require_fixed "$EAS_WF" '/functions/v1/android-keystore-export'
require_fixed "$EAS_WF" 'K1W1_EDGE_ANDROID_KEYSTORE_EXPORT_ADMIN_KEY'
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

require_fixed "$RUNS_EDGE" 'error: "workflowId not found"'
require_fixed "$LOGS_EDGE" 'logsText: text'
require_fixed "$LOGS_EDGE" 'truncated,'

require_fixed "$KEYSTORE_EDGE" 'alias: parsed.alias'
require_fixed "$KEYSTORE_EDGE" 'keystoreBase64: parsed.keystoreBase64'
require_fixed "$KEYSTORE_EDGE" 'keystorePassword: parsed.keystorePassword'
require_fixed "$KEYSTORE_EDGE" 'keyPassword: parsed.keyPassword'

require_fixed "$EDGE_STATUS_DOC" '`trigger-eas-build`'
require_fixed "$EDGE_STATUS_DOC" '`check-eas-build`'
require_fixed "$EDGE_STATUS_DOC" '`github-workflow-dispatch`'
require_fixed "$EDGE_STATUS_DOC" '`github-run-artifact-json`'
require_fixed "$EDGE_STATUS_DOC" '`android-keystore-export`'
require_fixed "$EDGE_STATUS_DOC" 'K1W1_EDGE_WORKFLOW_ADMIN_KEY'
require_fixed "$EDGE_STATUS_DOC" 'K1W1_EDGE_ANDROID_KEYSTORE_EXPORT_ADMIN_KEY'

echo "Workflow edge contracts look consistent."
