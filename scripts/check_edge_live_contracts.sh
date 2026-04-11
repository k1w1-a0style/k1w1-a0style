#!/usr/bin/env bash
set -euo pipefail

if [[ -f ".env.edge.live" ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env.edge.live
  set +a
fi

CURL_BIN="${CURL_BIN:-curl}"
EDGE_BASE_URL="${EDGE_BASE_URL:-}"

looks_like_jwt() {
  local token="${1:-}"
  [[ -n "$token" && "$token" == *.*.* ]]
}

pick_operator_jwt() {
  if looks_like_jwt "${EDGE_OPERATOR_JWT:-}"; then
    printf '%s' "${EDGE_OPERATOR_JWT}"
    return 0
  fi
  if looks_like_jwt "${SUPABASE_SERVICE_ROLE_KEY:-}"; then
    printf '%s' "${SUPABASE_SERVICE_ROLE_KEY}"
    return 0
  fi
  return 1
}

if [[ -z "$EDGE_BASE_URL" ]]; then
  echo "Missing EDGE_BASE_URL (expected: https://<project>.supabase.co/functions/v1)" >&2
  exit 1
fi

if ! [[ "${EDGE_BASE_URL}" =~ ^https://[^[:space:]]+/functions/v1/?$ ]]; then
  echo "Invalid EDGE_BASE_URL: ${EDGE_BASE_URL}" >&2
  exit 1
fi

ACTIVE_OPERATOR_JWT="$(pick_operator_jwt || true)"
if ! looks_like_jwt "$ACTIVE_OPERATOR_JWT"; then
  echo "Missing usable operator JWT. Set EDGE_OPERATOR_JWT or SUPABASE_SERVICE_ROLE_KEY." >&2
  exit 1
fi

TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

request() {
  local method="$1"
  local url="$2"
  local body_file="$3"
  local out_prefix="$4"
  local auth="${5:-}"

  local curl_args=(
    -sS
    -X "$method"
    -D "$TMP_DIR/${out_prefix}.headers"
    -o "$TMP_DIR/${out_prefix}.body"
    -w "%{http_code}"
    "$url"
  )

  if [[ -n "$body_file" ]]; then
    curl_args+=(-H 'Content-Type: application/json' --data-binary "@$body_file")
  fi

  if [[ -n "$auth" ]]; then
    curl_args+=(-H "Authorization: Bearer $auth")
  fi

  "$CURL_BIN" "${curl_args[@]}"
}

request_with_operator_retry() {
  local method="$1"
  local url="$2"
  local body_file="$3"
  local out_prefix="$4"

  local status
  status="$(request "$method" "$url" "$body_file" "$out_prefix" "$ACTIVE_OPERATOR_JWT")"

  if [[ "$status" == "401" ]] && grep -Eiq 'invalid token|protected header|jwt' "$TMP_DIR/${out_prefix}.body"; then
    if [[ -n "${SUPABASE_SERVICE_ROLE_KEY:-}" ]] && [[ "$ACTIVE_OPERATOR_JWT" != "${SUPABASE_SERVICE_ROLE_KEY}" ]] && looks_like_jwt "${SUPABASE_SERVICE_ROLE_KEY}"; then
      echo "Retrying $out_prefix with SUPABASE_SERVICE_ROLE_KEY fallback..." >&2
      ACTIVE_OPERATOR_JWT="${SUPABASE_SERVICE_ROLE_KEY}"
      status="$(request "$method" "$url" "$body_file" "$out_prefix" "$ACTIVE_OPERATOR_JWT")"
    fi
  fi

  printf '%s' "$status"
}

assert_body_contains() {
  local file="$1"
  local needle="$2"
  if ! grep -Fq -- "$needle" "$file"; then
    echo "Expected response body to contain: $needle" >&2
    echo "--- body ---" >&2
    cat "$file" >&2 || true
    echo >&2
    exit 1
  fi
}

assert_body_not_contains() {
  local file="$1"
  local needle="$2"
  if grep -Fq -- "$needle" "$file"; then
    echo "Response body must not contain forbidden marker: $needle" >&2
    echo "--- body ---" >&2
    cat "$file" >&2 || true
    echo >&2
    exit 1
  fi
}

printf '{"broken":' > "$TMP_DIR/k1w1-invalid.json"

k1w1_status="$(request_with_operator_retry POST "$EDGE_BASE_URL/k1w1-handler" "$TMP_DIR/k1w1-invalid.json" "k1w1-handler")"
if [[ "$k1w1_status" != "400" ]]; then
  echo "k1w1-handler contract failed: expected HTTP 400 for invalid JSON, got $k1w1_status" >&2
  echo "--- headers ---" >&2
  cat "$TMP_DIR/k1w1-handler.headers" >&2 || true
  echo "--- body ---" >&2
  cat "$TMP_DIR/k1w1-handler.body" >&2 || true
  exit 1
fi
assert_body_contains "$TMP_DIR/k1w1-handler.body" '"code":"invalid_request_payload"'
echo "k1w1-handler live contract: OK"

preview_status="$(request GET "$EDGE_BASE_URL/preview_page" "" "preview_page" "")"
if [[ "$preview_status" != "400" ]]; then
  echo "preview_page contract failed: expected HTTP 400 without preview secret header, got $preview_status" >&2
  echo "--- headers ---" >&2
  cat "$TMP_DIR/preview_page.headers" >&2 || true
  echo "--- body ---" >&2
  cat "$TMP_DIR/preview_page.body" >&2 || true
  exit 1
fi
assert_body_contains "$TMP_DIR/preview_page.body" 'Missing preview secret header.'
assert_body_not_contains "$TMP_DIR/preview_page.body" '?secret='
echo "preview_page live contract: OK"

cat > "$TMP_DIR/save-preview-payload.json" <<'JSON'
{
  "name": "live-contract-check",
  "files": {
    "App.tsx": {
      "type": "CODE",
      "contents": "export default function App(){ return null; }"
    }
  },
  "dependencies": {}
}
JSON

save_preview_status="$(request_with_operator_retry POST "$EDGE_BASE_URL/save_preview" "$TMP_DIR/save-preview-payload.json" "save_preview")"
if [[ "$save_preview_status" != "200" ]]; then
  echo "save_preview contract failed: expected HTTP 200 for valid JWT + minimal payload, got $save_preview_status" >&2
  echo "--- headers ---" >&2
  cat "$TMP_DIR/save_preview.headers" >&2 || true
  echo "--- body ---" >&2
  cat "$TMP_DIR/save_preview.body" >&2 || true
  exit 1
fi
assert_body_contains "$TMP_DIR/save_preview.body" '"ok":true'
assert_body_contains "$TMP_DIR/save_preview.body" '"previewUrl":"'
assert_body_contains "$TMP_DIR/save_preview.body" 'transport=fragment'
assert_body_contains "$TMP_DIR/save_preview.body" '#secret='
assert_body_not_contains "$TMP_DIR/save_preview.body" '?secret='
echo "save_preview live contract: OK"

echo "Live edge contracts: OK"
