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
LEGACY_TEST_EDGE="supabase/functions/test/index.ts"
GH_WORKFLOWS_INFRA="infra/github/workflows.ts"
GH_FILES_INFRA="infra/github/files.ts"
GH_BRANCHOPS_INFRA="infra/github/branchOps.ts"
TRIGGER_WF=".github/workflows/k1w1-triggered-build.yml"
EAS_WF=".github/workflows/eas-build.yml"
EDGE_STATUS_DOC="docs/EDGE_FUNCTIONS_STATUS.md"
BUILD_READINESS_DOC="docs/06-build-readiness.md"
RISK_HOTSPOTS_DOC="docs/04-risk-hotspots.md"
AUTH_SHARED="supabase/functions/_shared/auth.ts"
WIZARD_HELPERS="screens/CredentialsWizardScreen/hooks/credentialHelpers.ts"
WIZARD_HOOK="screens/CredentialsWizardScreen/hooks/useCredentialsWizardScreen.ts"
SIGNING_GATE="screens/EnhancedBuildScreen/hooks/signingKeyGate.ts"
PREVIEW_HOOK="hooks/usePreview.ts"
CI_LITE_MODAL="components/CiLiteHeaderButton/components/CiLiteModal.tsx"
BUILD_START_SERVICE="project/services/buildStartService.ts"
BUILD_POLLING_SERVICE="project/services/buildPollingService.ts"
WORKFLOW_LOGS_HOOK="hooks/useGitHubActionsLogs.ts"
CI_LITE_WORKFLOW_HOOK="components/CiLiteHeaderButton/hooks/useCiLiteWorkflow.ts"
CI_LITE_ENV_LOAD="scripts/ci-lite-env-load.sh"
CI_LITE_SMOKE="scripts/ci-lite-smoke.sh"

ROOT_CONFIG="supabase/config.toml"
KEYSTORE_EXPORT_CONFIG="supabase/functions/android-keystore-export/config.toml"
KEYSTORE_GENERATE_LOCAL_CONFIG="supabase/functions/android-keystore-generate/config.toml"
KEYSTORE_STATUS_LOCAL_CONFIG="supabase/functions/android-keystore-status/config.toml"

