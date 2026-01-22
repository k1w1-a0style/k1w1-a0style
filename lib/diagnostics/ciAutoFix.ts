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
        default: "main"
      profile:
        description: "EAS build profile (development|preview|production)"
        required: false
        default: "preview"
      job_id:
        description: "Supabase build job id"
        required: false
        default: ""

concurrency:
  group: >-
    \${{ github.workflow }}-\${{ github.event_name }}-
    \${{ github.event.client_payload.branch || github.event.client_payload.ref || inputs.ref || github.ref }}-
    \${{ github.event.client_payload.build_profile || github.event.client_payload.buildProfile || inputs.profile || 'preview' }}
  cancel-in-progress: false

permissions:
  contents: write

jobs:
  build:
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
            npm ci --no-audit --no-fund
          else
            echo "::warning::No lockfile found in repo. Falling back to npm install (non-reproducible)."
            npm install --no-audit --no-fund
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

      - name: Self-heal repo (lockfile + dev client) [commit back]
        shell: bash
        env:
          TARGET_BRANCH: \${{ env.CHECKOUT_REF }}
          PROFILE: \${{ env.PROFILE }}
        run: |
          set -euo pipefail

          echo "🧯 Self-heal: ensure lockfile + expo-dev-client (if development)."
          npm config set package-lock true

          if [ "\${PROFILE}" = "development" ]; then
            echo "📦 Ensuring expo-dev-client for development builds..."
            npx expo install expo-dev-client --fix || npx expo install expo-dev-client
          fi

          if [ ! -f package-lock.json ]; then
            echo "📌 Generating package-lock.json..."
            npm install --package-lock-only --no-audit --no-fund
          fi

          if git status --porcelain | grep -qE '^( M|??) (package.json|package-lock.json|.npmrc)$'; then
            echo "✅ Changes detected -> committing back to repo."
            git config user.email "actions@users.noreply.github.com"
            git config user.name "github-actions[bot]"
            git add package.json package-lock.json .npmrc 2>/dev/null || true
            git commit -m "chore(ci): self-heal lockfile/dev-client" || true
            BR="\${TARGET_BRANCH:-}"
            if [ -z "$BR" ]; then BR="$(git rev-parse --abbrev-ref HEAD)"; fi
            echo "🚀 Pushing to origin $BR (best effort)..."
            git push origin "HEAD:$BR" || echo "::warning::Could not push self-heal commit (branch may be protected or ref is not a branch)."
          else
            echo "ℹ️ No relevant changes to commit."
          fi

      - name: Run EAS Build (WAIT)
        id: eas
        shell: bash
        run: |
          set -euo pipefail
          echo "🚀 Starting EAS build (android, profile=\${PROFILE}) with --wait..."

          BUILD_OUTPUT="$(eas build             --platform android             --profile "\${PROFILE}"             --non-interactive             --wait             2>&1)" || {
              CODE=$?
              echo "\${BUILD_OUTPUT}"
              echo "::error::EAS build failed (exit \${CODE})"
              exit "\${CODE}"
            }

          echo "\${BUILD_OUTPUT}"

          BUILD_ID="$(echo "\${BUILD_OUTPUT}" | grep -oE "Build ID:[[:space:]]*[a-fA-F0-9-]+" | head -n1 | awk '{print $3}' || true)"
          if [ -z "\${BUILD_ID}" ]; then BUILD_ID="unknown"; fi
          echo "build_id=\${BUILD_ID}" >> "\${GITHUB_OUTPUT}"

          BUILD_URL="$(echo "\${BUILD_OUTPUT}" | grep -oE "https?://[^[:space:]]+" | grep -E "/projects/[^/]+/builds/[a-fA-F0-9-]+" | head -n1 || true)"
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
          EOF`,
  "eas-build.yml": `name: EAS Build

on:
  workflow_dispatch:
    inputs:
      ref:
        description: "Branch/Tag/SHA to build"
        required: false
        default: "main"
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

permissions:
  contents: write

concurrency:
  group: eas-build-\${{ inputs.ref }}-\${{ inputs.profile }}
  cancel-in-progress: false

