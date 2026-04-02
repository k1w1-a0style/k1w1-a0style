#!/usr/bin/env bash
set -euo pipefail

EDGE_BASE_URL="${EDGE_BASE_URL:-}"
EDGE_OPERATOR_JWT="${EDGE_OPERATOR_JWT:-}"
CURL_BIN="${CURL_BIN:-curl}"

if [ -z "$EDGE_BASE_URL" ]; then
  echo "Missing EDGE_BASE_URL (e.g. https://<project>.supabase.co/functions/v1)" >&2
  exit 1
fi

if [ -z "$EDGE_OPERATOR_JWT" ]; then
  echo "Missing EDGE_OPERATOR_JWT (build_admin/service_role JWT for live operator routes)" >&2
  exit 1
fi

TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

request() {
  local method="$1"
  local url="$2"
  local body_file="$3"
  local out_prefix="$4"
  local status
  local curl_args=(
    -sS
    -X "$method"
    -D "$TMP_DIR/${out_prefix}.headers"
    -o "$TMP_DIR/${out_prefix}.body"
    -w "%{http_code}"
    "$url"
  )

  if [ -n "$body_file" ]; then
    curl_args+=(
      -H 'Content-Type: application/json'
      --data-binary "@$body_file"
    )
  fi

  if [ "$out_prefix" = "k1w1-handler" ]; then
    curl_args+=( -H "Authorization: Bearer $EDGE_OPERATOR_JWT" )
  fi

  status="$($CURL_BIN "${curl_args[@]}")"
  printf '%s' "$status"
}

assert_body_contains() {
  local file="$1"
  local needle="$2"
  if ! grep -Fq -- "$needle" "$file"; then
    echo "Expected response body to contain: $needle" >&2
    echo "--- body ---" >&2
    cat "$file" >&2
    echo >&2
    exit 1
  fi
}

printf '{"broken":' > "$TMP_DIR/k1w1-invalid.json"

k1w1_status="$(request POST "$EDGE_BASE_URL/k1w1-handler" "$TMP_DIR/k1w1-invalid.json" "k1w1-handler")"
if [ "$k1w1_status" != "400" ]; then
  echo "k1w1-handler contract failed: expected HTTP 400 for invalid JSON, got $k1w1_status" >&2
  echo "--- headers ---" >&2
  cat "$TMP_DIR/k1w1-handler.headers" >&2 || true
  echo "--- body ---" >&2
  cat "$TMP_DIR/k1w1-handler.body" >&2 || true
  exit 1
fi
assert_body_contains "$TMP_DIR/k1w1-handler.body" '"code":"invalid_request_payload"'

echo "k1w1-handler live contract: OK (invalid JSON -> 400 invalid_request_payload)"

preview_status="$(request GET "$EDGE_BASE_URL/preview_page?secret=live-contract-bogus-secret" "" "preview_page")"
if [ "$preview_status" != "404" ]; then
  echo "preview_page contract failed: expected HTTP 404 for bogus secret, got $preview_status" >&2
  echo "--- headers ---" >&2
  cat "$TMP_DIR/preview_page.headers" >&2 || true
  echo "--- body ---" >&2
  cat "$TMP_DIR/preview_page.body" >&2 || true
  exit 1
fi
assert_body_contains "$TMP_DIR/preview_page.body" 'Preview not found'

echo "preview_page live contract: OK (bogus secret -> 404 not found HTML)"

echo "Live edge contracts: OK"
