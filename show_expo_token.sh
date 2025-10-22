#!/usr/bin/env bash
# show_expo_token.sh
# Zeigt mögliche Expo / EAS Tokens aus Umgebungsvariablen und gängigen Konfig-Dateien
# Achtung: liefert vollständige Tokens in Klartext. Handle sensibel.

set -Eeuo pipefail
BLUE="\e[1;34m"; GREEN="\e[1;32m"; YELLOW="\e[1;33m"; RED="\e[1;31m"; NC="\e[0m"

info(){ printf "${BLUE}[INFO]${NC} %s\n" "$1"; }
ok(){ printf "${GREEN}[FOUND]${NC} %s\n" "$1"; }
warn(){ printf "${YELLOW}[WARN]${NC} %s\n" "$1"; }
err(){ printf "${RED}[ERR]${NC} %s\n" "$1"; }

# Where to look
ENV_VARS=( "EXPO_TOKEN" "EXPO_API_TOKEN" "EXPO_ACCESS_TOKEN" "EAS_TOKEN" "EXPO_CLI_TOKEN" "EXPO_ACCESS_TOKEN" "EXPO_AUTH" )
FILES=(
  "$HOME/.expo/state.json"
  "$HOME/.expo/.auth"
  "$HOME/.expo/credentials.json"
  "$HOME/.expo/session.json"
  "$HOME/.config/configstore/expo-cli.json"
  "$HOME/.config/configstore/eas-cli.json"
  "$HOME/.config/configstore/eas.json"
  "$HOME/.config/configstore/expo.json"
  "$HOME/.eas/credentials.json"
  "$HOME/.eas/session.json"
  "$HOME/.npmrc"
  "$HOME/.bashrc"
  "$HOME/.profile"
  "$HOME/.zshrc"
)

# utility: try jq extraction with several candidate keys
try_jq_extract(){
  local file="$1"
  local -a keys=( "accessToken" "access_token" "token" "auth.token" "auth.accessToken" "auth.access_token" "credentials.accessToken" "session" "value" "expoToken" "EXPO_TOKEN" )
  for k in "${keys[@]}"; do
    # Convert dotted path to jq path
    jqpath="$(printf '.%s' "$k" | sed 's/\.\([a-zA-Z0-9_]\+\)/.\1/g')"
    if command -v jq >/dev/null 2>&1; then
      val=$(jq -r "$jqpath // empty" "$file" 2>/dev/null || true)
      if [ -n "$val" ] && [ "$val" != "null" ]; then
        printf "%s" "$val"
        return 0
      fi
    fi
  done
  return 1
}

# utility: grep-based extraction for token-like strings near token/expo words
try_grep_extract(){
  local file="$1"
  # First look for lines containing token/expo and extract the longest token-like string
  # token-like: at least 20 chars of [A-Za-z0-9_-]
  val=$(grep -Ei 'expo|token|access' "$file" 2>/dev/null | sed -n '1,200p' | grep -Eo '([A-Za-z0-9_\-]{20,})' | head -n 1 || true)
  if [ -n "$val" ]; then
    printf "%s" "$val"
    return 0
  fi
  return 1
}

echo
info "Suche nach Expo/EAS Token in Umgebungsvariablen..."
found_any=0
for ev in "${ENV_VARS[@]}"; do
  if [ -n "${!ev-}" ]; then
    ok "Env var $ev:"
    printf "%s\n" "${!ev}"
    found_any=1
  fi
done

echo
info "Suche in Standard-Config/State-Dateien unter $HOME..."
for f in "${FILES[@]}"; do
  if [ -f "$f" ]; then
    info "Prüfe: $f"
    # 1) try jq paths
    if try_jq_extract "$f" >/dev/null 2>&1; then
      val="$(try_jq_extract "$f")"
      if [ -n "$val" ]; then
        ok "Token gefunden in $f"
        printf "%s\n" "$val"
        found_any=1
        continue
      fi
    fi
    # 2) try grep extraction
    if try_grep_extract "$f" >/dev/null 2>&1; then
      val="$(try_grep_extract "$f")"
      if [ -n "$val" ]; then
        ok "Token-ähnlicher String gefunden in $f"
        printf "%s\n" "$val"
        found_any=1
        continue
      fi
    fi
    # 3) fallback: show lines containing 'expo' or 'token' for manual inspection (up to 20 lines)
    warn "Keine sichere Extraktion möglich — zeige Zeilen mit 'expo'/'token' aus $f (bis 20 Zeilen):"
    grep -nEi 'expo|token|access' "$f" 2>/dev/null | sed -n '1,20p' || true
    echo
  fi
done

echo
if [ "$found_any" -eq 0 ]; then
  warn "Keine Expo/EAS Tokens in den üblichen Orten gefunden."
  echo "Tipps:"
  echo " • Falls du den Token via CLI erzeugt hast, versuche: 'eas token -v' oder 'expo whoami' (wenn expo CLI installiert)."
  echo " • Wenn du den Token in einer Datei liegen hast, lege die Datei in ~/.expo/ oder ~/.config/configstore/ und nenne mir den Pfad."
else
  ok "Fertig. Falls das gezeigte Token übereinstimmt, kannst du es so als Umgebungsvariable setzen (Beispiel):"
  echo
  echo "  export EXPO_TOKEN='DEIN_TOKEN_HIER'"
  echo "  # dann z.B. 'eas whoami' oder 'eas build' verwenden"
  echo
  warn "Sicherheit: Wer Zugriff auf dein Terminal hat, kann dieses Token kopieren. Ziehe Rotation/Revocation in Betracht, wenn du unsicher bist."
fi

