import { handleCors, jsonResponse, errorResponse } from "../_shared/cors.ts";
import { requireScopedEdgeAuth, rateLimit } from "../_shared/auth.ts";
import { githubHeaders, getGithubToken, GITHUB_API_BASE } from "../_shared/github.ts";
import { fetchWithTimeout } from "../_shared/fetchWithTimeout.ts";
import { sanitizeErrorText, sanitizeGitHubFailure } from "../_shared/errorSanitization.ts";
import {
  parseJsonBody,
  validateGithubWorkflowDispatchRequest,
} from "../_shared/validation.ts";

// Minimal SoT workflow templates for bootstrapping when a repo is missing managed workflows.
// Kept inside the edge function so it can run independently from the app bundle.
const WORKFLOW_TEMPLATES: Record<string, string> = {
  "k1w1-ci-lite.yml": `
# managed-by: k1w1
# workflow-version: 399
name: K1W1 CI Lite (Lint + Typecheck + Expo Preflight)

run-name: >-
  CI Lite\${{ (github.event.client_payload.job_id || inputs.job_id) && format(' [{0}]', github.event.client_payload.job_id || inputs.job_id) || '' }} • \${{ github.event.client_payload.branch || github.event.client_payload.ref || inputs.ref || github.ref_name }}

on:
  repository_dispatch:
    types: [trigger-ci-lite]
  workflow_dispatch:
    inputs:
      ref:
        description: "Branch/Ref to check (e.g. work, main, dev)"
        required: true
      job_id:
        description: "Client job id (UUID) for log correlation"
        required: false
        default: ""

permissions:
  contents: read

concurrency:
  group: k1w1-ci-lite-\${{ github.event.client_payload.branch || github.event.client_payload.ref || inputs.ref || github.ref_name }}
  cancel-in-progress: false

jobs:
  checks:
    name: Lint + Typecheck + Expo preflight
    runs-on: ubuntu-latest
    timeout-minutes: 20
    permissions:
      contents: read

    env:
      ALLOWED_REF_REGEX: "^(work|codex|main|dev|develop|release/.+|feature/.+|hotfix/.+)$"
      WORKFLOW_VERSION: "399"

    steps:
      - name: Determine target ref
        id: target_ref
        uses: ./.github/actions/determine-ref
        with:
          payload_branch: \${{ github.event.client_payload.branch || '' }}
          payload_ref: \${{ github.event.client_payload.ref || '' }}
          input_ref: \${{ inputs.ref || '' }}
          github_ref_name: \${{ github.ref_name || '' }}
          default_ref: work
          allowed_ref_regex: \${{ env.ALLOWED_REF_REGEX }}

      - name: Export run metadata
        shell: bash
        run: |
          set -euo pipefail
          echo "TARGET_REF=\${{ steps.target_ref.outputs.checkout_ref }}" >> "$GITHUB_ENV"
          echo "JOB_ID=\${{ github.event.client_payload.job_id || inputs.job_id || '' }}" >> "$GITHUB_ENV"
          echo "TRIGGER_MODE=\${{ github.event_name }}" >> "$GITHUB_ENV"
          echo "SOURCE_WORKFLOW=\${{ github.event.client_payload.source_workflow || '' }}" >> "$GITHUB_ENV"
          echo "SOURCE_RUN_ID=\${{ github.event.client_payload.source_run_id || '' }}" >> "$GITHUB_ENV"
          echo "SOURCE_SHA=\${{ github.event.client_payload.source_sha || '' }}" >> "$GITHUB_ENV"

      - name: Run info
        shell: bash
        run: |
          set -euo pipefail
          echo "CI Lite start (job_id=\${JOB_ID:-}, ref=\${TARGET_REF:-}, trigger=\${TRIGGER_MODE:-})"

      - name: Checkout
        uses: actions/checkout@34e114876b0b11c390a56381ad16ebd13914f8d5 # v4.3.1
        with:
          ref: \${{ env.TARGET_REF }}
          fetch-depth: 0

      - name: Detect package manager + lockfile
        id: lock
        shell: bash
        run: |
          set -euo pipefail
          if [ -f package-lock.json ]; then
            echo "has_lockfile=true" >> "$GITHUB_OUTPUT"
            echo "lockfile_path=package-lock.json" >> "$GITHUB_OUTPUT"
            echo "package_manager=npm" >> "$GITHUB_OUTPUT"
            echo "cache_kind=npm" >> "$GITHUB_OUTPUT"
          elif [ -f npm-shrinkwrap.json ]; then
            echo "has_lockfile=true" >> "$GITHUB_OUTPUT"
            echo "lockfile_path=npm-shrinkwrap.json" >> "$GITHUB_OUTPUT"
            echo "package_manager=npm" >> "$GITHUB_OUTPUT"
            echo "cache_kind=npm" >> "$GITHUB_OUTPUT"
          elif [ -f yarn.lock ]; then
            echo "has_lockfile=true" >> "$GITHUB_OUTPUT"
            echo "lockfile_path=yarn.lock" >> "$GITHUB_OUTPUT"
            echo "package_manager=yarn" >> "$GITHUB_OUTPUT"
            echo "cache_kind=yarn" >> "$GITHUB_OUTPUT"
          elif [ -f pnpm-lock.yaml ]; then
            echo "has_lockfile=true" >> "$GITHUB_OUTPUT"
            echo "lockfile_path=pnpm-lock.yaml" >> "$GITHUB_OUTPUT"
            echo "package_manager=pnpm" >> "$GITHUB_OUTPUT"
            echo "cache_kind=pnpm" >> "$GITHUB_OUTPUT"
          else
            echo "has_lockfile=false" >> "$GITHUB_OUTPUT"
            echo "lockfile_path=" >> "$GITHUB_OUTPUT"
            echo "package_manager=npm" >> "$GITHUB_OUTPUT"
            echo "cache_kind=npm" >> "$GITHUB_OUTPUT"
          fi

      - name: Setup Node (with package manager cache)
        if: steps.lock.outputs.has_lockfile == 'true'
        uses: actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020 # v4.4.0
        with:
          node-version: 20
          cache: \${{ steps.lock.outputs.cache_kind }}
          cache-dependency-path: \${{ steps.lock.outputs.lockfile_path }}

      - name: Setup Node (no cache - lockfile missing)
        if: steps.lock.outputs.has_lockfile != 'true'
        uses: actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020 # v4.4.0
        with:
          node-version: 20

      - name: Enable Corepack for Yarn / pnpm
        if: steps.lock.outputs.package_manager == 'yarn' || steps.lock.outputs.package_manager == 'pnpm'
        shell: bash
        run: |
          set -euo pipefail
          corepack enable

      - name: Capture environment metadata
        shell: bash
        run: |
          set -euo pipefail
          mkdir -p ci-logs
          {
            echo "timestamp_utc=$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
            echo "workflow_version=\${WORKFLOW_VERSION}"
            echo "github_repository=\${GITHUB_REPOSITORY}"
            echo "github_run_id=\${GITHUB_RUN_ID}"
            echo "github_run_attempt=\${GITHUB_RUN_ATTEMPT}"
            echo "github_sha=\${GITHUB_SHA}"
            echo "target_ref=\${TARGET_REF:-}"
            echo "job_id=\${JOB_ID:-}"
            echo "runner_os=\${RUNNER_OS}"
            echo "runner_arch=\${RUNNER_ARCH}"
            echo "package_manager=\${{ steps.lock.outputs.package_manager }}"
            echo "trigger_mode=\${TRIGGER_MODE:-}"
            echo "source_workflow=\${SOURCE_WORKFLOW:-}"
            echo "source_run_id=\${SOURCE_RUN_ID:-}"
            echo "source_sha=\${SOURCE_SHA:-}"
            echo "package_manager=\${{ steps.lock.outputs.package_manager }}"
          } > ci-logs/metadata.env
          node --version | tee ci-logs/node-version.log
          npm --version | tee ci-logs/npm-version.log

      - name: Install dependencies (policy-aware)
        shell: bash
        run: |
          set -euo pipefail
          if [ "\${{ steps.lock.outputs.has_lockfile }}" != "true" ]; then
            echo "::warning::No lockfile found. Falling back to npm install (non-reproducible)."
            npm install --no-audit --no-fund || npm install --no-audit --no-fund --legacy-peer-deps
            exit 0
          fi

          case "\${{ steps.lock.outputs.package_manager }}" in
            npm)
              npm ci --no-audit --no-fund || npm ci --no-audit --no-fund --legacy-peer-deps
              ;;
            yarn)
              yarn install --immutable || yarn install --frozen-lockfile
              ;;
            pnpm)
              pnpm install --frozen-lockfile
              ;;
            *)
              echo "::error::Unsupported package manager '\${{ steps.lock.outputs.package_manager }}'"
              exit 1
              ;;
          esac

      - name: Lint + Typecheck + Expo preflight (robust, capture)
        id: run
        shell: bash
        run: |
          set +e
          set -o pipefail
          mkdir -p ci-logs

          (npm run lint:ci || npx --yes eslint .) 2>&1 | tee ci-logs/lint.log
          ESL=$?

          (npm run typecheck || npx --yes tsc --noEmit) 2>&1 | tee ci-logs/typecheck.log
          TSC=$?

          (
            npx --no-install expo config --json > ci-logs/expo-config.json &&
            node -e '
              const fs = require("fs");
              const p = "ci-logs/expo-config.json";
              const data = JSON.parse(fs.readFileSync(p, "utf8"));
              const projectId = (data?.expo ?? data)?.extra?.eas?.projectId;
              if (!projectId || typeof projectId !== "string" || !projectId.trim()) {
                console.error("Missing expo.extra.eas.projectId");
                process.exit(1);
              }
              console.log(\`expo.extra.eas.projectId OK: \${projectId}\`);
            '
          ) 2>&1 | tee ci-logs/expo-preflight.log
          EXPO=$?

          echo "eslint_exit=$ESL" >> "$GITHUB_OUTPUT"
          echo "tsc_exit=$TSC" >> "$GITHUB_OUTPUT"
          echo "expo_exit=$EXPO" >> "$GITHUB_OUTPUT"

          cat > ci-logs/ci-lite-result.json <<JSON
          {
            "workflow_version": "\${WORKFLOW_VERSION}",
            "job_id": "\${JOB_ID:-}",
            "ref": "\${TARGET_REF:-}",
            "github_run_id": "\${GITHUB_RUN_ID}",
            "github_run_attempt": "\${GITHUB_RUN_ATTEMPT}",
            "github_sha": "\${GITHUB_SHA}",
            "eslint_exit": $ESL,
            "tsc_exit": $TSC,
            "expo_exit": $EXPO,
            "trigger_mode": "\${TRIGGER_MODE:-}",
            "workflow_ref": "\${GITHUB_WORKFLOW_REF:-}",
            "workflow_sha": "\${GITHUB_WORKFLOW_SHA:-}",
            "source_workflow": "\${SOURCE_WORKFLOW:-}",
            "source_run_id": "\${SOURCE_RUN_ID:-}",
            "source_sha": "\${SOURCE_SHA:-}",
            "package_manager": "\${{ steps.lock.outputs.package_manager }}",
            "ok": $([ "$ESL" -eq 0 ] && [ "$TSC" -eq 0 ] && [ "$EXPO" -eq 0 ] && echo true || echo false)
          }
          JSON

          if [ "$ESL" -ne 0 ] || [ "$TSC" -ne 0 ] || [ "$EXPO" -ne 0 ]; then
            echo "::error::CI Lite failed (eslint=$ESL, tsc=$TSC, expo=$EXPO)"
            exit 1
          fi
          exit 0

      - name: Summary
        if: always()
        shell: bash
        run: |
          {
            echo "## CI Lite"
            echo ""
            echo "- ref: \`\${TARGET_REF}\`"
            echo "- job_id: \`\${JOB_ID:-}\`"
            echo "- workflow version: \`\${WORKFLOW_VERSION}\`"
            echo "- run id: \`\${GITHUB_RUN_ID}\` / attempt \`\${GITHUB_RUN_ATTEMPT}\`"
            echo "- sha: \`\${GITHUB_SHA}\`"
            echo "- trigger: \`\${TRIGGER_MODE:-}\`"
            echo "- workflow ref: \`\${GITHUB_WORKFLOW_REF:-}\`"
            echo "- source workflow: \`\${SOURCE_WORKFLOW:-}\`"
            echo "- source run: \`\${SOURCE_RUN_ID:-}\`"
            echo "- source sha: \`\${SOURCE_SHA:-}\`"
            echo "- eslint: \`\${{ steps.run.outputs.eslint_exit }}\`"
            echo "- tsc: \`\${{ steps.run.outputs.tsc_exit }}\`"
            echo "- expo preflight: \`\${{ steps.run.outputs.expo_exit }}\`"
            echo ""
            echo "Artifacts:"
            echo "- \`ci-logs/ci-lite-result.json\` (für Header-Polling)"
            echo "- \`ci-logs/lint.log\`, \`ci-logs/typecheck.log\`, \`ci-logs/expo-preflight.log\`"
            echo "- \`ci-logs/metadata.env\`, \`ci-logs/node-version.log\`, \`ci-logs/npm-version.log\`"
          } >> "$GITHUB_STEP_SUMMARY"

      - name: Upload CI Lite logs
        if: always()
        uses: actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02 # v4.6.2
        with:
          name: ci-lite-logs-\${{ github.run_id }}-\${{ github.run_attempt }}
          path: |
            ci-logs/ci-lite-result.json
            ci-logs/lint.log
            ci-logs/typecheck.log
            ci-logs/expo-preflight.log
            ci-logs/expo-config.json
            ci-logs/metadata.env
            ci-logs/node-version.log
            ci-logs/npm-version.log
          retention-days: 7
          if-no-files-found: ignore

      - name: Done
        if: success()
        shell: bash
        run: |
          set -euo pipefail
          echo "✅ CI Lite passed (job_id=\${JOB_ID:-})"
`,
  "k1w1-ci-lite-autofix.yml": `
# managed-by: k1w1
# workflow-version: 399
name: K1W1 CI Lite Autofix (ESLint --fix)

run-name: >-
  CI Lite Autofix\${{ inputs.job_id && format(' [{0}]', inputs.job_id) || '' }} • \${{ inputs.ref }}

on:
  workflow_dispatch:
    inputs:
      ref:
        description: "Branch to autofix (must be a remote branch)"
        required: true
      job_id:
        description: "Client job id (UUID) for log correlation"
        required: false
        default: ""

permissions:
  contents: write
  actions: write

concurrency:
  group: k1w1-ci-lite-autofix-\${{ inputs.ref }}
  cancel-in-progress: false

jobs:
  autofix:
    name: ESLint --fix + verify
    runs-on: ubuntu-latest
    timeout-minutes: 25

    env:
      JOB_ID: \${{ inputs.job_id }}
      TARGET_BRANCH: \${{ inputs.ref }}
      ALLOWED_REF_REGEX: "^(work|codex|main|dev|develop|release/.+|feature/.+|hotfix/.+)$"
      WORKFLOW_VERSION: "399"

    steps:
      - name: Determine target branch
        id: target_ref
        uses: ./.github/actions/determine-ref
        with:
          input_ref: \${{ inputs.ref }}
          github_ref_name: ""
          default_ref: ""
          allowed_ref_regex: \${{ env.ALLOWED_REF_REGEX }}

      - name: Export target branch
        shell: bash
        run: |
          set -euo pipefail
          echo "TARGET_BRANCH=\${{ steps.target_ref.outputs.checkout_ref }}" >> "$GITHUB_ENV"

      - name: Run info
        shell: bash
        run: |
          set -euo pipefail
          echo "CI Lite Autofix start (job_id=\${JOB_ID:-}, ref=\${TARGET_BRANCH:-})"

      - name: Checkout
        uses: actions/checkout@34e114876b0b11c390a56381ad16ebd13914f8d5 # v4.3.1
        with:
          ref: \${{ env.TARGET_BRANCH }}
          fetch-depth: 0

      - name: Detect package manager + lockfile
        id: lock
        shell: bash
        run: |
          set -euo pipefail
          if [ -f package-lock.json ]; then
            echo "has_lockfile=true" >> "$GITHUB_OUTPUT"
            echo "lockfile_path=package-lock.json" >> "$GITHUB_OUTPUT"
            echo "package_manager=npm" >> "$GITHUB_OUTPUT"
            echo "cache_kind=npm" >> "$GITHUB_OUTPUT"
          elif [ -f npm-shrinkwrap.json ]; then
            echo "has_lockfile=true" >> "$GITHUB_OUTPUT"
            echo "lockfile_path=npm-shrinkwrap.json" >> "$GITHUB_OUTPUT"
            echo "package_manager=npm" >> "$GITHUB_OUTPUT"
            echo "cache_kind=npm" >> "$GITHUB_OUTPUT"
          elif [ -f yarn.lock ]; then
            echo "has_lockfile=true" >> "$GITHUB_OUTPUT"
            echo "lockfile_path=yarn.lock" >> "$GITHUB_OUTPUT"
            echo "package_manager=yarn" >> "$GITHUB_OUTPUT"
            echo "cache_kind=yarn" >> "$GITHUB_OUTPUT"
          elif [ -f pnpm-lock.yaml ]; then
            echo "has_lockfile=true" >> "$GITHUB_OUTPUT"
            echo "lockfile_path=pnpm-lock.yaml" >> "$GITHUB_OUTPUT"
            echo "package_manager=pnpm" >> "$GITHUB_OUTPUT"
            echo "cache_kind=pnpm" >> "$GITHUB_OUTPUT"
          else
            echo "has_lockfile=false" >> "$GITHUB_OUTPUT"
            echo "lockfile_path=" >> "$GITHUB_OUTPUT"
            echo "package_manager=npm" >> "$GITHUB_OUTPUT"
            echo "cache_kind=npm" >> "$GITHUB_OUTPUT"
          fi

      - name: Setup Node (with package manager cache)
        if: steps.lock.outputs.has_lockfile == 'true'
        uses: actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020 # v4.4.0
        with:
          node-version: 20
          cache: \${{ steps.lock.outputs.cache_kind }}
          cache-dependency-path: \${{ steps.lock.outputs.lockfile_path }}

      - name: Setup Node (no cache - lockfile missing)
        if: steps.lock.outputs.has_lockfile != 'true'
        uses: actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020 # v4.4.0
        with:
          node-version: 20

      - name: Enable Corepack for Yarn / pnpm
        if: steps.lock.outputs.package_manager == 'yarn' || steps.lock.outputs.package_manager == 'pnpm'
        shell: bash
        run: |
          set -euo pipefail
          corepack enable

      - name: Capture environment metadata
        shell: bash
        run: |
          set -euo pipefail
          mkdir -p ci-logs
          {
            echo "timestamp_utc=$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
            echo "workflow_version=\${WORKFLOW_VERSION}"
            echo "github_repository=\${GITHUB_REPOSITORY}"
            echo "github_run_id=\${GITHUB_RUN_ID}"
            echo "github_run_attempt=\${GITHUB_RUN_ATTEMPT}"
            echo "github_sha=\${GITHUB_SHA}"
            echo "target_branch=\${TARGET_BRANCH:-}"
            echo "job_id=\${JOB_ID:-}"
            echo "runner_os=\${RUNNER_OS}"
            echo "runner_arch=\${RUNNER_ARCH}"
            echo "package_manager=\${{ steps.lock.outputs.package_manager }}"
          } > ci-logs/metadata.env
          node --version | tee ci-logs/node-version.log
          npm --version | tee ci-logs/npm-version.log

      - name: Install dependencies (policy-aware)
        shell: bash
        run: |
          set -euo pipefail
          if [ "\${{ steps.lock.outputs.has_lockfile }}" != "true" ]; then
            echo "::warning::No lockfile found. Falling back to npm install (non-reproducible)."
            npm install --no-audit --no-fund || npm install --no-audit --no-fund --legacy-peer-deps
            exit 0
          fi

          case "\${{ steps.lock.outputs.package_manager }}" in
            npm)
              npm ci --no-audit --no-fund || npm ci --no-audit --no-fund --legacy-peer-deps
              ;;
            yarn)
              yarn install --immutable || yarn install --frozen-lockfile
              ;;
            pnpm)
              pnpm install --frozen-lockfile
              ;;
            *)
              echo "::error::Unsupported package manager '\${{ steps.lock.outputs.package_manager }}'"
              exit 1
              ;;
          esac

      - name: ESLint --fix (best effort, capture)
        id: fix
        shell: bash
        run: |
          set +e
          set -o pipefail
          mkdir -p ci-logs

          if npm run -s | grep -q "lint:fix"; then
            npm run lint:fix 2>&1 | tee ci-logs/autofix.log
            FIX=$?
          else
            npx --yes eslint . --fix 2>&1 | tee ci-logs/autofix.log
            FIX=$?
          fi

          echo "eslint_fix_exit=$FIX" >> "$GITHUB_OUTPUT"
          exit 0

      - name: Guarded writeback (commit + push)
        id: writeback
        shell: bash
        run: |
          set -euo pipefail
          mkdir -p ci-logs

          BR="\${TARGET_BRANCH:-}"
          echo "pushed=false" >> "$GITHUB_OUTPUT"
          echo "changed=false" >> "$GITHUB_OUTPUT"

          if [ -z "$BR" ]; then
            echo "::warning::No TARGET_BRANCH provided; skipping writeback."
            exit 0
          fi

          if echo "$BR" | grep -qE '^[0-9a-fA-F]{7,40}$'; then
            echo "::warning::Ref looks like a SHA ($BR). Skipping writeback." | tee -a ci-logs/autofix.log
            exit 0
          fi

          if echo "$BR" | grep -qE '[: ]'; then
            echo "::warning::Unsafe ref ($BR). Skipping writeback." | tee -a ci-logs/autofix.log
            exit 0
          fi

          if ! echo "$BR" | grep -qE "\${ALLOWED_REF_REGEX}"; then
            echo "::warning::Writeback disabled for branch '$BR' (regex: \${ALLOWED_REF_REGEX})." | tee -a ci-logs/autofix.log
            exit 0
          fi

          if ! git ls-remote --exit-code --heads origin "$BR" >/dev/null 2>&1; then
            echo "::warning::Ref '$BR' is not a remote branch. Skipping writeback." | tee -a ci-logs/autofix.log
            exit 0
          fi

          if ! git status --porcelain | grep -q .; then
            echo "ℹ️ No autofix changes." | tee -a ci-logs/autofix.log
            exit 0
          fi

          echo "changed=true" >> "$GITHUB_OUTPUT"

          git config user.email "actions@users.noreply.github.com"
          git config user.name "github-actions[bot]"

          git add -A
          git commit -m "chore(ci): eslint autofix [skip ci]" || true

          set +e
          git push origin "HEAD:$BR" 2>&1 | tee -a ci-logs/autofix.log
          RC=$?
          set -e

          if [ "$RC" -eq 0 ]; then
            echo "pushed=true" >> "$GITHUB_OUTPUT"
          else
            echo "::warning::Could not push autofix commit (branch may be protected)." | tee -a ci-logs/autofix.log
            git diff --patch --no-color > ci-logs/autofix.patch || true
          fi

      - name: Lint + Typecheck + Expo preflight (robust, capture)
        id: verify
        shell: bash
        run: |
          set +e
          set -o pipefail
          mkdir -p ci-logs

          (npm run lint:ci || npx --yes eslint .) 2>&1 | tee ci-logs/lint.log
          ESL=$?

          (npm run typecheck || npx --yes tsc --noEmit) 2>&1 | tee ci-logs/typecheck.log
          TSC=$?

          (
            npx --no-install expo config --json > ci-logs/expo-config.json &&
            node -e '
              const fs = require("fs");
              const p = "ci-logs/expo-config.json";
              const data = JSON.parse(fs.readFileSync(p, "utf8"));
              const projectId = (data?.expo ?? data)?.extra?.eas?.projectId;
              if (!projectId || typeof projectId !== "string" || !projectId.trim()) {
                console.error("Missing expo.extra.eas.projectId");
                process.exit(1);
              }
              console.log(\`expo.extra.eas.projectId OK: \${projectId}\`);
            '
          ) 2>&1 | tee ci-logs/expo-preflight.log
          EXPO=$?

          echo "eslint_exit=$ESL" >> "$GITHUB_OUTPUT"
          echo "tsc_exit=$TSC" >> "$GITHUB_OUTPUT"
          echo "expo_exit=$EXPO" >> "$GITHUB_OUTPUT"

          cat > ci-logs/ci-lite-autofix-result.json <<JSON
          {
            "workflow_version": "\${WORKFLOW_VERSION}",
            "job_id": "\${JOB_ID:-}",
            "ref": "\${TARGET_BRANCH:-}",
            "github_run_id": "\${GITHUB_RUN_ID}",
            "github_run_attempt": "\${GITHUB_RUN_ATTEMPT}",
            "github_sha": "\${GITHUB_SHA}",
            "eslint_fix_exit": \${{ steps.fix.outputs.eslint_fix_exit || '0' }},
            "eslint_exit": $ESL,
            "tsc_exit": $TSC,
            "expo_exit": $EXPO,
            "writeback_changed": "\${{ steps.writeback.outputs.changed || 'false' }}",
            "writeback_pushed": "\${{ steps.writeback.outputs.pushed || 'false' }}",
                "package_manager": "\${{ steps.lock.outputs.package_manager }}",
            "ok": $([ "$ESL" -eq 0 ] && [ "$TSC" -eq 0 ] && [ "$EXPO" -eq 0 ] && echo true || echo false)
          }
          JSON

          if [ "$ESL" -ne 0 ] || [ "$TSC" -ne 0 ] || [ "$EXPO" -ne 0 ]; then
            echo "::error::Autofix verification failed (eslint=$ESL, tsc=$TSC, expo=$EXPO)"
            exit 1
          fi
          exit 0

      - name: Summary
        if: always()
        shell: bash
        run: |
          {
            echo "## CI Lite Autofix"
            echo ""
            echo "- ref: \`\${TARGET_BRANCH}\`"
            echo "- job_id: \`\${JOB_ID:-}\`"
            echo "- workflow version: \`\${WORKFLOW_VERSION}\`"
            echo "- run id: \`\${GITHUB_RUN_ID}\` / attempt \`\${GITHUB_RUN_ATTEMPT}\`"
            echo "- sha: \`\${GITHUB_SHA}\`"
            echo "- eslint fix exit: \`\${{ steps.fix.outputs.eslint_fix_exit }}\`"
            echo "- changed: \`\${{ steps.writeback.outputs.changed }}\`"
            echo "- pushed: \`\${{ steps.writeback.outputs.pushed }}\`"
            echo "- eslint verify: \`\${{ steps.verify.outputs.eslint_exit }}\`"
            echo "- tsc verify: \`\${{ steps.verify.outputs.tsc_exit }}\`"
            echo "- expo preflight: \`\${{ steps.verify.outputs.expo_exit }}\`"
            echo ""
            echo "Artifacts:"
            echo "- \`ci-logs/ci-lite-autofix-result.json\`"
            echo "- \`ci-logs/autofix.log\` (+ optional \`ci-logs/autofix.patch\` if push fails)"
            echo "- \`ci-logs/lint.log\`, \`ci-logs/typecheck.log\`, \`ci-logs/expo-preflight.log\`"
            echo "- \`ci-logs/metadata.env\`, \`ci-logs/node-version.log\`, \`ci-logs/npm-version.log\`"
          } >> "$GITHUB_STEP_SUMMARY"

      - name: Upload CI Lite Autofix logs
        if: always()
        uses: actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02 # v4.6.2
        with:
          name: ci-lite-autofix-logs-\${{ github.run_id }}-\${{ github.run_attempt }}
          path: |
            ci-logs/ci-lite-autofix-result.json
            ci-logs/autofix.log
            ci-logs/autofix.patch
            ci-logs/lint.log
            ci-logs/typecheck.log
            ci-logs/expo-preflight.log
            ci-logs/expo-config.json
            ci-logs/metadata.env
            ci-logs/node-version.log
            ci-logs/npm-version.log
          retention-days: 7
          if-no-files-found: ignore

      - name: Trigger CI Lite (chain-run)
        if: success()
        env:
          GH_TOKEN: \${{ secrets.GITHUB_TOKEN }}
        shell: bash
        run: |
          set -euo pipefail
          BR="\${TARGET_BRANCH:-}"

          if [ -z "$BR" ]; then
            echo "::warning::No TARGET_BRANCH; skipping CI Lite chain-run."
            exit 0
          fi

          if echo "$BR" | grep -qE '^[0-9a-fA-F]{7,40}$'; then
            echo "::warning::Ref looks like a SHA ($BR); skipping CI Lite chain-run."
            exit 0
          fi

          if echo "$BR" | grep -qE '[: ]'; then
            echo "::warning::Unsafe ref ($BR); skipping CI Lite chain-run."
            exit 0
          fi

          if ! echo "$BR" | grep -qE "\${ALLOWED_REF_REGEX}"; then
            echo "::warning::CI Lite chain-run disabled for '$BR' (regex: \${ALLOWED_REF_REGEX})."
            exit 0
          fi

          if ! git ls-remote --exit-code --heads origin "$BR" >/dev/null 2>&1; then
            echo "::warning::Ref '$BR' is not a remote branch; skipping CI Lite chain-run."
            exit 0
          fi

          HEAD_SHA="$(git rev-parse HEAD)"
          echo "Dispatching CI Lite chain-run via repository_dispatch for '$BR' (job_id=\${JOB_ID:-}, sha=\${HEAD_SHA})"
          gh api \
            -X POST \
            "repos/\${GITHUB_REPOSITORY}/dispatches" \
            -f event_type="trigger-ci-lite" \
            -f client_payload[branch]="$BR" \
            -f client_payload[job_id]="\${JOB_ID:-}" \
            -f client_payload[source_workflow]="k1w1-ci-lite-autofix.yml" \
            -f client_payload[source_run_id]="\${GITHUB_RUN_ID}" \
            -f client_payload[source_sha]="\${HEAD_SHA}" \
            >/dev/null

      - name: Done
        if: success()
        shell: bash
        run: |
          set -euo pipefail
          echo "✅ CI Lite Autofix finished (job_id=\${JOB_ID:-})"
`,
};

