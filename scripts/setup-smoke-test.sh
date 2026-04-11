#!/usr/bin/env bash
set -euo pipefail

echo "Smoke-Test-Dateien sind angelegt."
echo
echo "Nächste Schritte:"
echo "1) GitHub Secrets setzen:"
echo "   gh secret set SUPABASE_SERVICE_ROLE_KEY --repo k1w1-a0style/k1w1-a0style"
echo "   gh secret set SUPABASE_ANON_KEY         --repo k1w1-a0style/k1w1-a0style"
echo
echo "2) Dateien committen:"
echo "   git add scripts/edge-fn-smoke-test.sh scripts/setup-smoke-test.sh .github/workflows/edge-fn-smoke-test.yml"
echo '   git commit -m "ci: add safe edge function smoke test"'
echo "   git push"
echo
echo "3) Workflow manuell starten:"
echo "   gh workflow run edge-fn-smoke-test.yml --repo k1w1-a0style/k1w1-a0style --ref main"
echo
echo "4) Lokal ausführen:"
echo '   export SUPABASE_SERVICE_ROLE_KEY="eyJ..."'
echo '   export SUPABASE_ANON_KEY="eyJ..."'
echo "   bash scripts/edge-fn-smoke-test.sh"
