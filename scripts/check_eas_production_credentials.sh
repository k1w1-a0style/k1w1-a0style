#!/usr/bin/env bash
set -euo pipefail

WF=".github/workflows/eas-build.yml"

grep -q 'Production credential preflight' "$WF"
grep -q 'keystore-response.summary.json' "$WF"
grep -q 'writeAndroidSigningFilesFromExport.js < ci-logs/keystore-response.raw.json' "$WF"
grep -q 'rm -f ci-logs/keystore-response.raw.json' "$WF"

echo "EAS production credential diagnostics invariants passed."
