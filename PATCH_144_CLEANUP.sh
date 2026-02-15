#!/usr/bin/env bash
set -euo pipefail

# Patch 144 cleanup: remove backup / old patch artifacts (safe)
rm -f components/ChatHeaderActions.tsx.bak.ui-polish || true

# Optional: remove common backup suffixes (uncomment if desired)
# find . -type f \( -name "*.bak" -o -name "*.bak.*" -o -name "*~" -o -name "*.orig" -o -name "*.rej" \) -print -delete

echo "Patch 144 cleanup done."
