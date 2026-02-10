#!/usr/bin/env bash
set -euo pipefail

echo "[patch38] 1) Remove stray root patch note (if present)"
rm -f docs_PATCH_28_NOTES.md || true

echo "[patch38] 2) Remove unnecessary docs artifacts zip (if present)"
rm -f docs/patches/artifacts/Mobile-APK-Builder-PATCH39.zip || true

echo "[patch38] done."
