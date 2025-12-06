#!/usr/bin/env bash

# Name für den Dump – hier mit Datum & Uhrzeit
OUTFILE="k1w1_all_sources_$(date +%Y%m%d_%H%M%S).txt"

echo "Erzeuge Dump in: $OUTFILE"
echo "" > "$OUTFILE"

# Alle relevanten Code-Dateien finden (ohne node_modules, .expo, dist)
find . \
  -not -path "./node_modules/*" \
  -not -path "./.expo/*" \
  -not -path "./dist/*" \
  -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" \) \
  | sort |
while IFS= read -r file; do
  # Trennzeile wie in deinen bisherigen Dumps
  echo "===== ${file#./} =====" >> "$OUTFILE"
  cat "$file" >> "$OUTFILE"
  echo "" >> "$OUTFILE"
  echo "" >> "$OUTFILE"
done

echo "Fertig. Datei: $OUTFILE"
