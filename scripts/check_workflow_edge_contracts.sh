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

forbid_fixed() {
  local file="$1"
  local text="$2"
  ! grep -Fq -- "$text" "$file" || fail "Forbidden '$text' still present in $file"
}

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

TRIGGER_EDGE="supabase/functions/trigger-eas-build/index.ts"
CHECK_EDGE="supabase/functions/check-eas-build/index.ts"
ARTIFACT_EDGE="supabase/functions/github-run-artifact-json/index.ts"
RUNS_EDGE="supabase/functions/github-workflow-runs/index.ts"
LOGS_EDGE="supabase/functions/github-workflow-logs/index.ts"
KEYSTORE_EDGE="supabase/functions/android-keystore-export/index.ts"
KEYSTORE_GENERATE_EDGE="supabase/functions/android-keystore-generate/index.ts"
KEYSTORE_STATUS_EDGE="supabase/functions/android-keystore-status/index.ts"
DISPATCH_EDGE="supabase/functions/github-workflow-dispatch/index.ts"
K1W1_HANDLER_EDGE="supabase/functions/k1w1-handler/index.ts"
CREATE_CODESANDBOX_EDGE="supabase/functions/create_codesandbox/index.ts"
SAVE_PREVIEW_EDGE="supabase/functions/save_preview/index.ts"
GH_WORKFLOWS_INFRA="infra/github/workflows.ts"
GH_FILES_INFRA="infra/github/files.ts"
GH_BRANCHOPS_INFRA="infra/github/branchOps.ts"
TRIGGER_WF=".github/workflows/k1w1-triggered-build.yml"
EAS_WF=".github/workflows/eas-build.yml"
EDGE_STATUS_DOC="docs/EDGE_FUNCTIONS_STATUS.md"
AUTH_SHARED="supabase/functions/_shared/auth.ts"
WIZARD_HELPERS="screens/CredentialsWizardScreen/hooks/credentialHelpers.ts"
WIZARD_HOOK="screens/CredentialsWizardScreen/hooks/useCredentialsWizardScreen.ts"

for f in "$TRIGGER_EDGE" "$CHECK_EDGE" "$ARTIFACT_EDGE" "$RUNS_EDGE" "$LOGS_EDGE" "$KEYSTORE_EDGE" "$KEYSTORE_GENERATE_EDGE" "$KEYSTORE_STATUS_EDGE" "$DISPATCH_EDGE" "$K1W1_HANDLER_EDGE" "$CREATE_CODESANDBOX_EDGE" "$SAVE_PREVIEW_EDGE" "$GH_WORKFLOWS_INFRA" "$GH_FILES_INFRA" "$GH_BRANCHOPS_INFRA" "$TRIGGER_WF" "$EAS_WF" "$EDGE_STATUS_DOC" "$AUTH_SHARED" "$WIZARD_HELPERS" "$WIZARD_HOOK"; do
  require_file "$f"
done

require_fixed "$TRIGGER_EDGE" 'event_type: "trigger-eas-build"'
require_fixed "$TRIGGER_EDGE" 'job_id: jobId'
require_fixed "$TRIGGER_EDGE" 'build_profile: buildProfile'
require_fixed "$TRIGGER_EDGE" 'buildProfile: buildProfile'
require_fixed "$TRIGGER_EDGE" 'ref: branch'
require_fixed "$TRIGGER_EDGE" 'branch,'
require_fixed "$TRIGGER_EDGE" 'if (!isAllowedRef(branch)) {'
require_pattern "$TRIGGER_EDGE" 'requireScopedEdgeAuth\(req,\s*\{'
require_pattern "$CHECK_EDGE" 'requireScopedEdgeAuth\(req,\s*\{'
require_pattern "$ARTIFACT_EDGE" 'requireScopedEdgeAuth\(req,\s*\{'
require_pattern "$RUNS_EDGE" 'requireScopedEdgeAuth\(req,\s*\{'
require_pattern "$LOGS_EDGE" 'requireScopedEdgeAuth\(req,\s*\{'
require_pattern "$KEYSTORE_EDGE" 'requireScopedEdgeAuth\(req,\s*\{'
require_pattern "$KEYSTORE_GENERATE_EDGE" 'requireScopedEdgeAuth\(req,\s*\{'
require_pattern "$KEYSTORE_STATUS_EDGE" 'requireScopedEdgeAuth\(req,\s*\{'
require_pattern "$DISPATCH_EDGE" 'requireScopedEdgeAuth\(req,\s*\{'