for f in "$TRIGGER_EDGE" "$CHECK_EDGE" "$ARTIFACT_EDGE" "$RUNS_EDGE" "$LOGS_EDGE" "$KEYSTORE_EDGE" "$KEYSTORE_GENERATE_EDGE" "$KEYSTORE_STATUS_EDGE" "$DISPATCH_EDGE" "$K1W1_HANDLER_EDGE" "$CREATE_CODESANDBOX_EDGE" "$SAVE_PREVIEW_EDGE" "$LEGACY_TEST_EDGE" "$GH_WORKFLOWS_INFRA" "$GH_FILES_INFRA" "$GH_BRANCHOPS_INFRA" "$TRIGGER_WF" "$EAS_WF" "$EDGE_STATUS_DOC" "$BUILD_READINESS_DOC" "$RISK_HOTSPOTS_DOC" "$AUTH_SHARED" "$WIZARD_HELPERS" "$WIZARD_HOOK" "$SIGNING_GATE" "$PREVIEW_HOOK" "$CI_LITE_MODAL" "$BUILD_START_SERVICE" "$BUILD_POLLING_SERVICE" "$WORKFLOW_LOGS_HOOK" "$CI_LITE_WORKFLOW_HOOK" "$ROOT_CONFIG" "$CI_LITE_ENV_LOAD" "$CI_LITE_SMOKE"; do
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
require_fixed "$TRIGGER_EDGE" 'allowJwtAuthHeaderWithAdmin: true'
require_fixed "$TRIGGER_EDGE" 'requireWorkflowOperatorJwtRole(req, "trigger-eas-build")'
require_fixed "$CHECK_EDGE" 'adminSecretEnv: "K1W1_EDGE_WORKFLOW_ADMIN_KEY"'
require_fixed "$CHECK_EDGE" 'allowJwtAuthHeaderWithAdmin: true'
require_fixed "$CHECK_EDGE" 'requireWorkflowOperatorJwtRole(req, "check-eas-build")'
require_fixed "$ARTIFACT_EDGE" 'adminSecretEnv: "K1W1_EDGE_WORKFLOW_ADMIN_KEY"'
require_fixed "$ARTIFACT_EDGE" 'allowJwtAuthHeaderWithAdmin: true'
require_fixed "$ARTIFACT_EDGE" 'requireWorkflowOperatorJwtRole(req, "github-run-artifact-json")'
require_fixed "$RUNS_EDGE" 'adminSecretEnv: "K1W1_EDGE_WORKFLOW_ADMIN_KEY"'
require_fixed "$RUNS_EDGE" 'allowJwtAuthHeaderWithAdmin: true'
require_fixed "$RUNS_EDGE" 'requireWorkflowOperatorJwtRole(req, "github-workflow-runs")'
require_fixed "$LOGS_EDGE" 'adminSecretEnv: "K1W1_EDGE_WORKFLOW_ADMIN_KEY"'
require_fixed "$LOGS_EDGE" 'allowJwtAuthHeaderWithAdmin: true'
require_fixed "$LOGS_EDGE" 'requireWorkflowOperatorJwtRole(req, "github-workflow-logs")'
require_fixed "$DISPATCH_EDGE" 'adminSecretEnv: "K1W1_EDGE_WORKFLOW_ADMIN_KEY"'
require_fixed "$DISPATCH_EDGE" 'allowJwtAuthHeaderWithAdmin: true'
require_fixed "$DISPATCH_EDGE" 'requireWorkflowOperatorJwtRole(req, "github-workflow-dispatch")'
require_fixed "$DISPATCH_EDGE" 'code: "missing_workflow"'
require_fixed "$DISPATCH_EDGE" "Dispatch is mutation-free"
forbid_fixed "$DISPATCH_EDGE" "ensureWorkflowFileExists("
forbid_fixed "$DISPATCH_EDGE" "bootstrapped:"
forbid_fixed "$DISPATCH_EDGE" "k1w1: add managed workflow"
forbid_fixed "$DISPATCH_EDGE" "k1w1: update managed workflow"
forbid_fixed "$TRIGGER_EDGE" 'ciBearerSecretEnv: "K1W1_EDGE_WORKFLOW_CI_BEARER"'
forbid_fixed "$CHECK_EDGE" 'ciBearerSecretEnv: "K1W1_EDGE_WORKFLOW_CI_BEARER"'
forbid_fixed "$ARTIFACT_EDGE" 'ciBearerSecretEnv: "K1W1_EDGE_WORKFLOW_CI_BEARER"'
forbid_fixed "$RUNS_EDGE" 'ciBearerSecretEnv: "K1W1_EDGE_WORKFLOW_CI_BEARER"'
forbid_fixed "$LOGS_EDGE" 'ciBearerSecretEnv: "K1W1_EDGE_WORKFLOW_CI_BEARER"'
forbid_fixed "$DISPATCH_EDGE" 'ciBearerSecretEnv: "K1W1_EDGE_WORKFLOW_CI_BEARER"'
forbid_fixed "$TRIGGER_EDGE" 'isScopedCiBearerRequest(req, "K1W1_EDGE_WORKFLOW_CI_BEARER")'
forbid_fixed "$CHECK_EDGE" 'isScopedCiBearerRequest(req, "K1W1_EDGE_WORKFLOW_CI_BEARER")'
forbid_fixed "$ARTIFACT_EDGE" 'isScopedCiBearerRequest(req, "K1W1_EDGE_WORKFLOW_CI_BEARER")'
forbid_fixed "$RUNS_EDGE" 'isScopedCiBearerRequest(req, "K1W1_EDGE_WORKFLOW_CI_BEARER")'
forbid_fixed "$LOGS_EDGE" 'isScopedCiBearerRequest(req, "K1W1_EDGE_WORKFLOW_CI_BEARER")'
forbid_fixed "$DISPATCH_EDGE" 'isScopedCiBearerRequest(req, "K1W1_EDGE_WORKFLOW_CI_BEARER")'
require_fixed "$KEYSTORE_EDGE" 'adminSecretEnv: "K1W1_EDGE_ANDROID_KEYSTORE_EXPORT_ADMIN_KEY"'
require_fixed "$KEYSTORE_GENERATE_EDGE" 'allowJwtAuthHeaderWithAdmin: true'
require_fixed "$KEYSTORE_GENERATE_EDGE" 'adminSecretEnv: "K1W1_EDGE_ANDROID_KEYSTORE_EXPORT_ADMIN_KEY"'
require_fixed "$KEYSTORE_GENERATE_EDGE" 'requirePrivilegedOperatorJwtRole(req, "android-keystore-generate")'
forbid_fixed "$KEYSTORE_GENERATE_EDGE" 'safeString(body?.branch) || "main"'
forbid_fixed "$KEYSTORE_GENERATE_EDGE" 'const branch = safeString(body?.branch)'
forbid_fixed "$KEYSTORE_GENERATE_EDGE" 'Invalid branch.'
require_fixed "$KEYSTORE_STATUS_EDGE" 'allowJwtAuthHeaderWithAdmin: true'
require_fixed "$KEYSTORE_STATUS_EDGE" 'adminSecretEnv: "K1W1_EDGE_ANDROID_KEYSTORE_EXPORT_ADMIN_KEY"'
require_fixed "$KEYSTORE_STATUS_EDGE" 'requirePrivilegedOperatorJwtRole(req, "android-keystore-status")'
require_pattern "$K1W1_HANDLER_EDGE" 'requireScopedEdgeAuth\(req,\s*\{'
require_fixed "$K1W1_HANDLER_EDGE" 'adminSecretEnv: "K1W1_EDGE_ADMIN_KEY"'
forbid_fixed "$K1W1_HANDLER_EDGE" 'requireAdminKey(req)'
require_pattern "$CREATE_CODESANDBOX_EDGE" 'requireScopedEdgeAuth\(req,\s*\{'
require_fixed "$CREATE_CODESANDBOX_EDGE" 'adminSecretEnv: "K1W1_EDGE_ADMIN_KEY"'
forbid_fixed "$CREATE_CODESANDBOX_EDGE" 'requireAdminKey(req)'
require_pattern "$SAVE_PREVIEW_EDGE" 'requireScopedEdgeAuth\(req,\s*\{'
require_fixed "$SAVE_PREVIEW_EDGE" 'adminSecretEnv: "K1W1_EDGE_ADMIN_KEY"'
forbid_fixed "$SAVE_PREVIEW_EDGE" 'requireAdminKey(req)'
require_pattern "$LEGACY_TEST_EDGE" 'requireScopedEdgeAuth\(req,\s*\{'
require_fixed "$LEGACY_TEST_EDGE" 'scope: "test"'
require_fixed "$LEGACY_TEST_EDGE" 'adminSecretEnv: "K1W1_EDGE_ADMIN_KEY"'
require_fixed "$LEGACY_TEST_EDGE" 'allowAdmin: true'
forbid_fixed "$LEGACY_TEST_EDGE" 'requireAdminKey(req)'
require_fixed "$LEGACY_TEST_EDGE" 'status: 410'
require_fixed "$LEGACY_TEST_EDGE" 'legacy_test_route_disabled'
require_fixed "$WIZARD_HELPERS" 'Authorization: `Bearer ${userJwt.trim()}`'
require_fixed "$WIZARD_HELPERS" '"x-k1w1-admin-key": adminKey.trim()'
require_fixed "$WIZARD_HOOK" "getAndroidKeystoreExportAdminKey"
require_fixed "$WIZARD_HOOK" "saveAndroidKeystoreExportAdminKey"
forbid_fixed "$WIZARD_HOOK" "getLegacyEdgeAdminKey"
require_fixed "$SIGNING_GATE" "getAndroidKeystoreExportAdminKey"
forbid_fixed "$SIGNING_GATE" "getLegacyEdgeAdminKey"
require_fixed "$PREVIEW_HOOK" 'isLegacyPreviewOperatorModeEnabled'
require_fixed "$PREVIEW_HOOK" 'LEGACY_PREVIEW_OPERATOR_MODE_REQUIRED'
require_fixed "$PREVIEW_HOOK" 'Legacy save_preview ist jetzt ein expliziter Operator-/Maintenance-Vertrag'
require_fixed "$CI_LITE_MODAL" "lokalen Workflow Admin Key (scoped)"
require_fixed "$CI_LITE_MODAL" "Legacy-Compat/Sunset-Vertrag"
require_fixed "$WIZARD_HOOK" "build_admin (oder service_role fuer Server-Caller)"
require_fixed "$BUILD_START_SERVICE" "JWT role=build_admin (oder service_role fuer Server-Caller)"
require_fixed "$BUILD_POLLING_SERVICE" "JWT role=build_admin (oder service_role fuer Server-Caller)"
require_fixed "$WORKFLOW_LOGS_HOOK" "JWT role=build_admin (oder service_role fuer Server-Caller)"
require_fixed "$CI_LITE_WORKFLOW_HOOK" "JWT role=build_admin (oder service_role fuer Server-Caller)"
require_fixed "$WIZARD_HOOK" "Normale eingeloggte Nutzer ohne extern provisionierten build_admin-Claim"
require_fixed "$BUILD_START_SERVICE" "Normale eingeloggte Nutzer ohne extern provisionierten build_admin-Claim"
require_fixed "$BUILD_POLLING_SERVICE" "Normale eingeloggte Nutzer ohne extern provisionierten build_admin-Claim"
require_fixed "$WORKFLOW_LOGS_HOOK" "Normale eingeloggte Nutzer ohne extern provisionierten build_admin-Claim"
require_fixed "$CI_LITE_WORKFLOW_HOOK" "Normale eingeloggte Nutzer ohne extern provisionierten build_admin-Claim"
require_fixed "$WIZARD_HOOK" "ausserhalb dieses Repos per Supabase-User-Claim vergeben"
require_fixed "$BUILD_START_SERVICE" "ausserhalb dieses Repos per Supabase-User-Claim vergeben"
require_fixed "$BUILD_POLLING_SERVICE" "ausserhalb dieses Repos per Supabase-User-Claim vergeben"
require_fixed "$WORKFLOW_LOGS_HOOK" "ausserhalb dieses Repos per Supabase-User-Claim vergeben"
require_fixed "$CI_LITE_WORKFLOW_HOOK" "ausserhalb dieses Repos per Supabase-User-Claim vergeben"
forbid_fixed "$BUILD_START_SERVICE" "JWT role=authenticated"

