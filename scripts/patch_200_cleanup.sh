#!/usr/bin/env bash
set -euo pipefail

# Patch 200 cleanup: remove confirmed dead preview files.
rm -f styles/previewScreenStyles.ts 2>/dev/null || true
rm -f lib/previewSettings.ts 2>/dev/null || true

echo "Patch 200 cleanup done."
