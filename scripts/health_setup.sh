#!/usr/bin/env bash
set -Eeuo pipefail
set +H  # disable "!" history expansion
echo "== K1W1 • Health & Setup (GitHub • Expo/EAS • Supabase) =="

# --- Git/GitHub ---
if git remote get-url origin >/dev/null 2>&1; then
  echo "• Git origin: $(git remote get-url origin)"
else
  echo "• Kein GitHub-Remote gesetzt."
fi

# --- Expo/EAS ---
echo; echo "== Expo/EAS =="
(npx -y expo whoami || true) | sed 's/^/• expo: /'
(eas whoami || true) | sed 's/^/•  eas: /'
node -e $'try{const m=require("./app.config.js");const c=typeof m==="function"?m({}):m;const e=c.expo||{};console.log("• owner=",e.owner||"");console.log("• slug=",e.slug||"");console.log("• projectId=",(e.extra&&e.extra.eas&&e.extra.eas.projectId)||"");}catch(e){console.log("• app.config.js nicht lesbar")}'
eas project:info || true

# --- Supabase (.env + Live-Check) ---
echo; echo "== Supabase (.env) =="
ENV_FILE=".env"
CUR_URL="$(grep -E '^EXPO_PUBLIC_SUPABASE_URL=' "$ENV_FILE" 2>/dev/null | cut -d= -f2- || true)"
CUR_KEY="$(grep -E '^EXPO_PUBLIC_SUPABASE_ANON_KEY=' "$ENV_FILE" 2>/dev/null | cut -d= -f2- || true)"
read -r -p "SUPABASE_URL [${CUR_URL:-eingeben}]: " IN_URL; IN_URL="${IN_URL:-$CUR_URL}"
read -r -s -p "SUPABASE_ANON_KEY [${CUR_KEY:+(gesetzt)}]: " IN_KEY; echo; IN_KEY="${IN_KEY:-$CUR_KEY}"
if [ -n "${IN_URL:-}" ] && [ -n "${IN_KEY:-}" ]; then
  cp -f "$ENV_FILE" "${ENV_FILE}.bak" 2>/dev/null || true
  printf "EXPO_PUBLIC_SUPABASE_URL=%s\nEXPO_PUBLIC_SUPABASE_ANON_KEY=%s\n" "$IN_URL" "$IN_KEY" > "$ENV_FILE"
  grep -qxF ".env" .gitignore 2>/dev/null || echo ".env" >> .gitignore
  echo "• .env aktualisiert – teste (GET /auth/v1/settings)…"
  HTTP="$(curl -s -o /tmp/sb_resp.json -w "%{http_code}" -H "apikey: ${IN_KEY}" -H "Authorization: Bearer ${IN_KEY}" "${IN_URL%/}/auth/v1/settings" || true)"
  if [ "$HTTP" = "200" ]; then echo "✓ Supabase ok (200)"; else echo "✖ Supabase HTTP=$HTTP (URL/Key prüfen)"; fi
else
  echo "(Supabase URL/Key nicht gesetzt – übersprungen)"
fi

# --- SDK 54 Check ---
echo; echo "== Dependencies (SDK 54 Check) =="
node -e 'let p=require("./package.json");console.log(p.dependencies||{})'
npx -y expo install --check || true

# --- Summary ---
echo; echo "== Summary =="
echo "• origin:    $(git remote get-url origin 2>/dev/null || echo "—")"
echo "• expo user: $(npx -y expo whoami 2>/dev/null || echo "—")"
echo "• eas user:  $(eas whoami 2>/dev/null || echo "—")"
echo "• projectId: $(node -e '\''try{const m=require("./app.config.js");const c=typeof m==="function"?m({}):m;process.stdout.write((c.expo&&c.expo.extra&&c.expo.extra.eas&&c.expo.extra.eas.projectId)||"—")}catch(e){process.stdout.write("—")}'\'' )"
echo "• SB URL:    $(grep -E "^EXPO_PUBLIC_SUPABASE_URL=" .env 2>/dev/null | cut -d= -f2- || echo "—")"
echo; echo "Fertig. Starten:  npx expo start --clear --tunnel --port 8082"