require_fixed "$BUILD_READINESS_DOC" '### 3.5 Supabase-/Operator-Readiness (verbindliche Reihenfolge)'
require_fixed "$BUILD_READINESS_DOC" '### 3.6 Troubleshooting: typische Symptome → Ursache → naechster Schritt'
require_fixed "$BUILD_READINESS_DOC" 'Operator-Claim zuerst (extern)'
require_fixed "$BUILD_READINESS_DOC" 'DB-/Storage-/Function-Basis pruefen'
require_fixed "$EDGE_STATUS_DOC" '## Operative Reihenfolge (Runbook-Kurzfassung)'
require_fixed "$EDGE_STATUS_DOC" 'Setup-Luecken als Setup-Luecken sichtbar'
require_fixed "docs/TODO.md" 'Supabase-/Operator-Runbook-Restpunkt geschlossen'
require_fixed "docs/TODO.md" 'Externe Betriebs-Restpunkte (bewusst ausserhalb Repo-Code)'
forbid_fixed "$BUILD_POLLING_SERVICE" "JWT role=authenticated"
forbid_fixed "$WORKFLOW_LOGS_HOOK" "JWT role=authenticated"
forbid_fixed "$CI_LITE_WORKFLOW_HOOK" "JWT role=authenticated"


require_fixed "$ROOT_CONFIG" '[functions.android-keystore-generate]'
require_fixed "$ROOT_CONFIG" '[functions.android-keystore-status]'
require_fixed "$ROOT_CONFIG" '[functions.android-keystore-export]'
awk '/^\[functions\.android-keystore-generate\]/{flag=1; next} /^\[functions\./{flag=0} flag && /verify_jwt = true/{found=1} END{exit(found?0:1)}' "$ROOT_CONFIG" \
  || fail "android-keystore-generate must keep verify_jwt = true in $ROOT_CONFIG"