function validateWorkflowTemplate(name: string, content: string): { ok: true } | { ok: false; reason: string } {
  // Defensive: if a generator/patcher ever flattens YAML (removes newlines), we must NOT overwrite repo workflows.
  const lines = content.split(/\r?\n/);
  if (lines.length < 20) return { ok: false, reason: `too_few_lines:${lines.length}` };
  if (!content.includes("\non:")) return { ok: false, reason: "missing_on_block" };
  if (!content.includes("workflow_dispatch")) return { ok: false, reason: "missing_workflow_dispatch" };
  if (!content.includes("\njobs:")) return { ok: false, reason: "missing_jobs_block" };
  // Common flatten symptom: literal '\n' sequences rather than real newlines.
  if (content.includes("\\n") && lines.length < 40) return { ok: false, reason: "looks_escaped_or_flattened" };
  return { ok: true };
}


function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function b64(s: string): string {
  return btoa(unescape(encodeURIComponent(s)));
}

function unb64Utf8(s: string): string {
  return decodeURIComponent(escape(atob(s)));
}

function parseManagedWorkflowMeta(content: string): { managedBy: string | null; workflowVersion: string | null } {
  const managedBy =
    content.match(/^# managed-by:\s*(.+)$/m)?.[1]?.trim() ?? null;
  const workflowVersion =
    content.match(/^# workflow-version:\s*(.+)$/m)?.[1]?.trim() ?? null;
  return { managedBy, workflowVersion };
}

async function ghFetch(url: string, token: string, init: RequestInit): Promise<Response> {
  return await fetchWithTimeout(url, {
    ...init,
    timeoutMs: 15_000,
    timeoutMessage: `GitHub workflow dispatch request timed out after 15000ms: ${url}`,
    headers: {
      ...githubHeaders(token),
      ...(init.headers ?? {}),
    },
  });
}

async function findWorkflowIdByPath(
  owner: string,
  repo: string,
  token: string,
  workflowFile: string,
): Promise<number | null> {
  // Paginate defensively (rarely > 100 workflows).
  let page = 1;
  while (page <= 5) {
    const url = `${GITHUB_API_BASE}/repos/${owner}/${repo}/actions/workflows?per_page=100&page=${page}`;
    const r = await ghFetch(url, token, { method: "GET" });
    if (!r.ok) return null;
    const j = await r.json();
    const items = (j?.workflows ?? []) as Array<{ id: number; path: string; name?: string }>;
    const hit = items.find((w) => (w.path ?? "").endsWith(`/` + workflowFile));
    if (hit?.id) return hit.id;
    if (items.length < 100) break;
    page += 1;
  }
  return null;
}

async function ensureWorkflowFileExists(
  owner: string,
  repo: string,
  token: string,
  ref: string,
  workflowFile: string,
): Promise<{ ok: boolean; created?: boolean; updated?: boolean; details?: unknown }> {
  const template = WORKFLOW_TEMPLATES[workflowFile];
  if (!template) return { ok: false, details: { reason: "no_template", workflowFile } };
  const v = validateWorkflowTemplate(workflowFile, template);
  if (!v.ok) {
    const reason = (v as { ok: false; reason: string }).reason;
    return { ok: false, details: { reason: "template_invalid", workflowFile, why: reason } };
  }


  const path = `.github/workflows/${workflowFile}`;
  const getUrl = `${GITHUB_API_BASE}/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}?ref=${encodeURIComponent(ref)}`;
  const getResp = await ghFetch(getUrl, token, { method: "GET" });
  let sha: string | undefined;
  let currentMeta: { managedBy: string | null; workflowVersion: string | null } | null = null;
  if (getResp.ok) {
    const j = await getResp.json();
    sha = j?.sha;
    const encoded = typeof j?.content === "string" ? j.content.replace(/\n/g, "") : "";
    if (encoded) {
      try {
        currentMeta = parseManagedWorkflowMeta(unb64Utf8(encoded));
      } catch {
        currentMeta = { managedBy: null, workflowVersion: null };
      }
    }
  }

  const putUrl = `${GITHUB_API_BASE}/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}`;
  const payload: Record<string, unknown> = {
    message: sha
      ? `k1w1: update managed workflow ${workflowFile}`
      : `k1w1: add managed workflow ${workflowFile}`,
    content: b64(template + "\n"),
    branch: ref,
  };
  if (sha) payload.sha = sha;

  const putResp = await ghFetch(putUrl, token, {
    method: "PUT",
    body: JSON.stringify(payload),
  });

  if (!putResp.ok) {
    const txt = await putResp.text();
    return { ok: false, details: sanitizeGitHubFailure(putResp, txt) };
  }
  return {
    ok: true,
    created: !sha,
    updated: !!sha,
    details: {
      currentMeta,
      managedBy: "k1w1",
      workflowVersion: "399",
    },
  };
}

function parseCsvEnv(name: string): string[] {
  const raw = (Deno.env.get(name) ?? "").trim();
  if (!raw) return [];
  return raw.split(",").map((s) => s.trim()).filter(Boolean);
}

function isAllowedRepo(repo: string): boolean {
  const allow = parseCsvEnv("K1W1_ALLOWED_GITHUB_REPOS");
  if (allow.length === 0) return true; // rollout mode
  return allow.includes(repo);
}

function isAllowedRef(ref: string): boolean {
  const r = (ref ?? "").trim();
  if (!r) return true;
  if (r.startsWith("refs/")) return false;
  if (/^[0-9a-f]{40}$/i.test(r)) return false;

  const regexStr = (Deno.env.get("K1W1_ALLOWED_REF_REGEX") ?? "").trim();
  if (!regexStr) return true; // rollout mode
  try {
    const re = new RegExp(regexStr);
    return re.test(r);
  } catch {
    return false;
  }
}

/**
 * Dispatches a GitHub Actions workflow via workflow_dispatch.
 *
 * Expected input:
 * {
 *   githubRepo: "owner/repo",
 *   workflow: "file.yml" (or workflow_id),
 *   ref: "branch",
 *   inputs?: object
 * }
 */
Deno.serve(async (req) => {
    const cors = handleCors(req);
  if (cors) return cors;
try {
    // Legacy guard lineage: requireAdminKeyOrServiceRoleBearer(req).
    const auth = requireScopedEdgeAuth(req, {
      scope: "github-workflow-dispatch",
      allowAdmin: true,
      allowCiBearer: true,
      adminSecretEnv: "K1W1_EDGE_WORKFLOW_ADMIN_KEY",
      ciBearerSecretEnv: "K1W1_EDGE_WORKFLOW_CI_BEARER",
    });
    if (auth) return auth;

    const rl = rateLimit(req, "github-workflow-dispatch");
    if (rl) return rl;

    const parsed = await parseJsonBody(req, 200_000);
    if (!parsed.ok) return errorResponse((parsed as { ok: false; error: string }).error, req, 400);

    const val = validateGithubWorkflowDispatchRequest(parsed.body);
    if (!val.ok) return errorResponse("Invalid request", req, 400, (val as { ok: false; errors: unknown }).errors);

    const { githubRepo, workflow, ref, inputs } = val.data!;
    const token = getGithubToken().trim();

    if (!token) {
      return errorResponse("Missing GitHub token", req, 500, {
        expected: ["GITHUB_TOKEN", "GH_TOKEN", "GITHUB_API_TOKEN"],
      });
    }

    if (!isAllowedRepo(githubRepo)) {
      return jsonResponse(
        { ok: false, error: "githubRepo not allowed", details: { githubRepo } },
        req,
        403,
      );
    }

    if (!isAllowedRef(ref)) {
      return jsonResponse({ ok: false, error: "ref not allowed", details: { ref } }, req, 403);
    }

    const [owner, repo] = githubRepo.split("/");

    const body = { ref, inputs: inputs ?? {} };

    // `workflow` can be id, filename, or a short alias.
    const raw = (workflow ?? "").trim();
    const aliasMap: Record<string, string> = {
      "ci": "k1w1-ci-lite.yml",
      "ci-lite": "k1w1-ci-lite.yml",
      "cilite": "k1w1-ci-lite.yml",
      "diagnose": "k1w1-diagnostics.yml",
      "diagnostics": "k1w1-diagnostics.yml",
    };
    const normalized = aliasMap[raw] ?? raw;

    const dispatchByIdOrName = async (wf: string | number): Promise<Response> => {
      const url = `${GITHUB_API_BASE}/repos/${owner}/${repo}/actions/workflows/${wf}/dispatches`;
      return await ghFetch(url, token, {
        method: "POST",
        body: JSON.stringify(body),
      });
    };

    // 1) If numeric -> dispatch directly.
    if (/^[0-9]+$/.test(normalized)) {
      const r = await dispatchByIdOrName(normalized);
      if (r.ok) return jsonResponse({ ok: true, workflow: normalized }, req, 200);
      const txt = await r.text();
      const details = sanitizeGitHubFailure(r, txt);
      return errorResponse(
        "GitHub workflow dispatch failed",
        req,
        Math.max(400, Math.min(599, r.status || 502)),
        details,
      );
    }

    // 2) Build candidate filenames.
    const candidates: string[] = [];
    if (normalized) candidates.push(normalized);
    if (normalized && !normalized.includes(".")) {
      candidates.push(`${normalized}.yml`);
      candidates.push(`${normalized}.yaml`);
    }

    // 3) First try: resolve workflow id by path and dispatch.
    for (const wfFile of candidates) {
      const id = await findWorkflowIdByPath(owner, repo, token, wfFile);
      if (id) {
        const r = await dispatchByIdOrName(id);
        if (r.ok) return jsonResponse({ ok: true, workflow: wfFile, workflow_id: id }, req, 200);
      }
    }

    // 4) Fallback: direct dispatch by filename (GitHub supports this, but can 404 when missing).
    let lastResp: Response | null = null;
    let lastDetails: Record<string, unknown> | null = null;
    for (const wfFile of candidates) {
      const r = await dispatchByIdOrName(wfFile);
      if (r.ok) return jsonResponse({ ok: true, workflow: wfFile }, req, 200);
      lastResp = r;
      const txt = await r.text();
      lastDetails = sanitizeGitHubFailure(r, txt) as Record<string, unknown>;
      if (r.status !== 404) break;
    }

    // 5) Auto-fix 404 / stale workflow inputs: bootstrap known workflows, then retry.
    const last = lastResp;
    const unexpectedInputs =
      !!last && !!lastDetails && last.status === 422 && /Unexpected inputs provided/i.test(String(lastDetails.message || ""));

    if (last && (last.status === 404 || unexpectedInputs)) {
      // Choose the first file candidate that we can bootstrap.
      const bootTarget = candidates.find((c) => !!WORKFLOW_TEMPLATES[c]) ?? null;
      if (bootTarget) {
        const ensured = await ensureWorkflowFileExists(owner, repo, token, ref, bootTarget);
        if (ensured.ok) {
          // GitHub needs a moment to register new/updated workflows.
          for (const wait of [750, 1500, 2500, 4000]) {
            await sleep(wait);
            const id = await findWorkflowIdByPath(owner, repo, token, bootTarget);
            if (id) {
              const r = await dispatchByIdOrName(id);
              if (r.ok) {
                return jsonResponse(
                  { ok: true, workflow: bootTarget, workflow_id: id, bootstrapped: ensured },
                  req,
                  200,
                );
              }
              lastResp = r;
            }
          }
        } else {
          return errorResponse(
            "GitHub workflow dispatch failed (workflow missing; bootstrap failed)",
            req,
            404,
            {
              ...(typeof ensured.details === "object" && ensured.details ? ensured.details as Record<string, unknown> : {}),
              hint:
                "Workflow not found and auto-bootstrap failed. Check token permissions (contents:write) and branch protection.",
            },
          );
        }
      }
    }

    // If still not ok, bubble the last response.
    const r = lastResp ?? (await dispatchByIdOrName(candidates[0] ?? normalized));
    if (!r.ok) {
      const txt = await r.text();
      const details = sanitizeGitHubFailure(r, txt);
      const status = Math.max(400, Math.min(599, r.status || 502));

      if (status === 404) {
        return errorResponse(
          "GitHub workflow dispatch failed (workflow not found)",
          req,
          404,
          {
            ...details,
            hint:
              "Workflow not found in repo. Ensure the workflow file exists under .github/workflows and matches the name you dispatch (e.g. k1w1-ci-lite.yml).",
          },
        );
      }

      return errorResponse("GitHub workflow dispatch failed", req, status, details);
    }

    return jsonResponse({ ok: true }, req, 200);
  } catch (e) {
    return errorResponse("Unexpected error", req, 500, {
      message: sanitizeErrorText(e?.message ?? String(e)),
    });
  }
});
