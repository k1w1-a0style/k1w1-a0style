#!/usr/bin/env bash
set -euo pipefail

# Generates and (optionally) sets Supabase Edge Function secrets for the signing flow.
# - SIGNING_ADMIN_KEY: used by the app via header `x-k1w1-admin-key`
# - SIGNING_MASTER_KEY: used server-side to encrypt keystore payloads
#
# SECURITY NOTE:
# This script PRINTS the keys to stdout so you can paste SIGNING_ADMIN_KEY into the app.
# Run it only on a trusted machine/terminal.

# Generate strong random keys (base64, no newlines)
SIGNING_ADMIN_KEY="$(openssl rand -base64 32 | tr -d '\n')"
SIGNING_MASTER_KEY="$(openssl rand -base64 48 | tr -d '\n')"

cat <<EOF

=== k1w1 signing secrets (COPY/PASTE) ===
SIGNING_ADMIN_KEY=$SIGNING_ADMIN_KEY
SIGNING_MASTER_KEY=$SIGNING_MASTER_KEY
=======================================

EOF

# Save locally (optional but handy)
OUT_FILE=".signing_secrets.local"
umask 077
cat > "$OUT_FILE" <<EOF
SIGNING_ADMIN_KEY=$SIGNING_ADMIN_KEY
SIGNING_MASTER_KEY=$SIGNING_MASTER_KEY
EOF

echo "Saved to $OUT_FILE (mode 600)"

if [[ "${1:-}" == "--set" ]]; then
  echo "Setting Supabase secrets (overwrites existing)…"
  supabase secrets set \
    SIGNING_ADMIN_KEY="$SIGNING_ADMIN_KEY" \
    SIGNING_MASTER_KEY="$SIGNING_MASTER_KEY"
  echo "Done. Re-deploy functions if needed."
else
  echo "Not setting Supabase secrets. Re-run with --set to overwrite secrets in Supabase."
fi
