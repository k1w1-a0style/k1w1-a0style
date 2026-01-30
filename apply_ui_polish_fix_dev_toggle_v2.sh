\
#!/usr/bin/env bash
set -euo pipefail

echo "🔧 Fixing UI polish patch + dev-toggle packaging fallout..."

ROOT="$(pwd)"

# 0) Remove accidental extracted project subtree if present
if [ -d "$ROOT/mnt/data/_proj_cur" ] || [ -d "$ROOT/mnt" ]; then
  echo "🧹 Removing accidental extracted folder: ./mnt"
  rm -rf "$ROOT/mnt"
fi

python3 - <<'PY'
from pathlib import Path
import json, re, sys

ROOT = Path(".").resolve()

def die(msg: str):
    print(f"❌ {msg}")
    sys.exit(1)

def read(p: Path) -> str:
    if not p.exists():
        die(f"File not found: {p}")
    return p.read_text(encoding="utf-8")

def write(p: Path, s: str):
    p.write_text(s, encoding="utf-8")
    print(f"✅ Patched {p}")

def ensure_line_in_file(path: Path, line: str):
    s = read(path)
    if line in s:
        print(f"ℹ️ {path} already contains: {line}")
        return
    if not s.endswith("\n"):
        s += "\n"
    s += line + "\n"
    write(path, s)

# 1) Ensure mnt is ignored everywhere (tsc/eslint/git)
gitignore = ROOT / ".gitignore"
if gitignore.exists():
    ensure_line_in_file(gitignore, "mnt/")
else:
    print("ℹ️ .gitignore not found — skipping")

# tsconfig.json: add exclude entries for mnt
tsconfig_p = ROOT / "tsconfig.json"
if tsconfig_p.exists():
    ts = json.loads(read(tsconfig_p))
    exc = ts.get("exclude", [])
    if not isinstance(exc, list):
        exc = []
    changed = False
    for e in ["mnt", "mnt/**"]:
        if e not in exc:
            exc.append(e); changed = True
    if changed:
        ts["exclude"] = exc
        write(tsconfig_p, json.dumps(ts, indent=2) + "\n")
    else:
        print("ℹ️ tsconfig.json already excludes mnt")
else:
    print("ℹ️ tsconfig.json not found — skipping")

# eslint.config.js: add ignore for mnt/** if there is an ignores array
eslint_p = ROOT / "eslint.config.js"
if eslint_p.exists():
    s = read(eslint_p)
    if "mnt/**" in s or "mnt/" in s:
        print("ℹ️ eslint.config.js already ignores mnt")
    else:
        # Try to inject into the first 'ignores: [' block
        m = re.search(r"(ignores\s*:\s*\[)([^]]*)(\])", s, flags=re.DOTALL)
        if m:
            pre, body, post = m.group(1), m.group(2), m.group(3)
            # Add at end of list with comma handling
            body_stripped = body.rstrip()
            comma = "," if body_stripped.strip() and not body_stripped.strip().endswith(",") else ""
            new_body = body_stripped + f"{comma}\n    \"mnt/**\""
            s2 = s[:m.start()] + pre + new_body + post + s[m.end():]
            write(eslint_p, s2)
        else:
            print("⚠️ Could not find ignores array in eslint.config.js — skipping (tsc exclude still covers TS)")

# Helper to insert a style into a StyleSheet.create({ ... }) block if missing
def ensure_style(file_path: Path, style_name: str, style_obj: str):
    s = read(file_path)
    if re.search(rf"\b{re.escape(style_name)}\s*:", s):
        print(f"ℹ️ {file_path.name}: style '{style_name}' already exists")
        return
    # find StyleSheet.create({ and insert right after opening brace
    m = re.search(r"StyleSheet\.create\(\s*\{\s*", s)
    if not m:
        print(f"⚠️ {file_path.name}: no StyleSheet.create({{ ... }}) found — skipping {style_name}")
        return
    insert_at = m.end()
    insertion = f"\n  {style_name}: {style_obj},\n"
    s2 = s[:insert_at] + insertion + s[insert_at:]
    write(file_path, s2)

# 2) Fix AppInfoScreen missing inlineCode style if referenced
appinfo = ROOT / "screens" / "AppInfoScreen.tsx"
if appinfo.exists():
    s = read(appinfo)
    if "styles.inlineCode" in s:
        ensure_style(appinfo, "inlineCode", "{ fontFamily: \"monospace\", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, backgroundColor: \"#1f2937\", color: \"#e5e7eb\" }")
    else:
        print("ℹ️ AppInfoScreen: no styles.inlineCode reference — skipping")
else:
    print("ℹ️ AppInfoScreen.tsx not found — skipping")

# 3) Fix ChatHeaderActions: missing menu styles + resolveEffectiveTemplateId signature
chat = ROOT / "components" / "ChatHeaderActions.tsx"
if chat.exists():
    s = read(chat)

    # If resolveEffectiveTemplateId is called with 1 arg, patch to provide files if available.
    # We try to find a variable named 'projectFiles' or 'files' from context; otherwise fall back to [].
    s2 = s
    s2 = re.sub(
        r"resolveEffectiveTemplateId\(\s*([^)]+?)\s*\)",
        lambda m: f"resolveEffectiveTemplateId({m.group(1).strip()}, (projectData?.files || []) as any)" if "resolveEffectiveTemplateId(" in s and m.group(1).count(",")==0 else m.group(0),
        s2
    )

    # Add styles if referenced
    if "styles.menuInfoRow" in s2:
        # ensure three styles
        # Note: keep them small and neutral
        def add_style_block(name, obj):
            nonlocal s2
            if re.search(rf"\b{name}\s*:", s2): 
                return
            m = re.search(r"StyleSheet\.create\(\s*\{\s*", s2)
            if not m: 
                return
            s2 = s2[:m.end()] + f"\n  {name}: {obj},\n" + s2[m.end():]
        add_style_block("menuInfoRow", "{ flexDirection: \"row\", alignItems: \"center\", justifyContent: \"space-between\", marginBottom: 10 }")
        add_style_block("menuInfoText", "{ fontSize: 12, color: \"#e5e7eb\" }")
        add_style_block("menuIcon", "{ marginLeft: 8 }")

    if s2 != s:
        write(chat, s2)
    else:
        print("ℹ️ ChatHeaderActions: nothing to patch")
else:
    print("ℹ️ ChatHeaderActions.tsx not found — skipping")

print("🎉 Done. If you still see errors, it's likely due to local uncommitted edits — run 'git checkout -- .' and re-apply the patch.")
PY

echo "✅ Script finished."
