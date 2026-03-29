#!/usr/bin/env bash
set -euo pipefail

fail() {
  echo "[FAIL] $1" >&2
  exit 1
}

check_contains() {
  local file="$1"
  local needle="$2"
  grep -Fq "$needle" "$file" || fail "Missing expected content in $file: $needle"
}

check_contains "supabase/functions/k1w1-handler/helpers.ts" 'export { corsHeadersForRequest, handleCors } from "../_shared/cors.ts";'
check_contains "supabase/functions/k1w1-handler/helpers.ts" 'export { requireScopedEdgeAuth, rateLimit } from "../_shared/auth.ts";'
check_contains "supabase/functions/k1w1-handler/helpers.ts" 'export { parseJsonBody } from "../_shared/validation.ts";'

check_contains "supabase/functions/android-keystore-export/helpers.ts" 'export { createClient } from "https://esm.sh/@supabase/supabase-js@2";'
check_contains "supabase/functions/android-keystore-export/helpers.ts" 'export { handleCors, errorResponse, jsonResponse } from "../_shared/cors.ts";'

check_contains "supabase/functions/android-keystore-generate/helpers.ts" 'export { createClient } from "https://esm.sh/@supabase/supabase-js@2";'
check_contains "supabase/functions/android-keystore-generate/helpers.ts" 'export { handleCors, errorResponse, jsonResponse } from "../_shared/cors.ts";'
check_contains "supabase/functions/android-keystore-generate/helpers.ts" 'requireScopedEdgeAuth'
check_contains "supabase/functions/android-keystore-generate/helpers.ts" 'requirePrivilegedOperatorJwtRole'
check_contains "supabase/functions/android-keystore-status/helpers.ts" 'requireScopedEdgeAuth'
check_contains "supabase/functions/android-keystore-status/helpers.ts" 'requirePrivilegedOperatorJwtRole'

check_contains "supabase/functions/create_codesandbox/helpers.ts" 'export { parseJsonBody } from "../_shared/validation.ts";'
check_contains "supabase/functions/create_codesandbox/helpers.ts" 'export { requireScopedEdgeAuth, rateLimit } from "../_shared/auth.ts";'

echo "Edge helper visibility check passed."
