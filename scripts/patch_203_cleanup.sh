#!/usr/bin/env bash
# Patch 203 cleanup (safe mode)
#
# IMPORTANT:
#   - contexts/types.ts is still referenced by contexts/ProjectContext.tsx
#   - lib/logger.ts is still referenced by screens/PreviewFullscreenScreen/hooks/usePreviewFullscreen.ts
#
# So we only remove the one confirmed legacy helper that is unused now.
set -euo pipefail

rm -f screens/SettingsScreen/utils/keyMasking.ts

echo "Patch 203 cleanup done (safe mode)."
