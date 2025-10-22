#!/usr/bin/env bash
# show_expo_token_v2.sh
# Erweiterte Suche nach Expo / EAS Token (env, CLI, configstore, ~/.expo/state.json)
# Ausgabe: komplette Token-Strings (sofern gefunden) und Speicher der Roh-Ausgabe in /tmp/expo_token_results.txt
set -Eeuo pipefail

OUT="/tmp/expo_token_results.txt"
: > "$OUT"

echo "[INFO] Beginn Suche nach Expo/EAS Tokens" | tee -a "$OUT"

# 1) Umgebungsvariablen (voll anzeigen)
echo -e "\n[STEP 1] Prüfe Umgebungsvariablen" | tee -a "$OUT"
VARS=(EXPO_TOKEN EXPO_API_TOKEN EXPO_ACCESS_TOKEN EAS_TOKEN EXPO_CLI_TOKEN EXPO_AUTH EXPO_ACCESS_TOKEN)
for v in "${VARS[@]}"; do
  val="${!v-}"
  if [ -n "$val" ]; then
    echo "[FOUND ENV] $v = $val" | tee -a "$OUT"
  else
    echo "[NO   ENV] $v not set" >> "$OUT"
  fi
done

# helper: try jq path extraction from JSON file, returns first non-empty
try_jq_paths(){
  local file="$1"
  # candidate jq paths (common)
  local paths=( \
    '.accessToken' \
    '.access_token' \
    '.token' \
    '.auth.token' \
    '.auth.accessToken' \
    '.auth.access_token' \
    '.credentials?.accessToken' \
    '.session?.accessToken' \
    '.session?.access_token' \
    '.value' \
    '.expoToken' \
    '.EXPO_TOKEN' \
    '.user.accessToken' \
    '.currentUser.token' \
  )
  for p in "${paths[@]}"; do
    if command -v jq >/dev/null 2>&1; then
      v=$(jq -r "$p // empty" "$file" 2>/dev/null || true)
      if [ -n "$v" ] && [ "$v" != "null" ]; then
        printf "%s" "$v"
        return 0
      fi
    fi
  done
  return 1
}

# 2) CLI attempts: eas token -v, expo whoami --json
echo -e "\n[STEP 2] Versuche CLI-Abfragen (eas/expo) — falls installiert" | tee -a "$OUT"
if command -v eas >/dev/null 2>&1; then
  echo "[CLI] 'eas whoami' output:" | tee -a "$OUT"
  eas whoami 2>&1 | tee -a "$OUT"
  # try token command (some older/newer versions have different flags)
  if eas token -v >/dev/null 2>&1; then
    echo "[CLI] 'eas token -v' (versteckt):" | tee -a "$OUT"
    eas token -v 2>&1 | tee -a "$OUT"
  else
    # try 'eas token' fallback (some versions)
    set +e
    eas token 2>&1 | tee -a "$OUT"
    set -e
  fi
else
  echo "[CLI] 'eas' nicht installiert" | tee -a "$OUT"
fi

if command -v expo >/dev/null 2>&1; then
  echo "[CLI] 'expo whoami --json' output:" | tee -a "$OUT"
  expo whoami --json 2>&1 | tee -a "$OUT"
else
  echo "[CLI] 'expo' nicht installiert" | tee -a "$OUT"
fi

# 3) Check common configstore & expo files (only in $HOME)
echo -e "\n[STEP 3] Prüfe bekannte Config-/State-Dateien in \$HOME" | tee -a "$OUT"
FILES=( \
  "$HOME/.expo/state.json" \
  "$HOME/.expo/.auth" \
  "$HOME/.expo/session.json" \
  "$HOME/.expo/credentials.json" \
  "$HOME/.config/configstore/expo-cli.json" \
  "$HOME/.config/configstore/eas-cli.json" \
  "$HOME/.config/configstore/eas.json" \
  "$HOME/.config/configstore/expo.json" \
  "$HOME/.eas/session.json" \
  "$HOME/.eas/credentials.json" \
  "$HOME/.npmrc" \
  "$HOME/.bashrc" \
  "$HOME/.profile" \
  "$HOME/.zshrc" \
)

for f in "${FILES[@]}"; do
  if [ -f "$f" ]; then
    echo "[FILE] Prüfe $f" | tee -a "$OUT"
    # If JSON and jq available, try jq path extraction
    if file "$f" | grep -qi "json" >/dev/null 2>&1 && command -v jq >/dev/null 2>&1; then
      if try_jq_paths "$f" >/dev/null 2>&1; then
        v="$(try_jq_paths "$f")"
        echo "[FOUND IN JSON] $f => $v" | tee -a "$OUT"
        continue
      fi
    fi
    # grep for token-like strings on lines containing expo/token/access
    grep -nEi 'expo|token|access' "$f" 2>/dev/null | sed -n '1,200p' | tee -a "$OUT"
    # also try to pull token-like strings regardless of line context
    grep -Eo '([A-Za-z0-9_\-]{24,})' "$f" 2>/dev/null | grep -E '.{20,}' | sort -u | sed -n '1,20p' | while read -r cand; do
      echo "[POSSIBLE TOKEN FOUND] $f => $cand" | tee -a "$OUT"
    done
  fi
done

# 4) Extra: check npm global config for tokens (npmrc)
echo -e "\n[STEP 4] Prüfe npmrc global/user (falls vorhanden)" | tee -a "$OUT"
if [ -f "$HOME/.npmrc" ]; then
  echo "[FILE] $HOME/.npmrc contents (lines with token/auth):" | tee -a "$OUT"
  grep -Ei 'auth|token|expo|eas' "$HOME/.npmrc" 2>/dev/null | sed -n '1,200p' | tee -a "$OUT"
fi

# 5) Report: show if something found in OUT
echo -e "\n[REPORT] Roh-Ausgabe gespeichert in: $OUT"
echo "[REPORT] Quick summary (grep FOUND/FOUND IN JSON/POSSIBLE TOKEN):" | tee -a "$OUT"
grep -Ei 'FOUND|POSSIBLE TOKEN|CLI' "$OUT" | sed -n '1,200p' | tee -a "$OUT" || true

echo -e "\n[INFO] Wenn nichts gefunden wurde:"
echo " • Falls du Expo/EAS CLI noch nie verwendet hast, erzeuge einen Token mit 'eas login' und 'eas token' oder nutze 'expo login'."
echo " • Wenn du willst, kann ich dir das Kommando liefern, wie du einen neuen Token sicher erzeugst und als Umgebungsvariable setzt."

# Helpful install hints (if cli missing)
echo -e "\n[HINT] Falls 'eas' fehlt, kannst du installieren (Empfehlung):"
echo "  npm install -g eas-cli"
echo "  # oder für expo CLI:"
echo "  npm install -g expo-cli"
echo

