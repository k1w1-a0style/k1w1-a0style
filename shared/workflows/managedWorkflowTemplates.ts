// Auto-managed GitHub Actions workflow templates for project repos.
export const WORKFLOW_TEMPLATES: Record<string, string> = {
  "k1w1-diagnostics.yml": `name: k1w1 diagnostics

on:
  workflow_dispatch:
    inputs:
      branch:
        description: "Branch to diagnose"
        required: false
        default: "main"

permissions:
  contents: read

concurrency:
  group: \${{ github.workflow }}-\${{ inputs.branch || github.ref }}
  cancel-in-progress: true

jobs:
  diagnose:
    runs-on: ubuntu-latest
    timeout-minutes: 20

    steps:
      - name: Checkout
        uses: actions/checkout@34e114876b0b11c390a56381ad16ebd13914f8d5 # v4
        with:
          ref: \${{ inputs.branch }}

      - name: Setup Node
        uses: actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020 # v4
        with:
          node-version: 20
          cache: npm

      - name: Install dependencies
        run: npm ci

      - name: Generate expo config + diagnostics report
        id: diag
        shell: bash
        env:
          EXPO_TOKEN: \${{ secrets.EXPO_TOKEN }}
          REPO: \${{ github.repository }}
          BRANCH: \${{ inputs.branch }}
          RUN_ID: \${{ github.run_id }}
          SHA: \${{ github.sha }}
        run: |
          set -euo pipefail

          ERRORS="[]"
          STATUS="pass"
          PROJECT_ID=""

          # expo config json
          if npx expo config --json > expo-config.json; then
            :
          else
            STATUS="fail"
            ERRORS="$(node -e 'const e=JSON.parse(process.argv[1]); e.push({code:"EXPO_CONFIG_FAILED",message:"npx expo config --json failed"}); console.log(JSON.stringify(e));' "$ERRORS")"
          fi

          if [ -f expo-config.json ]; then
            PROJECT_ID="$(node -e 'const fs=require("fs"); const c=JSON.parse(fs.readFileSync("expo-config.json","utf8")); const id=c?.expo?.extra?.eas?.projectId || ""; process.stdout.write(String(id));' || true)"
          fi

          if [ -z "$PROJECT_ID" ]; then
            STATUS="fail"
            ERRORS="$(node -e 'const e=JSON.parse(process.argv[1]); e.push({code:"MISSING_EAS_PROJECT_ID",message:"expo.extra.eas.projectId missing. Run eas-link.yml to commit eas-project.json/projectId."}); console.log(JSON.stringify(e));' "$ERRORS")"
          fi

          {
            echo "### k1w1 diagnostics"
            echo "- Branch: \${BRANCH}"
            echo "- Status: \${STATUS}"
            echo "- expo.extra.eas.projectId: \${PROJECT_ID:-}"
          } >> "$GITHUB_STEP_SUMMARY"

          REPO="$REPO" BRANCH="$BRANCH" RUN_ID="$RUN_ID" SHA="$SHA" STATUS="$STATUS" PROJECT_ID="$PROJECT_ID" ERRORS="$ERRORS" \
          node - <<'NODE'
          const fs = require("fs");
          const report = {
            github_repo: process.env.REPO,
            branch: process.env.BRANCH,
            status: process.env.STATUS,
            project_id: process.env.PROJECT_ID ? process.env.PROJECT_ID : null,
            workflow_run_id: process.env.RUN_ID,
            commit_sha: process.env.SHA,
            errors: JSON.parse(process.env.ERRORS || "[]"),
            expo_config: fs.existsSync("expo-config.json")
              ? JSON.parse(fs.readFileSync("expo-config.json", "utf8"))
              : null,
            created_at: new Date().toISOString(),
          };
          fs.writeFileSync("diagnostics-report.json", JSON.stringify(report, null, 2));
          NODE

          {
            echo "status=$STATUS"
            echo "project_id=$PROJECT_ID"
          } >> "$GITHUB_OUTPUT"

      - name: Upload diagnostics artifacts
        uses: actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02 # v4
        with:
          name: k1w1-diagnostics
          path: |
            diagnostics-report.json
            expo-config.json

      - name: Send diagnostics report to Supabase
        if: \${{ always() }}
        shell: bash
        env:
          SUPABASE_URL: \${{ secrets.SUPABASE_URL }}
          SUPABASE_SERVICE_ROLE_KEY: \${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
        run: |
          set -euo pipefail

          if [ -z "\${SUPABASE_URL:-}" ] || [ -z "\${SUPABASE_SERVICE_ROLE_KEY:-}" ]; then
            echo "⚠️ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY secrets; skipping Supabase report insert."
            exit 0
          fi

          if [ ! -f diagnostics-report.json ]; then
            echo "⚠️ diagnostics-report.json missing; skipping."
            exit 0
          fi

          curl --fail-with-body -sS -X POST "\${SUPABASE_URL%/}/rest/v1/diagnostics_reports" \
            -H "Content-Type: application/json" \
            -H "apikey: \${SUPABASE_SERVICE_ROLE_KEY}" \
            -H "Authorization: Bearer \${SUPABASE_SERVICE_ROLE_KEY}" \
            -H "Prefer: return=minimal" \
            --data-binary @diagnostics-report.json

          echo "✅ Diagnostics report inserted into Supabase."

      - name: Fail job if diagnostics failed
        if: \${{ steps.diag.outputs.status == 'fail' }}
        run: |
          echo "Diagnostics failed (see summary / artifact / Supabase diagnostics_reports)."
          exit 1
`,
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

          (npm run lint:ci || npx --yes eslint . --quiet) 2>&1 | tee ci-logs/lint.log
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

          (npm run lint:ci || npx --yes eslint . --quiet) 2>&1 | tee ci-logs/lint.log
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

export const isKnownWorkflowTemplate = (fileName: string) => Boolean(WORKFLOW_TEMPLATES[fileName]);
