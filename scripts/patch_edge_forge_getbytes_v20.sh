#!/usr/bin/env bash
set -euo pipefail

FILE="supabase/functions/android-keystore-generate/index.ts"
if [ ! -f "$FILE" ]; then
  echo "❌ File not found: $FILE" >&2
  exit 1
fi

python3 - <<'PY'
from pathlib import Path
import re

p = Path('supabase/functions/android-keystore-generate/index.ts')
s = p.read_text(encoding='utf-8')

# Replace ONLY the forge.random.getBytes implementation inside getForge()
pattern = re.compile(
    r"forge\.random\.getBytes\s*=\s*\(count:\s*number,\s*cb:\s*any\)\s*=>\s*\{.*?\};",
    re.DOTALL,
)

replacement = (
"forge.random.getBytes = (count: number, cb?: any) => {\n"
"      const out = rngBytes(count);\n"
"      // node-forge supports BOTH forms:\n"
"      //   getBytes(n) -> string\n"
"      //   getBytes(n, cb) -> void (cb(err, string))\n"
"      if (typeof cb === \"function\") {\n"
"        try {\n"
"          cb(null, out);\n"
"        } catch (e) {\n"
"          cb(e, \"\");\n"
"        }\n"
"        return;\n"
"      }\n"
"      return out;\n"
"    };"
)

m = pattern.search(s)
if not m:
    raise SystemExit("❌ Could not find forge.random.getBytes(...) block to patch. (Maybe code changed?)")

s2 = pattern.sub(replacement, s, count=1)

# Safety check: ensure getBytesSync is still present
if 'forge.random.getBytesSync' not in s2:
    raise SystemExit('❌ Patch safety check failed: getBytesSync not found after patch')

p.write_text(s2, encoding='utf-8')
print('✅ Patched forge.random.getBytes to support callback + return form')
PY

echo "✅ Done. Now run: supabase functions deploy android-keystore-generate"
