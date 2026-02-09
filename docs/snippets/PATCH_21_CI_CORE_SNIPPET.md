# ---- PATCH 21 snippet (replace your "Expo config smoke test" run block) ----
- name: Expo config smoke test (projectId present)
  shell: bash
  run: |
    set -euo pipefail
    export EAS_PROJECT_ID="$(node scripts/getEasProjectId.js)"
    # optional: keep public env in sync too
    export EXPO_PUBLIC_EAS_PROJECT_ID="$EAS_PROJECT_ID"
    npx --no-install expo config --json > /tmp/expo-config.json
    PROJECT_ID="$(node -e 'const c=require("/tmp/expo-config.json"); process.stdout.write(String(c?.expo?.extra?.eas?.projectId||""))')"
    if [ -z "${PROJECT_ID}" ]; then
      echo "::error::expo.extra.eas.projectId missing (expected app.config.js to set it)"
      echo "--- diagnostics ---"
      echo "PWD: $(pwd)"
      echo "Has eas-project.json?"; ls -la eas-project.json || true
      echo "eas-project.json (if present):"; cat eas-project.json || true
      echo "expo config snippet:"; node -e 'const c=require("/tmp/expo-config.json"); console.log(JSON.stringify({ extra: c?.expo?.extra }, null, 2));'
      exit 1
    fi
    echo "✅ expo.extra.eas.projectId: ${PROJECT_ID}"
# ---- end snippet ----
