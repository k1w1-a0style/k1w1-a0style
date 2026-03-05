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
        uses: actions/upload-artifact@4cec3d8aa04e39d1a68397de0c4cd6fb9dce8ec1 # v4
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
  "k1w1-ci-lite.yml": `name: K1W1 CI Lite (Lint + Typecheck)

on:
  workflow_dispatch:
    inputs:
      ref:
        description: "Branch/Ref to check (e.g. work, main, dev)"
        required: false
        default: ""
      job_id:
        description: "Client job id (UUID) for log correlation"
        required: false
        default: ""

permissions:
  contents: read

concurrency:
  group: >-
    k1w1-ci-lite-
    \${{ github.ref_name }}
  cancel-in-progress: false

jobs:
  checks:
    name: Lint + Typecheck
    runs-on: ubuntu-latest
    timeout-minutes: 15
    permissions:
      contents: read

    env:
      JOB_ID: \${{ github.event.inputs.job_id }}

    steps:
      - name: "Run info"
        shell: bash
        run: |
          set -euo pipefail
          echo "CI Lite start (job_id=\${JOB_ID:-})"

      - name: Checkout
        uses: actions/checkout@34e114876b0b11c390a56381ad16ebd13914f8d5 # v4
        with:
          ref: \${{ github.ref_name }}

      - name: Detect lockfile
        id: lock
        shell: bash
        run: |
          set -euo pipefail
          if [ -f package-lock.json ]; then
            echo "has_lockfile=true" >> "$GITHUB_OUTPUT"
            echo "lockfile_path=package-lock.json" >> "$GITHUB_OUTPUT"
          elif [ -f npm-shrinkwrap.json ]; then
            echo "has_lockfile=true" >> "$GITHUB_OUTPUT"
            echo "lockfile_path=npm-shrinkwrap.json" >> "$GITHUB_OUTPUT"
          else
            echo "has_lockfile=false" >> "$GITHUB_OUTPUT"
            echo "lockfile_path=" >> "$GITHUB_OUTPUT"
          fi

      - name: Setup Node (with npm cache)
        if: steps.lock.outputs.has_lockfile == 'true'
        uses: actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020 # v4
        with:
          node-version: 20
          cache: npm
          cache-dependency-path: \${{ steps.lock.outputs.lockfile_path }}

      - name: Setup Node (no cache - lockfile missing)
        if: steps.lock.outputs.has_lockfile != 'true'
        uses: actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020 # v4
        with:
          node-version: 20

      - name: Install dependencies (frozen if possible)
        shell: bash
        run: |
          set -euo pipefail
          if [ "\${{ steps.lock.outputs.has_lockfile }}" = "true" ]; then
            npm ci --no-audit --no-fund || npm ci --no-audit --no-fund --legacy-peer-deps
          else
            echo "::warning::No lockfile found. Falling back to npm install (non-reproducible)."
            npm install --no-audit --no-fund || npm install --no-audit --no-fund --legacy-peer-deps
          fi

      - name: Lint + Typecheck (robust, capture)
        shell: bash
        run: |
          set +e
          mkdir -p ci-logs

          (npm run lint:ci || npx --yes eslint . --quiet) 2>&1 | tee ci-logs/lint.log
          ESL=$?

          (npm run typecheck || npx --yes tsc --noEmit) 2>&1 | tee ci-logs/typecheck.log
          TSC=$?

          echo "eslint_exit=$ESL" >> "$GITHUB_OUTPUT"
          echo "tsc_exit=$TSC" >> "$GITHUB_OUTPUT"

          if [ "$ESL" -ne 0 ] || [ "$TSC" -ne 0 ]; then
            echo "::error::CI Lite failed (eslint=$ESL, tsc=$TSC)"
            exit 1
          fi

          exit 0

      - name: Upload CI Lite logs
        if: always()
        uses: actions/upload-artifact@65aadd1f256f2c7b34697482e3d4a3f2ecf62edd # v4
        with:
          name: ci-lite-logs
          path: |
            ci-logs/lint.log
            ci-logs/typecheck.log
          retention-days: 7

      - name: Done
        shell: bash
        run: |
          set -euo pipefail
          echo "✅ CI Lite passed (job_id=\${JOB_ID:-})"

run-name: >-
  CI Lite\${{ github.event.inputs.job_id && format(' [{0}]', github.event.inputs.job_id) || '' }}
  • \${{ github.ref_name }}
`,
  "k1w1-ci-lite-autofix.yml": `name: K1W1 CI Lite Autofix (ESLint --fix)

on:
  workflow_dispatch:
    inputs:
      job_id:
        description: "Client job id (UUID) for log correlation"
        required: false
        default: ""

permissions:
  contents: write
  actions: write

concurrency:
  group: >-
    k1w1-ci-lite-autofix-
    \${{ github.ref_name }}
  cancel-in-progress: false

jobs:
  autofix:
    name: ESLint --fix + verify
    runs-on: ubuntu-latest
    timeout-minutes: 25

    env:
      JOB_ID: \${{ github.event.inputs.job_id }}
      TARGET_BRANCH: \${{ github.ref_name }}
      ALLOWED_REF_REGEX: "^(work|main|dev|develop|release/.+|feature/.+|hotfix/.+)$"

    steps:
      - name: Run info
        shell: bash
        run: |
          set -euo pipefail
          echo "CI Lite Autofix start (job_id=\${JOB_ID:-}, ref=\${TARGET_BRANCH:-})"

      - name: Checkout
        uses: actions/checkout@34e114876b0b11c390a56381ad16ebd13914f8d5 # v4
        with:
          ref: \${{ github.ref_name }}

      - name: Detect lockfile
        id: lock
        shell: bash
        run: |
          set -euo pipefail
          if [ -f package-lock.json ]; then
            echo "has_lockfile=true" >> "$GITHUB_OUTPUT"
            echo "lockfile_path=package-lock.json" >> "$GITHUB_OUTPUT"
          elif [ -f npm-shrinkwrap.json ]; then
            echo "has_lockfile=true" >> "$GITHUB_OUTPUT"
            echo "lockfile_path=npm-shrinkwrap.json" >> "$GITHUB_OUTPUT"
          else
            echo "has_lockfile=false" >> "$GITHUB_OUTPUT"
            echo "lockfile_path=" >> "$GITHUB_OUTPUT"
          fi

      - name: Setup Node (with npm cache)
        if: steps.lock.outputs.has_lockfile == 'true'
        uses: actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020 # v4
        with:
          node-version: 20
          cache: npm
          cache-dependency-path: \${{ steps.lock.outputs.lockfile_path }}

      - name: Setup Node (no cache - lockfile missing)
        if: steps.lock.outputs.has_lockfile != 'true'
        uses: actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020 # v4
        with:
          node-version: 20

      - name: Install dependencies (frozen if possible)
        shell: bash
        run: |
          set -euo pipefail
          if [ "\${{ steps.lock.outputs.has_lockfile }}" = "true" ]; then
            npm ci --no-audit --no-fund || npm ci --no-audit --no-fund --legacy-peer-deps
          else
            echo "::warning::No lockfile found. Falling back to npm install (non-reproducible)."
            npm install --no-audit --no-fund || npm install --no-audit --no-fund --legacy-peer-deps
          fi

      - name: ESLint --fix (best effort, capture)
        shell: bash
        run: |
          set +e
          mkdir -p ci-logs

          if npm run -s | grep -q "lint:fix"; then
            (npm run lint:fix) 2>&1 | tee ci-logs/autofix.log
            FIX=$?
          else
            (npx --yes eslint . --fix) 2>&1 | tee ci-logs/autofix.log
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
          if [ -z "$BR" ]; then
            echo "::warning::No TARGET_BRANCH provided; skipping writeback."
            echo "pushed=false" >> "$GITHUB_OUTPUT"
            echo "changed=false" >> "$GITHUB_OUTPUT"
            exit 0
          fi

          if echo "$BR" | grep -qE '^[0-9a-fA-F]{7,40}$'; then
            echo "::warning::Ref looks like a SHA ($BR). Skipping writeback." | tee -a ci-logs/autofix.log
            echo "pushed=false" >> "$GITHUB_OUTPUT"
            echo "changed=false" >> "$GITHUB_OUTPUT"
            exit 0
          fi
          if echo "$BR" | grep -qE '[: ]'; then
            echo "::warning::Unsafe ref ($BR). Skipping writeback." | tee -a ci-logs/autofix.log
            echo "pushed=false" >> "$GITHUB_OUTPUT"
            echo "changed=false" >> "$GITHUB_OUTPUT"
            exit 0
          fi
          if ! echo "$BR" | grep -qE "\${ALLOWED_REF_REGEX}"; then
            echo "::warning::Writeback disabled for branch '$BR' (regex: \${ALLOWED_REF_REGEX})." | tee -a ci-logs/autofix.log
            echo "pushed=false" >> "$GITHUB_OUTPUT"
            echo "changed=false" >> "$GITHUB_OUTPUT"
            exit 0
          fi
          if ! git ls-remote --exit-code --heads origin "$BR" >/dev/null 2>&1; then
            echo "::warning::Ref '$BR' is not a remote branch. Skipping writeback." | tee -a ci-logs/autofix.log
            echo "pushed=false" >> "$GITHUB_OUTPUT"
            echo "changed=false" >> "$GITHUB_OUTPUT"
            exit 0
          fi

          if ! git status --porcelain | grep -q .; then
            echo "ℹ️ No autofix changes." | tee -a ci-logs/autofix.log
            echo "pushed=false" >> "$GITHUB_OUTPUT"
            echo "changed=false" >> "$GITHUB_OUTPUT"
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
            echo "pushed=false" >> "$GITHUB_OUTPUT"
            git diff --patch --no-color > ci-logs/autofix.patch || true
          fi

      - name: Lint + Typecheck (robust, capture)
        shell: bash
        run: |
          set +e
          mkdir -p ci-logs

          (npm run lint:ci || npx --yes eslint . --quiet) 2>&1 | tee ci-logs/lint.log
          ESL=$?

          (npm run typecheck || npx --yes tsc --noEmit) 2>&1 | tee ci-logs/typecheck.log
          TSC=$?

          echo "eslint_exit=$ESL" >> "$GITHUB_OUTPUT"
          echo "tsc_exit=$TSC" >> "$GITHUB_OUTPUT"

          if [ "$ESL" -ne 0 ] || [ "$TSC" -ne 0 ]; then
            echo "::error::Autofix verification failed (eslint=$ESL, tsc=$TSC)"
            exit 1
          fi

          exit 0

      - name: Upload CI Lite Autofix logs
        if: always()
        uses: actions/upload-artifact@65aadd1f256f2c7b34697482e3d4a3f2ecf62edd # v4
        with:
          name: ci-lite-autofix-logs
          path: |
            ci-logs/autofix.log
            ci-logs/autofix.patch
            ci-logs/lint.log
            ci-logs/typecheck.log
          retention-days: 7

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

          echo "Dispatching CI Lite chain-run for '$BR' (job_id=\${JOB_ID:-})"
          gh api \
            -X POST \
            "repos/\${GITHUB_REPOSITORY}/actions/workflows/k1w1-ci-lite.yml/dispatches" \
            -f ref="$BR" \
            -f inputs[ref]="$BR" \
            -f inputs[job_id]="\${JOB_ID:-}" \
            >/dev/null

      - name: Done
        shell: bash
        run: |
          set -euo pipefail
          echo "✅ CI Lite Autofix finished (job_id=\${JOB_ID:-})"

run-name: >-
  CI Lite Autofix\${{ github.event.inputs.job_id && format(' [{0}]', github.event.inputs.job_id) || '' }}
  • \${{ github.ref_name }}`,
};

export const isKnownWorkflowTemplate = (fileName: string) => Boolean(WORKFLOW_TEMPLATES[fileName]);