awk '/^\[functions\.android-keystore-status\]/{flag=1; next} /^\[functions\./{flag=0} flag && /verify_jwt = true/{found=1} END{exit(found?0:1)}' "$ROOT_CONFIG" \
  || fail "android-keystore-status must keep verify_jwt = true in $ROOT_CONFIG"
awk '/^\[functions\.android-keystore-export\]/{flag=1; next} /^\[functions\./{flag=0} flag && /verify_jwt = true/{found=1} END{exit(found?0:1)}' "$ROOT_CONFIG" \
  || fail "android-keystore-export must keep verify_jwt = true in $ROOT_CONFIG"
[ ! -f "$KEYSTORE_EXPORT_CONFIG" ] || fail "Split-brain risk: local config must not exist for android-keystore-export ($KEYSTORE_EXPORT_CONFIG)"
[ ! -f "$KEYSTORE_GENERATE_LOCAL_CONFIG" ] || fail "Split-brain risk: local config must not exist for android-keystore-generate ($KEYSTORE_GENERATE_LOCAL_CONFIG)"
[ ! -f "$KEYSTORE_STATUS_LOCAL_CONFIG" ] || fail "Split-brain risk: local config must not exist for android-keystore-status ($KEYSTORE_STATUS_LOCAL_CONFIG)"

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
require_fixed "$EDGE_STATUS_DOC" "build_admin-Claim wird nicht im Repo erzeugt"
require_fixed "$BUILD_READINESS_DOC" "build_admin-Claim wird im Betriebs-/Provisioning-Prozess ausserhalb dieses Repos vergeben"
require_fixed "$BUILD_READINESS_DOC" 'Operator-Runbook/Preflight (extern provisionierter `build_admin`-Vertrag)'
require_fixed "$BUILD_READINESS_DOC" 'Ein normales eingeloggtes User-JWT ohne externen `build_admin`-Claim ist **nicht ausreichend**.'
require_fixed "$RISK_HOTSPOTS_DOC" "Es gibt im Repo keinen internen Claim-Mapper/Grant-Flow fuer build_admin"
require_fixed "$EDGE_STATUS_DOC" '`github-run-artifact-json`'
require_fixed "$EDGE_STATUS_DOC" '`android-keystore-export`'
require_fixed "$EDGE_STATUS_DOC" 'K1W1_EDGE_WORKFLOW_ADMIN_KEY'
require_fixed "$EDGE_STATUS_DOC" 'K1W1_EDGE_ANDROID_KEYSTORE_EXPORT_ADMIN_KEY'

