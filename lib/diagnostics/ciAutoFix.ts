/* Auto-fix CI/Workflows for generated repos.
 * - Pushes canonical workflows into linked GitHub repo/branch
 * - Verifies required secrets exist
 *
 * NOTE: This runs entirely "in-app" via GitHub Contents API (createOrUpdateFile).
 */
import {
  createOrUpdateFile,
  getRepoFileText,
  listRepoSecretNames,
} from "../../contexts/githubService";

export type CiFixChange = {
  path: string;
  changed: boolean;
  message: string;
};

export type SecretsCheck = {
  required: string[];
  present: string[];
  missing: string[];
};

export function parseOwnerRepo(
  input: string,
): { owner: string; repo: string } | null {
  const raw = (input || "").trim().replace(/^https?:\/\/github\.com\//i, "");
  const m = raw.match(/^([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)(?:\.git)?\/?$/);
  if (!m) return null;
  return { owner: m[1], repo: m[2] };
}

const WORKFLOWS: Record<string, string> = {
  "k1w1-triggered-build.yml": `name: K1W1 Triggered Build

on:
  repository_dispatch:
    types: [trigger-eas-build]
  workflow_dispatch:
    inputs:
      ref:
        description: "Branch/Ref to build (e.g. main, dev, feature-x)"
        required: false
        default: "work"
      profile:
        description: "EAS build profile (development|preview|production)"
        required: false
        default: "preview"
      job_id:
        description: "Supabase build job id"
        required: false
        default: ""
      autofix:
        description: "Allow workflow to write back fixes (lockfile/dev-client) to the branch"
        required: false
        type: boolean
        default: false

concurrency:
  group: >-
    \${{ github.workflow }}-\${{ github.event_name }}-
    \${{ github.event.client_payload.branch || github.event.client_payload.ref || inputs.ref || github.ref }}-
    \${{ github.event.client_payload.build_profile || github.event.client_payload.buildProfile || inputs.profile || 'preview' }}
  cancel-in-progress: false

permissions:
  contents: read

jobs:
  autofix:
    name: Auto-fix repo (optional writeback)
    if: >-
      \${{ (github.event_name == 'repository_dispatch' && (github.event.client_payload.autofix == true || github.event.client_payload.autoFix == true)) || (github.event_name == 'workflow_dispatch' && inputs.autofix == true) }}
    runs-on: ubuntu-latest
    timeout-minutes: 30
    permissions:
      contents: write

    env:
      EXPO_TOKEN: \${{ secrets.EXPO_TOKEN }}
      EAS_CLI_VERSION: "16.0.0"

    steps:
      - name: Determine checkout ref
        shell: bash
        run: |
          set -euo pipefail
          REF="\${{ github.event.client_payload.branch }}"
          if [ -z "$REF" ]; then REF="\${{ github.event.client_payload.ref }}"; fi
          if [ -z "$REF" ]; then REF="\${{ github.event.inputs.ref }}"; fi
          if [ -z "$REF" ]; then REF="main"; fi
          echo "CHECKOUT_REF=$REF" >> "$GITHUB_ENV"
          echo "📌 Checkout ref: $REF"

      - name: Determine build profile + artifact extension
        shell: bash
        run: |
          set -euo pipefail
          PROFILE="\${{ github.event.client_payload.build_profile }}"
          if [ -z "$PROFILE" ]; then PROFILE="\${{ github.event.client_payload.buildProfile }}"; fi
          if [ -z "$PROFILE" ]; then PROFILE="\${{ github.event.inputs.profile }}"; fi
          if [ -z "$PROFILE" ]; then PROFILE="preview"; fi
          echo "PROFILE=$PROFILE" >> "$GITHUB_ENV"

      - name: Checkout
        uses: actions/checkout@34e114876b0b11c390a56381ad16ebd13914f8d5 # v4
        with:
          ref: \${{ env.CHECKOUT_REF }}
          fetch-depth: 0

      - name: Detect lockfile (for cache + install strategy)
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
            echo "Using npm ci (lockfile: \${{ steps.lock.outputs.lockfile_path }})"
            npm ci --no-audit --no-fund || npm ci --no-audit --no-fund --legacy-peer-deps
          else
            echo "::warning::No lockfile found in repo. Falling back to npm install (non-reproducible)."
            npm install --no-audit --no-fund || npm install --no-audit --no-fund --legacy-peer-deps
          fi

      - name: Install EAS CLI (pinned)
        shell: bash
        run: |
          set -euo pipefail
          npm i -g "eas-cli@\${EAS_CLI_VERSION}"
          eas --version

      - name: Verify EAS auth
        shell: bash
        run: |
          set -euo pipefail
          if [ -z "\${EXPO_TOKEN:-}" ]; then
            echo "::error::Missing GitHub Secret EXPO_TOKEN"
            exit 1
          fi
          eas whoami

      - name: Auto-fix repo (lockfile + dev client) [optional writeback]
        shell: bash
        env:
          TARGET_BRANCH: \${{ env.CHECKOUT_REF }}
          PROFILE: \${{ env.PROFILE }}
          ALLOWED_REF_REGEX: "^(work|dev|develop|feature/.+|hotfix/.+)$"
        run: |
          set -euo pipefail

          echo "🧯 Auto-fix: lockfile + expo-dev-client (development only)."
          npm config set package-lock true

          if [ "\${PROFILE}" = "development" ]; then
            echo "📦 Ensuring expo-dev-client for development builds..."
            npx --yes expo install expo-dev-client --fix || npx --yes expo install expo-dev-client
          fi

          if [ ! -f package-lock.json ]; then
            echo "::warning::No package-lock.json found. Generating one (best effort)."
            npm install --package-lock-only --no-audit --no-fund
          fi

          if ! git status --porcelain | grep -qE '^( M|\?\?) (package.json|package-lock.json|\.npmrc)$'; then
            echo "ℹ️ No CI auto-fix changes to write back."
            exit 0
          fi

          BR="\${TARGET_BRANCH:-}"
          if [ -z "$BR" ]; then
            echo "::warning::No TARGET_BRANCH provided; skipping writeback."
            exit 0
          fi

          if echo "$BR" | grep -qE '^[0-9a-fA-F]{7,40}$'; then
            echo "::warning::Ref looks like a SHA ($BR). Skipping writeback."
            exit 0
          fi
          if echo "$BR" | grep -qE '[: ]'; then
            echo "::warning::Unsafe ref ($BR). Skipping writeback."
            exit 0
          fi
          if ! echo "$BR" | grep -qE "\${ALLOWED_REF_REGEX}"; then
            echo "::warning::Writeback disabled for branch '$BR' (regex: \${ALLOWED_REF_REGEX})."
            exit 0
          fi

          if ! git ls-remote --exit-code --heads origin "$BR" >/dev/null 2>&1; then
            echo "::warning::Ref '$BR' is not a remote branch. Skipping writeback."
            exit 0
          fi

          echo "✅ Auto-fix changes detected -> committing back to '$BR'."
          git config user.email "actions@users.noreply.github.com"
          git config user.name "github-actions[bot]"
          git add package.json package-lock.json .npmrc 2>/dev/null || true
          git commit -m "chore(ci): auto-fix lockfile/dev-client [skip ci]" || true

          echo "🚀 Pushing to origin $BR (best effort)..."
          git push origin "HEAD:$BR" || echo "::warning::Could not push auto-fix commit (branch may be protected)."

  build:
    needs: [autofix]
    if: \${{ always() && (needs.autofix.result == 'success' || needs.autofix.result == 'skipped') }}
    permissions:
      contents: read

    name: EAS Build (Android, WAIT)
    runs-on: ubuntu-latest
    timeout-minutes: 60

    env:
      EXPO_TOKEN: \${{ secrets.EXPO_TOKEN }}
      EAS_CLI_VERSION: "16.0.0"

      SUPABASE_URL: \${{ secrets.SUPABASE_URL }}
      SUPABASE_SERVICE_ROLE_KEY: \${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}

      JOB_ID: \${{ github.event.client_payload.job_id || github.event.inputs.job_id || '' }}

    steps:
      - name: Determine checkout ref
        shell: bash
        run: |
          set -euo pipefail
          REF="\${{ github.event.client_payload.branch }}"
          if [ -z "$REF" ]; then REF="\${{ github.event.client_payload.ref }}"; fi
          if [ -z "$REF" ]; then REF="\${{ github.event.inputs.ref }}"; fi
          if [ -z "$REF" ]; then REF="main"; fi
          echo "CHECKOUT_REF=$REF" >> "$GITHUB_ENV"
          echo "📌 Checkout ref: $REF"

      - name: Determine build profile + artifact extension
        shell: bash
        run: |
          set -euo pipefail
          PROFILE="\${{ github.event.client_payload.build_profile }}"
          if [ -z "$PROFILE" ]; then PROFILE="\${{ github.event.client_payload.buildProfile }}"; fi
          if [ -z "$PROFILE" ]; then PROFILE="\${{ github.event.inputs.profile }}"; fi
          if [ -z "$PROFILE" ]; then PROFILE="preview"; fi

          case "$PROFILE" in
            development|preview|production) ;;
            *)
              echo "::warning::Invalid PROFILE='$PROFILE', defaulting to preview"
              PROFILE="preview"
              ;;
          esac

          if [ "$PROFILE" = "production" ]; then EXT="aab"; else EXT="apk"; fi

          echo "PROFILE=$PROFILE" >> "$GITHUB_ENV"
          echo "ARTIFACT_EXT=$EXT" >> "$GITHUB_ENV"
          echo "✅ Using build profile: $PROFILE (artifact: .$EXT)"

      - name: Validate secrets / optional JOB_ID
        shell: bash
        run: |
          set -euo pipefail
          if [ -z "\${EXPO_TOKEN:-}" ]; then
            echo "::error::Missing GitHub Secret EXPO_TOKEN"
            exit 1
          fi

          if [ -z "\${JOB_ID:-}" ]; then
            echo "has_job_id=false" >> "$GITHUB_ENV"
            echo "⚠️ No JOB_ID provided -> Supabase status updates will be skipped."
          else
            if [ -z "\${SUPABASE_URL:-}" ] || [ -z "\${SUPABASE_SERVICE_ROLE_KEY:-}" ]; then
              echo "::warning::JOB_ID provided, but SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing -> status updates will be skipped."
              echo "has_job_id=false" >> "$GITHUB_ENV"
            else
              echo "has_job_id=true" >> "$GITHUB_ENV"
              echo "✅ JOB_ID: \${JOB_ID}"
            fi
          fi

      - name: Checkout repository
        uses: actions/checkout@34e114876b0b11c390a56381ad16ebd13914f8d5 # v4
        with:
          ref: \${{ env.CHECKOUT_REF }}
          fetch-depth: 0

      - name: Detect lockfile (for cache + install strategy)
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
          elif [ -f yarn.lock ]; then
            echo "has_lockfile=true" >> "$GITHUB_OUTPUT"
            echo "lockfile_path=yarn.lock" >> "$GITHUB_OUTPUT"
          elif [ -f pnpm-lock.yaml ]; then
            echo "has_lockfile=true" >> "$GITHUB_OUTPUT"
            echo "lockfile_path=pnpm-lock.yaml" >> "$GITHUB_OUTPUT"
          else
            echo "has_lockfile=false" >> "$GITHUB_OUTPUT"
            echo "lockfile_path=" >> "$GITHUB_OUTPUT"
          fi
          echo "Repo root: $(pwd)"
          echo "Files:"; ls -lah

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
            echo "Using npm ci (lockfile: \${{ steps.lock.outputs.lockfile_path }})"
            npm ci --no-audit --no-fund || npm ci --no-audit --no-fund --legacy-peer-deps
          else
            echo "::warning::No lockfile found in repo. Falling back to npm install (non-reproducible)."
            npm install --no-audit --no-fund || npm install --no-audit --no-fund --legacy-peer-deps
          fi

      - name: Install EAS CLI (pinned)
        shell: bash
        run: |
          set -euo pipefail
          npm i -g "eas-cli@\${EAS_CLI_VERSION}"
          eas --version

      - name: Verify EAS auth
        shell: bash
        run: |
          set -euo pipefail
          eas whoami

      - name: Run EAS Build (WAIT)
        id: eas
        shell: bash
        run: |
          set -euo pipefail
          echo "🚀 Starting EAS build (android, profile=\${PROFILE}) with --wait..."

          BUILD_OUTPUT="$(eas build --platform android --profile "\${PROFILE}" --non-interactive --wait 2>&1)" || {
            CODE=$?
            echo "\${BUILD_OUTPUT}"
            echo "::error::EAS build failed (exit \${CODE})"
            exit "\${CODE}"
          }

          echo "\${BUILD_OUTPUT}"

          UUID_RE='[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}'
          BUILD_ID="$(echo "\${BUILD_OUTPUT}" | grep -oE "\${UUID_RE}" | head -n1 || true)"
          if [ -z "\${BUILD_ID}" ]; then BUILD_ID="unknown"; fi
          echo "build_id=\${BUILD_ID}" >> "\${GITHUB_OUTPUT}"

          BUILD_URL="$(echo "\${BUILD_OUTPUT}" | grep -oE "https://expo.dev[^[:space:]]*/builds/\${UUID_RE}" | head -n1 || true)"
          echo "build_url=\${BUILD_URL}" >> "\${GITHUB_OUTPUT}"
      - name: Download Android Artifact
        if: steps.eas.outputs.build_id != 'unknown' && steps.eas.outputs.build_id != ''
        continue-on-error: true
        shell: bash
        run: |
          set -euo pipefail
          mkdir -p build
          OUT="build/k1w1-\${PROFILE}.\${ARTIFACT_EXT}"
          eas build:download             --id "\${{ steps.eas.outputs.build_id }}"             --output "\${OUT}" || {
              echo "::warning::Failed to download artifact"
              exit 0
            }
          ls -lah build || true

      - name: Upload Android Artifact
        if: always()
        continue-on-error: true
        uses: actions/upload-artifact@4cec3d8aa04e39d1a68397de0c4cd6fb9dce8ec1 # v4
        with:
          name: k1w1-android-\${{ env.PROFILE }}-\${{ github.run_number }}
          path: build/*
          retention-days: 30
          if-no-files-found: warn

      - name: Summary
        if: always()
        shell: bash
        run: |
          cat >> "$GITHUB_STEP_SUMMARY" << EOF
          ## Triggered Build Summary

          - Repo: \${{ github.repository }}
          - Event: \${{ github.event_name }}
          - Checkout ref: \${CHECKOUT_REF}
          - Profile: \${PROFILE}
          - Checked out: $(git rev-parse HEAD)
          - Lockfile present: \${{ steps.lock.outputs.has_lockfile }}
          - Lockfile path: \${{ steps.lock.outputs.lockfile_path }}
          - EAS CLI: $(eas --version 2>/dev/null || echo "unknown")
          - Build ID: \${{ steps.eas.outputs.build_id }}
          - Build URL: \${{ steps.eas.outputs.build_url }}

          Artifacts: https://github.com/\${{ github.repository }}/actions/runs/\${{ github.run_id }}
          EOF
`,
  "eas-build.yml": `name: EAS Build

on:
  workflow_dispatch:
    inputs:
      ref:
        description: "Branch/Tag/SHA to build"
        required: false
        default: "work"
      profile:
        description: "EAS build profile (development|preview|production)"
        required: false
        default: "preview"
      job_id:
        description: "Supabase build job id (optional)"
        required: false
        default: ""
      platform:
        description: "Platform"
        required: false
        type: choice
        options: [android]
        default: android
      autofix:
        description: "Allow workflow to write back fixes (lockfile/dev-client) to the branch"
        required: false
        type: boolean
        default: false

permissions:
  contents: read

concurrency:
  group: eas-build-\${{ inputs.ref }}-\${{ inputs.profile }}
  cancel-in-progress: false

jobs:
  autofix:
    name: Auto-fix repo (optional writeback)
    if: \${{ inputs.autofix == true }}
    runs-on: ubuntu-latest
    timeout-minutes: 30
    permissions:
      contents: write

    env:
      EXPO_TOKEN: \${{ secrets.EXPO_TOKEN }}
      EAS_CLI_VERSION: "16.0.0"

    steps:
      - name: Checkout
        uses: actions/checkout@34e114876b0b11c390a56381ad16ebd13914f8d5 # v4
        with:
          ref: \${{ inputs.ref }}
          fetch-depth: 0

      - name: Detect lockfile (for cache + install strategy)
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
            echo "Using npm ci (lockfile: \${{ steps.lock.outputs.lockfile_path }})"
            npm ci --no-audit --no-fund || npm ci --no-audit --no-fund --legacy-peer-deps
          else
            echo "::warning::No lockfile found in repo. Falling back to npm install (non-reproducible)."
            npm install --no-audit --no-fund || npm install --no-audit --no-fund --legacy-peer-deps
          fi

      - name: Install EAS CLI (pinned)
        shell: bash
        run: |
          set -euo pipefail
          npm i -g "eas-cli@\${EAS_CLI_VERSION}"
          eas --version

      - name: Verify EAS auth
        shell: bash
        run: |
          set -euo pipefail
          if [ -z "\${EXPO_TOKEN:-}" ]; then
            echo "::error::Missing GitHub Secret EXPO_TOKEN"
            exit 1
          fi
          eas whoami

      - name: Auto-fix repo (lockfile + dev client) [optional writeback]
        shell: bash
        env:
          TARGET_BRANCH: \${{ inputs.ref }}
          PROFILE: \${{ inputs.profile }}
          ALLOWED_REF_REGEX: "^(work|dev|develop|feature/.+|hotfix/.+)$"
        run: |
          set -euo pipefail

          echo "🧯 Auto-fix: lockfile + expo-dev-client (development only)."
          npm config set package-lock true

          if [ "\${PROFILE}" = "development" ]; then
            echo "📦 Ensuring expo-dev-client for development builds..."
            npx --yes expo install expo-dev-client --fix || npx --yes expo install expo-dev-client
          fi

          if [ ! -f package-lock.json ]; then
            echo "::warning::No package-lock.json found. Generating one (best effort)."
            npm install --package-lock-only --no-audit --no-fund
          fi

          if ! git status --porcelain | grep -qE '^( M|\?\?) (package.json|package-lock.json|\.npmrc)$'; then
            echo "ℹ️ No CI auto-fix changes to write back."
            exit 0
          fi

          BR="\${TARGET_BRANCH:-}"
          if [ -z "$BR" ]; then
            echo "::warning::No TARGET_BRANCH provided; skipping writeback."
            exit 0
          fi

          if echo "$BR" | grep -qE '^[0-9a-fA-F]{7,40}$'; then
            echo "::warning::Ref looks like a SHA ($BR). Skipping writeback."
            exit 0
          fi
          if echo "$BR" | grep -qE '[: ]'; then
            echo "::warning::Unsafe ref ($BR). Skipping writeback."
            exit 0
          fi
          if ! echo "$BR" | grep -qE "\${ALLOWED_REF_REGEX}"; then
            echo "::warning::Writeback disabled for branch '$BR' (regex: \${ALLOWED_REF_REGEX})."
            exit 0
          fi

          if ! git ls-remote --exit-code --heads origin "$BR" >/dev/null 2>&1; then
            echo "::warning::Ref '$BR' is not a remote branch. Skipping writeback."
            exit 0
          fi

          echo "✅ Auto-fix changes detected -> committing back to '$BR'."
          git config user.email "actions@users.noreply.github.com"
          git config user.name "github-actions[bot]"
          git add package.json package-lock.json .npmrc 2>/dev/null || true
          git commit -m "chore(ci): auto-fix lockfile/dev-client [skip ci]" || true

          echo "🚀 Pushing to origin $BR (best effort)..."
          git push origin "HEAD:$BR" || echo "::warning::Could not push auto-fix commit (branch may be protected)."

  build:
    needs: [autofix]
    if: \${{ always() && (needs.autofix.result == 'success' || needs.autofix.result == 'skipped') }}
    permissions:
      contents: read

    runs-on: ubuntu-latest
    timeout-minutes: 60

    env:
      EXPO_TOKEN: \${{ secrets.EXPO_TOKEN }}
      EAS_CLI_VERSION: "16.0.0"

      SUPABASE_URL: \${{ secrets.SUPABASE_URL }}
      SUPABASE_SERVICE_ROLE_KEY: \${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
      JOB_ID: \${{ inputs.job_id }}

    steps:
      - name: Validate inputs
        shell: bash
        run: |
          set -euo pipefail

          case "\${{ inputs.profile }}" in
            development|preview|production) ;;
            *)
              echo "::error::Invalid profile: '\${{ inputs.profile }}' (allowed: development|preview|production)"
              exit 1
              ;;
          esac

          if [ -z "\${EXPO_TOKEN:-}" ]; then
            echo "::error::Missing GitHub Secret EXPO_TOKEN"
            exit 1
          fi

          if [ "\${{ inputs.profile }}" = "production" ]; then
            echo "ARTIFACT_EXT=aab" >> "$GITHUB_ENV"
          else
            echo "ARTIFACT_EXT=apk" >> "$GITHUB_ENV"
          fi

          if [ -z "\${JOB_ID:-}" ]; then
            echo "has_job_id=false" >> "$GITHUB_ENV"
          else
            if [ -z "\${SUPABASE_URL:-}" ] || [ -z "\${SUPABASE_SERVICE_ROLE_KEY:-}" ]; then
              echo "::warning::JOB_ID provided, but SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing -> status updates will be skipped."
              echo "has_job_id=false" >> "$GITHUB_ENV"
            else
              echo "has_job_id=true" >> "$GITHUB_ENV"
            fi
          fi

      - name: Checkout
        uses: actions/checkout@34e114876b0b11c390a56381ad16ebd13914f8d5 # v4
        with:
          ref: \${{ inputs.ref }}
          fetch-depth: 0

      - name: Detect lockfile (for cache + install strategy)
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
          elif [ -f yarn.lock ]; then
            echo "has_lockfile=true" >> "$GITHUB_OUTPUT"
            echo "lockfile_path=yarn.lock" >> "$GITHUB_OUTPUT"
          elif [ -f pnpm-lock.yaml ]; then
            echo "has_lockfile=true" >> "$GITHUB_OUTPUT"
            echo "lockfile_path=pnpm-lock.yaml" >> "$GITHUB_OUTPUT"
          else
            echo "has_lockfile=false" >> "$GITHUB_OUTPUT"
            echo "lockfile_path=" >> "$GITHUB_OUTPUT"
          fi
          echo "Repo root: $(pwd)"
          echo "Files:"; ls -lah

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
            echo "Using npm ci (lockfile: \${{ steps.lock.outputs.lockfile_path }})"
            npm ci --no-audit --no-fund || npm ci --no-audit --no-fund --legacy-peer-deps
          else
            echo "::warning::No lockfile found in repo. Falling back to npm install (non-reproducible)."
            npm install --no-audit --no-fund || npm install --no-audit --no-fund --legacy-peer-deps
          fi

      - name: Install EAS CLI (pinned)
        shell: bash
        run: |
          set -euo pipefail
          npm i -g "eas-cli@\${EAS_CLI_VERSION}"
          eas --version

      - name: Verify EAS auth
        shell: bash
        run: |
          set -euo pipefail
          eas whoami

      - name: Update Build Status - Building
        if: env.has_job_id == 'true'
        shell: bash
        run: |
          set -euo pipefail
          TS="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
          RUN_ID="\${{ github.run_id }}"
          PROFILE="\${{ inputs.profile }}"

          JSON="$(node -e 'console.log(JSON.stringify({status:"building",build_profile:process.argv[1],github_run_id:process.argv[2],started_at:process.argv[3]}))' "\${PROFILE}" "\${RUN_ID}" "\${TS}")"

          curl --fail-with-body --silent --show-error             -X PATCH "\${SUPABASE_URL%/}/rest/v1/build_jobs?id=eq.\${JOB_ID}"             -H "apikey: \${SUPABASE_SERVICE_ROLE_KEY}"             -H "Authorization: Bearer \${SUPABASE_SERVICE_ROLE_KEY}"             -H "Content-Type: application/json"             -H "Prefer: return=minimal"             -d "\${JSON}"             || echo "::warning::Failed to update Supabase status (building)"

      - name: Run EAS Build (WAIT)
        id: eas
        shell: bash
        run: |
          set -euo pipefail
          PROFILE="\${{ inputs.profile }}"
          PLATFORM="\${{ inputs.platform }}"

          echo "🚀 Starting EAS build (platform=\${PLATFORM}, profile=\${PROFILE}) with --wait..."
          BUILD_OUTPUT="$(eas build --platform "\${PLATFORM}" --profile "\${PROFILE}" --non-interactive --wait 2>&1)" || {
            CODE=$?
            echo "\${BUILD_OUTPUT}"
            echo "::error::EAS build failed (exit \${CODE})"
            exit "\${CODE}"
          }

          echo "\${BUILD_OUTPUT}"

          UUID_RE='[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}'
          BUILD_ID="$(echo "\${BUILD_OUTPUT}" | grep -oE "\${UUID_RE}" | head -n1 || true)"
          if [ -z "\${BUILD_ID}" ]; then BUILD_ID="unknown"; fi
          echo "build_id=\${BUILD_ID}" >> "\${GITHUB_OUTPUT}"

          BUILD_URL="$(echo "\${BUILD_OUTPUT}" | grep -oE "https://expo.dev[^[:space:]]*/builds/\${UUID_RE}" | head -n1 || true)"
          echo "build_url=\${BUILD_URL}" >> "\${GITHUB_OUTPUT}"
      - name: Download Android Artifact
        if: steps.eas.outputs.build_id != 'unknown' && steps.eas.outputs.build_id != ''
        continue-on-error: true
        shell: bash
        run: |
          set -euo pipefail
          mkdir -p build
          OUT="build/k1w1-\${{ inputs.profile }}.\${ARTIFACT_EXT}"
          eas build:download             --id "\${{ steps.eas.outputs.build_id }}"             --output "\${OUT}" || {
              echo "::warning::Failed to download artifact"
              exit 0
            }
          ls -lah build || true

      - name: Upload Artifact
        if: always()
        continue-on-error: true
        uses: actions/upload-artifact@4cec3d8aa04e39d1a68397de0c4cd6fb9dce8ec1 # v4
        with:
          name: eas-\${{ inputs.platform }}-\${{ inputs.profile }}-\${{ github.run_number }}
          path: build/*
          retention-days: 30
          if-no-files-found: warn

      - name: Summary
        if: always()
        shell: bash
        run: |
          cat >> "$GITHUB_STEP_SUMMARY" << EOF
          ## EAS Build Summary

          - Repo: \${{ github.repository }}
          - Input ref: \${{ inputs.ref }}
          - Input profile: \${{ inputs.profile }}
          - Platform: \${{ inputs.platform }}
          - Checked out: $(git rev-parse HEAD)
          - Lockfile present: \${{ steps.lock.outputs.has_lockfile }}
          - Lockfile path: \${{ steps.lock.outputs.lockfile_path }}
          - EAS CLI: $(eas --version 2>/dev/null || echo "unknown")
          - Build ID: \${{ steps.eas.outputs.build_id }}
          - Build URL: \${{ steps.eas.outputs.build_url }}

          Artifacts: https://github.com/\${{ github.repository }}/actions/runs/\${{ github.run_id }}
          EOF

      - name: Update Build Status - Success
        if: success() && env.has_job_id == 'true'
        shell: bash
        run: |
          set -euo pipefail
          TS="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
          RUN_ID="\${{ github.run_id }}"
          BUILD_ID="\${{ steps.eas.outputs.build_id }}"
          BUILD_URL="\${{ steps.eas.outputs.build_url }}"

          JSON="$(node -e 'console.log(JSON.stringify({status:"completed",github_run_id:process.argv[1],eas_build_id:process.argv[2],build_url:(process.argv[3]||null),completed_at:process.argv[4]}))' "\${RUN_ID}" "\${BUILD_ID}" "\${BUILD_URL}" "\${TS}")"

          curl --fail-with-body --silent --show-error             -X PATCH "\${SUPABASE_URL%/}/rest/v1/build_jobs?id=eq.\${JOB_ID}"             -H "apikey: \${SUPABASE_SERVICE_ROLE_KEY}"             -H "Authorization: Bearer \${SUPABASE_SERVICE_ROLE_KEY}"             -H "Content-Type: application/json"             -H "Prefer: return=minimal"             -d "\${JSON}"             || echo "::warning::Failed to update Supabase status (success)"

      - name: Update Build Status - Failed
        if: failure() && env.has_job_id == 'true'
        shell: bash
        run: |
          set -euo pipefail
          TS="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
          RUN_ID="\${{ github.run_id }}"
          ERR="Build failed. Check logs: https://github.com/\${{ github.repository }}/actions/runs/\${{ github.run_id }}"

          JSON="$(node -e 'console.log(JSON.stringify({status:"error",github_run_id:process.argv[1],error_message:process.argv[2],completed_at:process.argv[3]}))' "\${RUN_ID}" "\${ERR}" "\${TS}")"

          curl --fail-with-body --silent --show-error             -X PATCH "\${SUPABASE_URL%/}/rest/v1/build_jobs?id=eq.\${JOB_ID}"             -H "apikey: \${SUPABASE_SERVICE_ROLE_KEY}"             -H "Authorization: Bearer \${SUPABASE_SERVICE_ROLE_KEY}"             -H "Content-Type: application/json"             -H "Prefer: return=minimal"             -d "\${JSON}"             || echo "::warning::Failed to update Supabase status (failed)"
`,
  "release-build.yml": `name: Release Build (WAIT)

on:
  workflow_dispatch:
    inputs:
      profile:
        description: "EAS build profile"
        required: true
        type: choice
        options: [production, preview, development]
        default: production
      ref:
        description: "Branch/Tag/SHA (optional)"
        required: false
        default: "work"

permissions:
  contents: write

concurrency:
  group: \${{ github.workflow }}-\${{ inputs.ref }}-\${{ inputs.profile }}
  cancel-in-progress: false

jobs:
  build:
    name: Android Release Build
    runs-on: ubuntu-latest
    timeout-minutes: 60

    env:
      EXPO_TOKEN: \${{ secrets.EXPO_TOKEN }}
      EAS_CLI_VERSION: "16.0.0"

    steps:
      - name: Checkout repository
        uses: actions/checkout@34e114876b0b11c390a56381ad16ebd13914f8d5 # v4
        with:
          ref: \${{ inputs.ref }}
          fetch-depth: 0
          persist-credentials: true

      - name: Detect lockfile (for cache + install strategy)
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
          elif [ -f yarn.lock ]; then
            echo "has_lockfile=true" >> "$GITHUB_OUTPUT"
            echo "lockfile_path=yarn.lock" >> "$GITHUB_OUTPUT"
          elif [ -f pnpm-lock.yaml ]; then
            echo "has_lockfile=true" >> "$GITHUB_OUTPUT"
            echo "lockfile_path=pnpm-lock.yaml" >> "$GITHUB_OUTPUT"
          else
            echo "has_lockfile=false" >> "$GITHUB_OUTPUT"
            echo "lockfile_path=" >> "$GITHUB_OUTPUT"
          fi
          echo "Repo root: $(pwd)"
          echo "Files:"; ls -lah

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

      - name: Validate secrets
        shell: bash
        run: |
          set -euo pipefail
          if [ -z "\${EXPO_TOKEN:-}" ]; then
            echo "::error::Missing GitHub Secret EXPO_TOKEN"
            exit 1
          fi
          echo "✅ EXPO_TOKEN present (len=\${#EXPO_TOKEN})"
          echo "Using profile='\${{ inputs.profile }}', ref='\${{ inputs.ref }}'"

      - name: Install deps (reproducible when possible)
        shell: bash
        run: |
          set -euo pipefail
          if [ "\${{ steps.lock.outputs.has_lockfile }}" = "true" ]; then
            echo "Using npm ci (lockfile: \${{ steps.lock.outputs.lockfile_path }})"
            npm ci --no-audit --no-fund || npm ci --no-audit --no-fund --legacy-peer-deps
          else
            echo "::warning::No lockfile found. Falling back to npm install."
            npm install --no-audit --no-fund || npm install --no-audit --no-fund --legacy-peer-deps
            if [ ! -f package-lock.json ]; then
              npm install --package-lock-only --no-audit --no-fund || true
            fi
          fi

      - name: Ensure expo-dev-client for development builds
        if: inputs.profile == 'development'
        shell: bash
        run: |
          set -euo pipefail
          if node -e 'const p=require("./package.json"); const d={...(p.dependencies||{}),...(p.devDependencies||{})}; process.exit(d["expo-dev-client"]?0:1)'; then
            echo "expo-dev-client already present."
          else
            echo "::warning::expo-dev-client missing -> installing via expo install"
            npx --yes expo install expo-dev-client
          fi

      - name: Install EAS CLI (pinned)
        shell: bash
        run: |
          set -euo pipefail
          npm i -g "eas-cli@\${EAS_CLI_VERSION}"
          eas --version

      - name: Verify EAS authentication
        shell: bash
        run: |
          set -euo pipefail
          eas whoami

      - name: Run EAS build (WAIT)
        id: eas
        shell: bash
        run: |
          set -euo pipefail

          PROFILE="\${{ inputs.profile }}"
          if [ "$PROFILE" = "production" ]; then EXT="aab"; else EXT="apk"; fi
          echo "artifact_ext=\${EXT}" >> "\${GITHUB_OUTPUT}"

          echo "🚀 Starting EAS build (platform=android, profile=\${PROFILE}) with --wait..."
          BUILD_OUTPUT="$(eas build --platform android --profile "\${PROFILE}" --non-interactive --wait 2>&1)" || {
            CODE=$?
            echo "\${BUILD_OUTPUT}"
            echo "::error::EAS build failed (exit \${CODE})"
            exit "\${CODE}"
          }

          echo "\${BUILD_OUTPUT}"

          UUID_RE='[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}'
          BUILD_ID="$(echo "\${BUILD_OUTPUT}" | grep -oE "\${UUID_RE}" | head -n1 || true)"
          if [ -z "\${BUILD_ID}" ]; then BUILD_ID="unknown"; fi
          echo "build_id=\${BUILD_ID}" >> "\${GITHUB_OUTPUT}"

          BUILD_URL="$(echo "\${BUILD_OUTPUT}" | grep -oE "https://expo.dev[^[:space:]]*/builds/\${UUID_RE}" | head -n1 || true)"
          echo "build_url=\${BUILD_URL}" >> "\${GITHUB_OUTPUT}"

      - name: Download Android Artifact
        if: steps.eas.outputs.build_id != 'unknown' && steps.eas.outputs.build_id != ''
        continue-on-error: true
        shell: bash
        run: |
          set -euo pipefail
          mkdir -p build
          OUT="build/k1w1-\${{ inputs.profile }}.\${{ steps.eas.outputs.artifact_ext }}"
          eas build:download --id "\${{ steps.eas.outputs.build_id }}" --output "\${OUT}" || {
            echo "::warning::Failed to download artifact"
            exit 0
          }
          ls -lah build || true

      - name: Upload Android Artifact
        if: always()
        continue-on-error: true
        uses: actions/upload-artifact@4cec3d8aa04e39d1a68397de0c4cd6fb0d8b62a3 # v4
        with:
          name: k1w1-android-\${{ inputs.profile }}-\${{ github.run_number }}
          path: build/*
          retention-days: 30
          if-no-files-found: warn

      - name: Persist generated lockfile / dev-client changes (optional)
        if: always()
        shell: bash
        run: |
          set -euo pipefail
          if [ -z "$(git status --porcelain)" ]; then
            echo "No repo changes to persist."
            exit 0
          fi

          BRANCH="$(git symbolic-ref --short -q HEAD || true)"
          if [ -z "$BRANCH" ]; then
            echo "::warning::Detached HEAD -> not pushing changes."
            exit 0
          fi

          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git add package.json package-lock.json eas-project.json 2>/dev/null || true
          git commit -m "chore(ci): persist build deps [skip ci]" || true
          git push origin "$BRANCH" || true

      - name: Summary
        if: always()
        shell: bash
        run: |
          set -euo pipefail
          {
            echo "## Release Build Summary"
            echo ""
            echo "- Ref: \${{ inputs.ref }}"
            echo "- Profile: \${{ inputs.profile }}"
            echo "- Checked out: $(git rev-parse HEAD)"
            echo "- Lockfile present: \${{ steps.lock.outputs.has_lockfile }}"
            echo "- EAS CLI: $(eas --version 2>/dev/null || echo unknown)"
            echo "- Build ID: \${{ steps.eas.outputs.build_id }}"
            echo "- Build URL: \${{ steps.eas.outputs.build_url }}"
            echo ""
            echo "Run: https://github.com/\${GITHUB_REPOSITORY}/actions/runs/\${GITHUB_RUN_ID}"
          } >> "$GITHUB_STEP_SUMMARY"
`,
  "eas-link.yml": `name: EAS Link / Init

on:
  workflow_dispatch:
    inputs:
      ref:
        description: "Branch/Tag/SHA (optional)"
        required: false
        default: "work"
      eas_project_id:
        description: "Existing EAS Project ID (optional)"
        required: false
        type: string
      expo_owner:
        description: "Expo account/organization (optional)"
        required: false
        type: string

permissions:
  contents: write

concurrency:
  group: \${{ github.workflow }}-\${{ inputs.ref }}
  cancel-in-progress: false

jobs:
  link:
    runs-on: ubuntu-latest
    timeout-minutes: 20

    env:
      EXPO_TOKEN: \${{ secrets.EXPO_TOKEN }}
      EAS_CLI_VERSION: "16.0.0"
      EAS_PROJECT_ID_INPUT: \${{ inputs.eas_project_id }}
      EXPO_OWNER_INPUT: \${{ inputs.expo_owner }}

    steps:
      - name: Checkout
        uses: actions/checkout@34e114876b0b11c390a56381ad16ebd13914f8d5 # v4
        with:
          ref: \${{ inputs.ref }}
          fetch-depth: 0
          persist-credentials: true

      - name: Setup Node
        uses: actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020 # v4
        with:
          node-version: 20

      - name: Validate secrets
        shell: bash
        run: |
          set -euo pipefail
          if [ -z "\${EXPO_TOKEN:-}" ]; then
            echo "::error::Missing GitHub Secret EXPO_TOKEN"
            exit 1
          fi
          echo "✅ EXPO_TOKEN present (len=\${#EXPO_TOKEN})"
          echo "Ref: \${{ inputs.ref }}"
          echo "EAS_PROJECT_ID_INPUT: \${EAS_PROJECT_ID_INPUT:-<empty>}"
          echo "EXPO_OWNER_INPUT: \${EXPO_OWNER_INPUT:-<empty>}"

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
          elif [ -f yarn.lock ]; then
            echo "has_lockfile=true" >> "$GITHUB_OUTPUT"
            echo "lockfile_path=yarn.lock" >> "$GITHUB_OUTPUT"
          elif [ -f pnpm-lock.yaml ]; then
            echo "has_lockfile=true" >> "$GITHUB_OUTPUT"
            echo "lockfile_path=pnpm-lock.yaml" >> "$GITHUB_OUTPUT"
          else
            echo "has_lockfile=false" >> "$GITHUB_OUTPUT"
            echo "lockfile_path=" >> "$GITHUB_OUTPUT"
          fi

      - name: Install deps (reproducible when possible)
        shell: bash
        run: |
          set -euo pipefail
          if [ "\${{ steps.lock.outputs.has_lockfile }}" = "true" ]; then
            echo "Using npm ci (lockfile: \${{ steps.lock.outputs.lockfile_path }})"
            npm ci --no-audit --no-fund || npm ci --no-audit --no-fund --legacy-peer-deps
          else
            echo "::warning::No lockfile found. Falling back to npm install."
            npm install --no-audit --no-fund || npm install --no-audit --no-fund --legacy-peer-deps
            if [ ! -f package-lock.json ]; then
              npm install --package-lock-only --no-audit --no-fund || true
            fi
          fi

      - name: Install EAS CLI (pinned)
        shell: bash
        run: |
          set -euo pipefail
          npm i -g "eas-cli@\${EAS_CLI_VERSION}"
          eas --version

      - name: Verify EAS auth (whoami)
        shell: bash
        run: |
          set -euo pipefail
          eas whoami

      - name: EAS project:init (link/create)
        shell: bash
        run: |
          set -euo pipefail

          OWNER_ARGS=()
          if [ -n "\${EXPO_OWNER_INPUT:-}" ]; then
            OWNER_ARGS=(--owner "\${EXPO_OWNER_INPUT}")
          fi

          if [ -n "\${EAS_PROJECT_ID_INPUT:-}" ]; then
            echo "Linking with EAS Project ID: \${EAS_PROJECT_ID_INPUT}"
            eas project:init --id "\${EAS_PROJECT_ID_INPUT}" --non-interactive --force "\${OWNER_ARGS[@]}"
            node -e 'const fs=require("fs"); fs.writeFileSync("eas-project.json", JSON.stringify({projectId: process.argv[1]}, null, 2)+"\n");' "\${EAS_PROJECT_ID_INPUT}"
          else
            echo "No EAS Project ID provided. Running project:init and keeping generated eas-project.json..."
            eas project:init --non-interactive --force "\${OWNER_ARGS[@]}"
            if [ ! -f eas-project.json ]; then
              echo "::warning::eas-project.json not found after project:init. Trying to read projectId from expo config..."
              npx --yes expo config --json > /tmp/expo-config.json
              PROJECT_ID="$(node -e 'const c=require("/tmp/expo-config.json"); process.stdout.write(String(c?.expo?.extra?.eas?.projectId||""));')"
              if [ -z "\${PROJECT_ID}" ]; then
                echo "::error::Could not determine EAS projectId. Provide eas_project_id input (UUID) and re-run."
                exit 1
              fi
              node -e 'const fs=require("fs"); fs.writeFileSync("eas-project.json", JSON.stringify({projectId: process.argv[1]}, null, 2)+"\n");' "\${PROJECT_ID}"
            fi
          fi

          echo "eas-project.json:"
          cat eas-project.json || true

      - name: Commit changes (if any)
        shell: bash
        run: |
          set -euo pipefail

          if [ -z "$(git status --porcelain)" ]; then
            echo "No changes to commit."
            exit 0
          fi

          BRANCH="$(git symbolic-ref --short -q HEAD || true)"
          if [ -z "$BRANCH" ]; then
            echo "::warning::Detached HEAD -> not pushing changes."
            exit 0
          fi

          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git add -A
          git commit -m "chore(eas): link/init projectId [skip ci]" || true
          git push origin "$BRANCH" || true

      - name: Summary
        if: always()
        shell: bash
        run: |
          set -euo pipefail
          {
            echo "## EAS Link / Init Summary"
            echo ""
            echo "- Ref: \${{ inputs.ref }}"
            echo "- SHA: \${GITHUB_SHA}"
            echo "- Checked out: $(git rev-parse HEAD)"
            echo "- EAS CLI: $(eas --version 2>/dev/null || echo unknown)"
            echo "- Has EXPO_TOKEN: $([ -n "\${EXPO_TOKEN:-}" ] && echo yes || echo no)"
            echo ""
            echo "Run: https://github.com/\${GITHUB_REPOSITORY}/actions/runs/\${GITHUB_RUN_ID}"
          } >> "$GITHUB_STEP_SUMMARY"
`,
};

export const REQUIRED_SECRETS = ["EXPO_TOKEN"];

// Optional (used only for in-app status updates if you pass a job_id)
// NOTE: Do NOT require these; service-role keys should not be distributed broadly.

export async function checkRepoSecrets(
  owner: string,
  repo: string,
): Promise<SecretsCheck> {
  const present = await listRepoSecretNames(owner, repo);
  const missing = REQUIRED_SECRETS.filter((s) => !present.includes(s));
  return {
    required: [...REQUIRED_SECRETS],
    present,
    missing,
  };
}

export async function autoFixCIWorkflows(params: {
  owner: string;
  repo: string;
  branch: string;
}): Promise<CiFixChange[]> {
  const { owner, repo, branch } = params;

  const results: CiFixChange[] = [];
  const entries = Object.entries(WORKFLOWS);

  for (const [fileName, desired] of entries) {
    const path = `.github/workflows/${fileName}`;

    let current = "";
    try {
      current = await getRepoFileText({ owner, repo, path, ref: branch });
    } catch {
      // file missing -> treat as empty
      current = "";
    }

    const normalizedCurrent = (current || "").replace(/\r\n/g, "\n");
    const normalizedDesired = (desired || "").replace(/\r\n/g, "\n");

    if (normalizedCurrent.trim() === normalizedDesired.trim()) {
      results.push({
        path,
        changed: false,
        message: "OK (already up to date)",
      });
      continue;
    }

    await createOrUpdateFile(
      owner,
      repo,
      path,
      normalizedDesired,
      `fix(ci): update ${fileName}`,
      branch,
    );

    results.push({
      path,
      changed: true,
      message: "Updated",
    });
  }

  // Ensure repo ignores patch ZIPs produced by this builder (avoid accidentally committing patch bundles)
  // We keep this narrow (k1w1-* + *_patch*) and do NOT ignore all *.zip to avoid breaking repos that legitimately version zip assets.
  const giPath = ".gitignore";
  const giMarker = "# --- k1w1 apk-builder: ignore patch zips ---";
  const giBlock =
    giMarker +
    "\n" +
    [
      "k1w1-*.zip",
      "*_patch*.zip",
      "project_src_*.zip",
      "project_dump_*.zip",
      "k1w1-*-patch.zip",
      "k1w1-*-hotfix*.zip",
    ].join("\n") +
    "\n";

  try {
    const existing = await getRepoFileText({
      owner,
      repo,
      path: giPath,
      ref: branch,
    });
    if (!existing.includes(giMarker)) {
      const next = (existing.trimEnd() + "\n\n" + giBlock).replace(
        /\r\n/g,
        "\n",
      );
      await createOrUpdateFile(
        owner,
        repo,
        giPath,
        next,
        "chore(ci): ignore patch zips",
        branch,
      );
      results.push({
        path: giPath,
        changed: true,
        message: "Updated .gitignore to ignore patch ZIPs",
      });
    } else {
      results.push({
        path: giPath,
        changed: false,
        message: ".gitignore already ignores patch ZIPs",
      });
    }
  } catch (e) {
    const msg = String((e as any)?.message || e || "");
    const looksMissing =
      msg.includes("404") || msg.toLowerCase().includes("not found");
    if (!looksMissing) {
      results.push({
        path: giPath,
        changed: false,
        message: `Skipped .gitignore update (could not read existing file): ${msg.slice(0, 120)}`,
      });
    } else {
      // .gitignore missing -> create a minimal one with the ignore block
      const next = (giBlock + "\n").replace(/\r\n/g, "\n");
      await createOrUpdateFile(
        owner,
        repo,
        giPath,
        next,
        "chore(ci): add .gitignore for patch zips",
        branch,
      );
      results.push({
        path: giPath,
        changed: true,
        message: "Created .gitignore to ignore patch ZIPs",
      });
    }
  }

  return results;
}
