#!/usr/bin/env bash
set -euo pipefail

# k1w1 signing secrets helper
#
# Generates and/or sets two secrets:
#   - SIGNING_ADMIN_KEY  (used by app header: x-k1w1-admin-key)
#   - SIGNING_MASTER_KEY (used to derive encryption key for keystore blob)
#
# Why this exists:
# If you generate NEW keys and set them in Supabase, but the app still has the OLD
# admin key saved, every keystore call will fail with HTTP 401 "invalid admin key".
# Therefore this script is IDEMPOTENT by default: it reuses .signing_secrets.local
# unless you explicitly rotate.

LOCAL_FILE=".signing_secrets.local"

usage() {
  cat <<'USAGE'
Usage:
  bash scripts/signing_secrets.sh [--rotate] [--set-supabase] [--set-gh]

Options:
  --rotate       Generate NEW keys even if .signing_secrets.local exists.
  --set-supabase Overwrite Supabase Edge Function secrets with the keys.
  --set-gh       Overwrite GitHub Actions secrets with the keys (requires gh auth).
  -h, --help     Show help.

Notes:
- The keys are printed in full so you can paste SIGNING_ADMIN_KEY into the app.
- .signing_secrets.local is created with chmod 600 and SHOULD NOT be committed.
- If you run --set-supabase, redeploy the edge functions afterwards.
USAGE
}

ROTATE=0
SET_SUPABASE=0
SET_GH=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --rotate) ROTATE=1; shift ;;
    --set-supabase|--set) SET_SUPABASE=1; shift ;;
    --set-gh) SET_GH=1; shift ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown arg: $1" >&2; usage; exit 1 ;;
  esac
done

load_existing() {
  if [[ -f "$LOCAL_FILE" ]]; then
    # shellcheck disable=SC1090
    source "$LOCAL_FILE"
    if [[ -n "${SIGNING_ADMIN_KEY:-}" && -n "${SIGNING_MASTER_KEY:-}" ]]; then
      return 0
    fi
  fi
  return 1
}

gen_keys() {
  SIGNING_ADMIN_KEY="$(openssl rand -base64 32 | tr -d '\n')"
  SIGNING_MASTER_KEY="$(openssl rand -base64 48 | tr -d '\n')"
}

save_local() {
  umask 177
  cat > "$LOCAL_FILE" <<EOF
# Local signing secrets (DO NOT COMMIT)
SIGNING_ADMIN_KEY=$SIGNING_ADMIN_KEY
SIGNING_MASTER_KEY=$SIGNING_MASTER_KEY
EOF
  chmod 600 "$LOCAL_FILE" 2>/dev/null || true
}

print_keys() {
  echo ""
  echo "=== k1w1 signing secrets (COPY/PASTE) ==="
  echo "SIGNING_ADMIN_KEY=$SIGNING_ADMIN_KEY"
  echo "SIGNING_MASTER_KEY=$SIGNING_MASTER_KEY"
  echo "======================================="
  echo ""
  echo "Saved to $LOCAL_FILE (mode 600)"
}

set_supabase() {
  if ! command -v supabase >/dev/null 2>&1; then
    echo "supabase CLI not found. Install it first." >&2
    exit 1
  fi
  echo "Setting Supabase secrets (overwrites existing)…"
  supabase secrets set \
    SIGNING_ADMIN_KEY="$SIGNING_ADMIN_KEY" \
    SIGNING_MASTER_KEY="$SIGNING_MASTER_KEY"
  echo "Done. Re-deploy functions so the new secrets take effect:"
  echo "  supabase functions deploy android-keystore-generate"
  echo "  supabase functions deploy android-keystore-status"
  echo "  supabase functions deploy android-keystore-export"
}

set_github() {
  if ! command -v gh >/dev/null 2>&1; then
    echo "gh CLI not found. Install it first." >&2
    exit 1
  fi
  echo "Setting GitHub Actions secrets (overwrites existing)…"
  gh secret set SIGNING_ADMIN_KEY --body "$SIGNING_ADMIN_KEY"
  gh secret set SIGNING_MASTER_KEY --body "$SIGNING_MASTER_KEY"
  echo "Done."
}

main() {
  if [[ $ROTATE -eq 0 ]]; then
    if load_existing; then
      :
    else
      gen_keys
      save_local
    fi
  else
    gen_keys
    save_local
  fi

  export SIGNING_ADMIN_KEY SIGNING_MASTER_KEY

  print_keys

  if [[ $SET_SUPABASE -eq 1 ]]; then
    set_supabase
  else
    echo "Not setting Supabase secrets. Re-run with --set-supabase to overwrite."
  fi

  if [[ $SET_GH -eq 1 ]]; then
    set_github
  else
    echo "Not setting GitHub secrets. Re-run with --set-gh to overwrite."
  fi
}

main