jobs:
  build:
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
            npm ci --no-audit --no-fund
          else
            echo "::warning::No lockfile found in repo. Falling back to npm install (non-reproducible)."
            npm install --no-audit --no-fund
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

      - name: Self-heal repo (lockfile + dev client) [commit back]
        shell: bash
        env:
          TARGET_BRANCH: \${{ inputs.ref }}
          PROFILE: \${{ inputs.profile }}
        run: |
          set -euo pipefail

          echo "🧯 Self-heal: ensure lockfile + expo-dev-client (if development)."
          npm config set package-lock true

          if [ "\${PROFILE}" = "development" ]; then
            echo "📦 Ensuring expo-dev-client for development builds..."
            npx expo install expo-dev-client --fix || npx expo install expo-dev-client
          fi

          if [ ! -f package-lock.json ]; then
            echo "📌 Generating package-lock.json..."
            npm install --package-lock-only --no-audit --no-fund
          fi

          if git status --porcelain | grep -qE '^( M|??) (package.json|package-lock.json|.npmrc)$'; then
            echo "✅ Changes detected -> committing back to repo."
            git config user.email "actions@users.noreply.github.com"
            git config user.name "github-actions[bot]"
            git add package.json package-lock.json .npmrc 2>/dev/null || true
            git commit -m "chore(ci): self-heal lockfile/dev-client" || true
            BR="\${TARGET_BRANCH:-}"
            if [ -z "$BR" ]; then BR="$(git rev-parse --abbrev-ref HEAD)"; fi
            echo "🚀 Pushing to origin $BR (best effort)..."
            git push origin "HEAD:$BR" || echo "::warning::Could not push self-heal commit (branch may be protected or ref is not a branch)."
          else
            echo "ℹ️ No relevant changes to commit."
          fi

      - name: Run EAS Build (WAIT)
        id: eas
        shell: bash
        run: |
          set -euo pipefail
          PROFILE="\${{ inputs.profile }}"
          PLATFORM="\${{ inputs.platform }}"

          echo "🚀 Starting EAS build (platform=\${PLATFORM}, profile=\${PROFILE}) with --wait..."

          BUILD_OUTPUT="$(eas build             --platform "\${PLATFORM}"             --profile "\${PROFILE}"             --non-interactive             --wait             2>&1)" || {
              CODE=$?
              echo "\${BUILD_OUTPUT}"
              echo "::error::EAS build failed (exit \${CODE})"
              exit "\${CODE}"
            }

          echo "\${BUILD_OUTPUT}"

          BUILD_ID="$(echo "\${BUILD_OUTPUT}" | grep -oE "Build ID:[[:space:]]*[a-fA-F0-9-]+" | head -n1 | awk '{print $3}' || true)"
          if [ -z "\${BUILD_ID}" ]; then BUILD_ID="unknown"; fi
          echo "build_id=\${BUILD_ID}" >> "\${GITHUB_OUTPUT}"

          BUILD_URL="$(echo "\${BUILD_OUTPUT}" | grep -oE "https?://[^[:space:]]+" | grep -E "/projects/[^/]+/builds/[a-fA-F0-9-]+" | head -n1 || true)"
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

          curl --fail-with-body --silent --show-error             -X PATCH "\${SUPABASE_URL%/}/rest/v1/build_jobs?id=eq.\${JOB_ID}"             -H "apikey: \${SUPABASE_SERVICE_ROLE_KEY}"             -H "Authorization: Bearer \${SUPABASE_SERVICE_ROLE_KEY}"             -H "Content-Type: application/json"             -H "Prefer: return=minimal"             -d "\${JSON}"             || echo "::warning::Failed to update Supabase status (failed)"`,
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
        default: "main"

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
            echo "::error::Missing EXPO_TOKEN secret"
            exit 1
          fi

      - name: Install dependencies (frozen if possible)
        shell: bash
        run: |
          set -euo pipefail
          if [ "\${{ steps.lock.outputs.has_lockfile }}" = "true" ]; then
            echo "Using npm ci (lockfile: \${{ steps.lock.outputs.lockfile_path }})"
            npm ci --no-audit --no-fund
          else
            echo "::warning::No lockfile found in repo. Falling back to npm install (non-reproducible)."
            npm install --no-audit --no-fund
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

          if [ "$PROFILE" = "production" ]; then
            EXT="aab"
          else
            EXT="apk"
          fi
          echo "artifact_ext=\${EXT}" >> "\${GITHUB_OUTPUT}"

          echo "🚀 Starting EAS build (platform=android, profile=\${PROFILE}) with --wait..."

          BUILD_OUTPUT="$(eas build             --platform android             --profile "\${PROFILE}"             --non-interactive             --wait             2>&1)" || {
              CODE=$?
              echo "\${BUILD_OUTPUT}"
              echo "::error::EAS build failed (exit \${CODE})"
              exit "\${CODE}"
            }

          echo "\${BUILD_OUTPUT}"

          BUILD_ID="$(echo "\${BUILD_OUTPUT}" | grep -oE "Build ID:[[:space:]]*[a-fA-F0-9-]+" | head -n1 | awk '{print $3}' || true)"
          if [ -z "\${BUILD_ID}" ]; then BUILD_ID="unknown"; fi
          echo "build_id=\${BUILD_ID}" >> "\${GITHUB_OUTPUT}"

          BUILD_URL="$(echo "\${BUILD_OUTPUT}" | grep -oE "https?://[^[:space:]]+" | grep -E "/projects/[^/]+/builds/[a-fA-F0-9-]+" | head -n1 || true)"
          echo "build_url=\${BUILD_URL}" >> "\${GITHUB_OUTPUT}"

      - name: Download Android Artifact
        if: steps.eas.outputs.build_id != 'unknown' && steps.eas.outputs.build_id != ''
        continue-on-error: true
        shell: bash
        run: |
          set -euo pipefail
          mkdir -p build
          OUT="build/k1w1-\${{ inputs.profile }}.\${{ steps.eas.outputs.artifact_ext }}"
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
          name: k1w1-android-\${{ inputs.profile }}-\${{ github.run_number }}
          path: build/*
          retention-days: 30
          if-no-files-found: warn`,
  "eas-link.yml": `name: EAS Link / Init

on:
  workflow_dispatch:
    inputs:
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
  group: \${{ github.workflow }}-\${{ github.ref }}
  cancel-in-progress: false

jobs:
  link:
    runs-on: ubuntu-latest
    timeout-minutes: 20

    env:
      EXPO_TOKEN: \${{ secrets.EXPO_TOKEN }}
      EAS_CLI_VERSION: "16.0.0"
      EAS_PROJECT_ID_INPUT: \${{ github.event.inputs.eas_project_id }}
      EXPO_OWNER_INPUT: \${{ github.event.inputs.expo_owner }}

    steps:
      - name: Checkout
        uses: actions/checkout@34e114876b0b11c390a56381ad16ebd13914f8d5 # v4
        with:
          fetch-depth: 1

      - name: Setup Node
        uses: actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020 # v4
        with:
          node-version: 20
      - name: Diagnostics (commit + branch + token presence)
        shell: bash
        run: |
          set -euo pipefail
          echo "GITHUB_REF=\${GITHUB_REF}"
          echo "GITHUB_SHA=\${GITHUB_SHA}"
          echo "Checked out: $(git rev-parse HEAD)"

          if [ -z "\${EXPO_TOKEN:-}" ]; then
            echo "::error::Missing EXPO_TOKEN secret. Add GitHub Secret EXPO_TOKEN."
            exit 1
          fi
          echo "EXPO_TOKEN present (len=\${#EXPO_TOKEN})"

          echo "" 
          echo "Workflow sanity (first 80 lines):"
          sed -n '1,80p' .github/workflows/eas-link.yml

      - name: Install deps (frozen)
        run: npm ci --no-audit --no-fund

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

      - name: EAS project:init (link / create)
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
            node -e 'const fs=require("fs"); fs.writeFileSync("eas-project.json", JSON.stringify({projectId: process.argv[1]}, null, 2)+"\\n");' "\${EAS_PROJECT_ID_INPUT}"
          else
            echo "No EAS Project ID provided. Running project:init and extracting projectId from expo config..."
            eas project:init --non-interactive --force "\${OWNER_ARGS[@]}"

            npx --no-install expo config --json > /tmp/expo-config.json
            PROJECT_ID="$(node -e 'const c=require("/tmp/expo-config.json"); process.stdout.write(String(c?.expo?.extra?.eas?.projectId||""));')"

            if [ -z "\${PROJECT_ID}" ]; then
              echo "::error::Could not determine EAS projectId. Provide eas_project_id input (UUID) and re-run."
              exit 1
            fi

            node -e 'const fs=require("fs"); fs.writeFileSync("eas-project.json", JSON.stringify({projectId: process.argv[1]}, null, 2)+"\\n");' "\${PROJECT_ID}"
            echo "✅ Wrote eas-project.json with projectId=\${PROJECT_ID}"
          fi

      - name: Summary
        if: always()
        shell: bash
        run: |
          set -euo pipefail
          {
            echo "## EAS Link / Init Summary"
            echo ""
            echo "- Ref: \${GITHUB_REF}"
            echo "- SHA: \${GITHUB_SHA}"
            echo "- Checked out: $(git rev-parse HEAD)"
            echo "- EAS CLI: $(eas --version 2>/dev/null || echo unknown)"
            echo "- Has EXPO_TOKEN: $([ -n \\"\${EXPO_TOKEN:-}\\" ] && echo yes || echo no)"
            echo ""
            echo "Run: https://github.com/\${GITHUB_REPOSITORY}/actions/runs/\${GITHUB_RUN_ID}"
          } >> "$GITHUB_STEP_SUMMARY"

      - name: Commit changes (if any)
        shell: bash
        run: |
          set -euo pipefail
          if [ -n "$(git status --porcelain)" ]; then
            git config user.name "github-actions[bot]"
            git config user.email "github-actions[bot]@users.noreply.github.com"
            git add -A
            git commit -m "chore(eas): link/init projectId"
            git push
          else
            echo "No changes to commit."
          fi`,
};

export const REQUIRED_SECRETS = [
  "EXPO_TOKEN",
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
];

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

  return results;
}