require_fixed "$CI_LITE_ENV_LOAD" 'WORKFLOW_ADMIN="${K1W1_EDGE_WORKFLOW_ADMIN_KEY:-}"'
require_fixed "$CI_LITE_ENV_LOAD" 'Missing required K1W1_EDGE_WORKFLOW_ADMIN_KEY'
forbid_fixed "$CI_LITE_ENV_LOAD" 'K1W1_EDGE_WORKFLOW_ADMIN_KEY:-${ADMIN_KEY:-${K1W1_EDGE_ADMIN_KEY:-}}'
require_fixed "$CI_LITE_ENV_LOAD" 'WORKFLOW_JWT="${K1W1_EDGE_WORKFLOW_JWT:-}"'
require_fixed "$CI_LITE_ENV_LOAD" 'Missing required K1W1_EDGE_WORKFLOW_JWT'

require_fixed "$CI_LITE_SMOKE" 'WORKFLOW_ADMIN="${K1W1_EDGE_WORKFLOW_ADMIN_KEY:-}"'
require_fixed "$CI_LITE_SMOKE" 'Missing required K1W1_EDGE_WORKFLOW_ADMIN_KEY'
forbid_fixed "$CI_LITE_SMOKE" 'K1W1_EDGE_WORKFLOW_ADMIN_KEY:-${ADMIN_KEY:-${K1W1_EDGE_ADMIN_KEY:-}}'
require_fixed "$CI_LITE_SMOKE" 'WORKFLOW_JWT="${K1W1_EDGE_WORKFLOW_JWT:-}"'
require_fixed "$CI_LITE_SMOKE" 'Missing required K1W1_EDGE_WORKFLOW_JWT'
require_fixed "$CI_LITE_SMOKE" '-H "Authorization: Bearer ${WORKFLOW_JWT}"'
forbid_fixed "$CI_LITE_SMOKE" 'REF="${3:-main}"'
forbid_fixed "$CI_LITE_SMOKE" 'Usage: $0 <owner/repo> <workflow.yml> [ref]'
require_fixed "$CI_LITE_SMOKE" 'Usage: $0 <owner/repo> <workflow.yml> <ref>'

echo "Workflow edge contracts look consistent."