require_fixed "$TRIGGER_EDGE" 'adminSecretEnv: "K1W1_EDGE_WORKFLOW_ADMIN_KEY"'
require_fixed "$TRIGGER_EDGE" 'allowCiBearer: true'
require_pattern "$TRIGGER_EDGE" 'if\s*\(!usedCiBearer\)\s*\{'
require_fixed "$TRIGGER_EDGE" 'ciBearerSecretEnv: "K1W1_EDGE_WORKFLOW_CI_BEARER"'
require_fixed "$TRIGGER_EDGE" 'isScopedCiBearerRequest(req, "K1W1_EDGE_WORKFLOW_CI_BEARER")'
require_fixed "$TRIGGER_EDGE" 'allowJwtAuthHeaderWithAdmin: true'
require_fixed "$TRIGGER_EDGE" 'requireWorkflowOperatorJwtRole(req, "trigger-eas-build")'
! grep -Fq -- 'allowCiBearer: false' "$TRIGGER_EDGE" || fail "Found deprecated 'allowCiBearer: false' in $TRIGGER_EDGE"
require_fixed "$CHECK_EDGE" 'adminSecretEnv: "K1W1_EDGE_WORKFLOW_ADMIN_KEY"'
require_fixed "$CHECK_EDGE" 'allowCiBearer: true'
require_pattern "$CHECK_EDGE" 'if\s*\(!usedCiBearer\)\s*\{'
require_fixed "$CHECK_EDGE" 'ciBearerSecretEnv: "K1W1_EDGE_WORKFLOW_CI_BEARER"'
require_fixed "$CHECK_EDGE" 'isScopedCiBearerRequest(req, "K1W1_EDGE_WORKFLOW_CI_BEARER")'
require_fixed "$CHECK_EDGE" 'allowJwtAuthHeaderWithAdmin: true'
require_fixed "$CHECK_EDGE" 'requireWorkflowOperatorJwtRole(req, "check-eas-build")'
! grep -Fq -- 'allowCiBearer: false' "$CHECK_EDGE" || fail "Found deprecated 'allowCiBearer: false' in $CHECK_EDGE"
require_fixed "$ARTIFACT_EDGE" 'adminSecretEnv: "K1W1_EDGE_WORKFLOW_ADMIN_KEY"'
require_fixed "$ARTIFACT_EDGE" 'allowCiBearer: true'
require_pattern "$ARTIFACT_EDGE" 'if\s*\(!usedCiBearer\)\s*\{'
require_fixed "$ARTIFACT_EDGE" 'ciBearerSecretEnv: "K1W1_EDGE_WORKFLOW_CI_BEARER"'
require_fixed "$ARTIFACT_EDGE" 'isScopedCiBearerRequest(req, "K1W1_EDGE_WORKFLOW_CI_BEARER")'
require_fixed "$ARTIFACT_EDGE" 'allowJwtAuthHeaderWithAdmin: true'
require_fixed "$ARTIFACT_EDGE" 'requireWorkflowOperatorJwtRole(req, "github-run-artifact-json")'
! grep -Fq -- 'allowCiBearer: false' "$ARTIFACT_EDGE" || fail "Found deprecated 'allowCiBearer: false' in $ARTIFACT_EDGE"
require_fixed "$RUNS_EDGE" 'adminSecretEnv: "K1W1_EDGE_WORKFLOW_ADMIN_KEY"'
require_fixed "$RUNS_EDGE" 'allowCiBearer: true'
require_pattern "$RUNS_EDGE" 'if\s*\(!usedCiBearer\)\s*\{'
require_fixed "$RUNS_EDGE" 'ciBearerSecretEnv: "K1W1_EDGE_WORKFLOW_CI_BEARER"'
require_fixed "$RUNS_EDGE" 'isScopedCiBearerRequest(req, "K1W1_EDGE_WORKFLOW_CI_BEARER")'
require_fixed "$RUNS_EDGE" 'allowJwtAuthHeaderWithAdmin: true'
require_fixed "$RUNS_EDGE" 'requireWorkflowOperatorJwtRole(req, "github-workflow-runs")'
! grep -Fq -- 'allowCiBearer: false' "$RUNS_EDGE" || fail "Found deprecated 'allowCiBearer: false' in $RUNS_EDGE"
require_fixed "$LOGS_EDGE" 'adminSecretEnv: "K1W1_EDGE_WORKFLOW_ADMIN_KEY"'
require_fixed "$LOGS_EDGE" 'allowCiBearer: true'
require_pattern "$LOGS_EDGE" 'if\s*\(!usedCiBearer\)\s*\{'
require_fixed "$LOGS_EDGE" 'ciBearerSecretEnv: "K1W1_EDGE_WORKFLOW_CI_BEARER"'
require_fixed "$LOGS_EDGE" 'isScopedCiBearerRequest(req, "K1W1_EDGE_WORKFLOW_CI_BEARER")'
require_fixed "$LOGS_EDGE" 'allowJwtAuthHeaderWithAdmin: true'
require_fixed "$LOGS_EDGE" 'requireWorkflowOperatorJwtRole(req, "github-workflow-logs")'
! grep -Fq -- 'allowCiBearer: false' "$LOGS_EDGE" || fail "Found deprecated 'allowCiBearer: false' in $LOGS_EDGE"
require_fixed "$DISPATCH_EDGE" 'adminSecretEnv: "K1W1_EDGE_WORKFLOW_ADMIN_KEY"'
require_fixed "$DISPATCH_EDGE" 'allowCiBearer: true'
require_pattern "$DISPATCH_EDGE" 'if\s*\(!usedCiBearer\)\s*\{'
require_fixed "$DISPATCH_EDGE" 'ciBearerSecretEnv: "K1W1_EDGE_WORKFLOW_CI_BEARER"'
require_fixed "$DISPATCH_EDGE" 'isScopedCiBearerRequest(req, "K1W1_EDGE_WORKFLOW_CI_BEARER")'
require_fixed "$DISPATCH_EDGE" 'allowJwtAuthHeaderWithAdmin: true'
require_fixed "$DISPATCH_EDGE" 'requireWorkflowOperatorJwtRole(req, "github-workflow-dispatch")'
! grep -Fq -- 'allowCiBearer: false' "$DISPATCH_EDGE" || fail "Found deprecated 'allowCiBearer: false' in $DISPATCH_EDGE"
require_fixed "$KEYSTORE_EDGE" 'allowCiBearer: false'
require_fixed "$KEYSTORE_EDGE" 'adminSecretEnv: "K1W1_EDGE_ANDROID_KEYSTORE_EXPORT_ADMIN_KEY"'
require_fixed "$KEYSTORE_GENERATE_EDGE" 'allowCiBearer: false'
require_fixed "$KEYSTORE_GENERATE_EDGE" 'allowJwtAuthHeaderWithAdmin: true'
require_fixed "$KEYSTORE_GENERATE_EDGE" 'adminSecretEnv: "K1W1_EDGE_ANDROID_KEYSTORE_EXPORT_ADMIN_KEY"'
require_fixed "$KEYSTORE_GENERATE_EDGE" 'requirePrivilegedOperatorJwtRole(req, "android-keystore-generate")'
forbid_fixed "$KEYSTORE_GENERATE_EDGE" 'safeString(body?.branch) || "main"'
forbid_fixed "$KEYSTORE_GENERATE_EDGE" 'const branch = safeString(body?.branch)'
forbid_fixed "$KEYSTORE_GENERATE_EDGE" 'Invalid branch.'
require_fixed "$KEYSTORE_STATUS_EDGE" 'allowCiBearer: false'
require_fixed "$KEYSTORE_STATUS_EDGE" 'allowJwtAuthHeaderWithAdmin: true'
require_fixed "$KEYSTORE_STATUS_EDGE" 'adminSecretEnv: "K1W1_EDGE_ANDROID_KEYSTORE_EXPORT_ADMIN_KEY"'
require_fixed "$KEYSTORE_STATUS_EDGE" 'requirePrivilegedOperatorJwtRole(req, "android-keystore-status")'
require_pattern "$K1W1_HANDLER_EDGE" 'requireScopedEdgeAuth\(req,\s*\{'
require_fixed "$K1W1_HANDLER_EDGE" 'adminSecretEnv: "K1W1_EDGE_ADMIN_KEY"'
require_fixed "$K1W1_HANDLER_EDGE" 'allowCiBearer: false'
forbid_fixed "$K1W1_HANDLER_EDGE" 'requireAdminKey(req)'
require_pattern "$CREATE_CODESANDBOX_EDGE" 'requireScopedEdgeAuth\(req,\s*\{'
require_fixed "$CREATE_CODESANDBOX_EDGE" 'adminSecretEnv: "K1W1_EDGE_ADMIN_KEY"'
require_fixed "$CREATE_CODESANDBOX_EDGE" 'allowCiBearer: false'
forbid_fixed "$CREATE_CODESANDBOX_EDGE" 'requireAdminKey(req)'
require_pattern "$SAVE_PREVIEW_EDGE" 'requireScopedEdgeAuth\(req,\s*\{'
require_fixed "$SAVE_PREVIEW_EDGE" 'adminSecretEnv: "K1W1_EDGE_ADMIN_KEY"'
require_fixed "$SAVE_PREVIEW_EDGE" 'allowCiBearer: false'
forbid_fixed "$SAVE_PREVIEW_EDGE" 'requireAdminKey(req)'
require_fixed "$WIZARD_HELPERS" 'Authorization: `Bearer ${userJwt.trim()}`'
require_fixed "$WIZARD_HELPERS" '"x-k1w1-admin-key": adminKey.trim()'
require_fixed "$WIZARD_HOOK" "getAndroidKeystoreExportAdminKey"
require_fixed "$WIZARD_HOOK" "saveAndroidKeystoreExportAdminKey"
require_fixed "$WIZARD_HOOK" "Authorization: Bearer <jwt>"

