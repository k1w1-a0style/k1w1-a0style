#!/data/data/com.termux/files/usr/bin/bash
set -euo pipefail

FILE="screens/DiagnosticScreen.tsx"
[ -f "$FILE" ] || { echo "❌ Datei nicht gefunden: $FILE"; exit 1; }

cp -f "$FILE" "$FILE.bak.$(date +%Y%m%d-%H%M%S)"

python3 - <<'PY'
import re, pathlib
p = pathlib.Path("screens/DiagnosticScreen.tsx")
s = p.read_text(encoding="utf-8")

# 1) Sicherstellen, dass useState im React-Import drin ist (nur wenn es so einen Import gibt)
def ensure_usestate_in_import(src: str) -> str:
    # Fälle:
    # import React, { ... } from "react";
    # import { ... } from "react";
    # import React from "react";
    # wir patchen nur, wenn "useState" NICHT drin ist
    m = re.search(r'(^import\s+[^;]*from\s+[\'"]react[\'"];\s*$)', src, flags=re.M)
    if not m:
        return src

    # import React, { ... } from "react";
    src = re.sub(
        r'^import\s+React,\s*\{\s*([^}]*?)\s*\}\s*from\s*[\'"]react[\'"];\s*$',
        lambda mm: mm.group(0) if re.search(r'\buseState\b', mm.group(1)) else f'import React, {{ {mm.group(1).strip()}, useState }} from "react";',
        src,
        flags=re.M
    )

    # import { ... } from "react";
    src = re.sub(
        r'^import\s*\{\s*([^}]*?)\s*\}\s*from\s*[\'"]react[\'"];\s*$',
        lambda mm: mm.group(0) if re.search(r'\buseState\b', mm.group(1)) else f'import {{ {mm.group(1).strip()}, useState }} from "react";',
        src,
        flags=re.M
    )

    # import React from "react";  -> erweitern auf React, { useState }
    src = re.sub(
        r'^import\s+React\s+from\s+[\'"]react[\'"];\s*$',
        lambda mm: 'import React, { useState } from "react";',
        src,
        flags=re.M
    )
    return src

s2 = ensure_usestate_in_import(s)

# 2) ciFixing/ciFixLog States einfügen, wenn setCiFixing/setCiFixLog benutzt werden, aber States fehlen
needs_fixing = ("setCiFixing(" in s2) and ("const [ciFixing," not in s2)
needs_log    = ("setCiFixLog(" in s2) and ("const [ciFixLog," not in s2)

if needs_fixing or needs_log:
    insert_lines = []
    if needs_fixing:
        insert_lines.append("  const [ciFixing, setCiFixing] = useState(false);")
    if needs_log:
        insert_lines.append("  const [ciFixLog, setCiFixLog] = useState<string | null>(null);")
    block = "\n" + "\n".join(insert_lines) + "\n"

    # Einfügepunkt: direkt nach dem ersten useProject()-Destructuring (bei dir existiert das safe)
    # Beispiel: const { projectData, ... } = useProject();
    pat = r'(const\s+\{[^}]*\}\s*=\s*useProject\(\)\s*;?)'
    m = re.search(pat, s2)
    if m:
        s2 = s2[:m.end()] + block + s2[m.end():]
    else:
        # Fallback: nach dem ersten "function DiagnosticScreen" oder "const DiagnosticScreen"
        m2 = re.search(r'(function\s+DiagnosticScreen[^{]*\{)|(const\s+DiagnosticScreen[^{]*=>\s*\{)', s2)
        if m2:
            s2 = s2[:m2.end()] + "\n" + "\n".join(insert_lines) + "\n" + s2[m2.end():]
        else:
            raise SystemExit("❌ Konnte keinen Einfügepunkt für ciFix States finden.")

p.write_text(s2, encoding="utf-8")
print("✅ Patched DiagnosticScreen.tsx (ciFixing/ciFixLog + useState import)")
PY

echo "▶ typecheck + lint…"
npm run typecheck
npm run lint:ci

# 3) Falls ZIPs aus Versehen getrackt wurden: raus damit (Repo sauber halten)
TRACKED_ZIPS="$(git ls-files '*.zip' || true)"
if [ -n "$TRACKED_ZIPS" ]; then
  echo "🧹 Entferne getrackte ZIPs aus Git:"
  echo "$TRACKED_ZIPS"
  echo "$TRACKED_ZIPS" | xargs -r git rm -f
fi

git add screens/DiagnosticScreen.tsx

# Wenn wir ZIPs entfernt haben, ist das auch staged – also alles adden
git add -A

git commit -m "fix(diagnostics): add missing ciFixing/ciFixLog state + ensure useState import" || true
git push origin work

echo "✅ Fertig."
git status