require_fixed "$AUTH_SHARED" 'export function requireScopedEdgeAuth(req: Request, cfg: ScopedEdgeAuthConfig): Response | null {'
require_fixed "$AUTH_SHARED" "export const WORKFLOW_OPERATOR_ALLOWED_ROLES = [\"service_role\", \"build_admin\"] as const;"
require_fixed "$AUTH_SHARED" "export async function requireWorkflowOperatorJwtRole(req: Request, scope: string): Promise<Response | null> {"
require_fixed "$AUTH_SHARED" "export const PRIVILEGED_OPERATOR_ALLOWED_ROLES = [\"service_role\", \"build_admin\"] as const;"
require_fixed "$AUTH_SHARED" "export async function requirePrivilegedOperatorJwtRole(req: Request, scope: string): Promise<Response | null> {"
require_fixed "$AUTH_SHARED" 'const getSigningAdminSecret = (): string | null =>'
require_fixed "$AUTH_SHARED" "export function requireSigningAdminKey(req: Request): Response | null {"
require_fixed "$AUTH_SHARED" 'missing: ["K1W1_EDGE_ADMIN_KEY"]'
forbid_fixed "$AUTH_SHARED" "K1W1_EDGE_ADMIN_KEY|SIGNING_ADMIN_KEY"
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

require_fixed "$GH_WORKFLOWS_INFRA" 'if (!targetRef) throw new Error("Explicit branch/ref is required.");'
forbid_fixed "$GH_WORKFLOWS_INFRA" 'ref = "main"'
require_fixed "$GH_FILES_INFRA" 'if (!targetBranch) throw new Error("Explicit branch/ref is required.");'
forbid_fixed "$GH_FILES_INFRA" 'targetBranch = "main"'
forbid_fixed "$GH_FILES_INFRA" '|| "main"'
require_fixed "$GH_BRANCHOPS_INFRA" 'throw new Error("Repository default_branch is missing.");'
forbid_fixed "$GH_BRANCHOPS_INFRA" 'default_branch || "main"'

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
