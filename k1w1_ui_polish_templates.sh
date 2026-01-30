#!/usr/bin/env bash
set -euo pipefail

echo "🔧 UI polish: template badge + advanced template picker + text cleanup"

python3 - <<'PY'
from pathlib import Path
import re
import sys

ROOT = Path(".").resolve()

def die(msg):
    print(f"❌ {msg}")
    sys.exit(1)

def read(p: Path) -> str:
    if not p.exists():
        die(f"File not found: {p}")
    return p.read_text(encoding="utf-8")

def write(p: Path, s: str):
    p.write_text(s, encoding="utf-8")

def backup(p: Path):
    b = p.with_suffix(p.suffix + ".bak.ui-polish")
    if not b.exists():
        b.write_text(read(p), encoding="utf-8")

# -----------------------------
# 1) components/ChatHeaderActions.tsx
# -----------------------------
chat_path = ROOT / "components" / "ChatHeaderActions.tsx"
chat = read(chat_path)
backup(chat_path)

# Ensure import exists
if 'resolveEffectiveTemplateId' not in chat:
    # place after useProject import
    needle = 'import { useProject } from "../contexts/ProjectContext";'
    if needle in chat:
        chat = chat.replace(needle, needle + '\nimport { resolveEffectiveTemplateId } from "../lib/templateChecklist";')
    else:
        # fallback: insert near top after last import
        m = re.search(r"(import[\s\S]+?;\n)(\s*\n)", chat)
        if m:
            ins = m.group(1) + 'import { resolveEffectiveTemplateId } from "../lib/templateChecklist";\n' + m.group(2)
            chat = chat[:m.start()] + ins + chat[m.end():]

# Inject template badge computation after useProject()
m_useproj = re.search(r"const\s*\{\s*projectData[\s\S]*?\}\s*=\s*useProject\(\);\s*", chat)
if not m_useproj:
    die("Could not find useProject() destructuring in ChatHeaderActions.tsx")

inject_block = """
  const templateId = (projectData?.templateId as any) ?? "auto";
  const effectiveTemplateId = resolveEffectiveTemplateId(templateId);
  const TEMPLATE_LABEL: Record<string, string> = {
    auto: "Auto",
    full: "Full",
    navigation: "Navigation",
    crud: "CRUD",
    base: "Base",
  };
  const effectiveLabel = TEMPLATE_LABEL[String(effectiveTemplateId)] ?? String(effectiveTemplateId);
  const templateBadge =
    String(templateId) === "auto"
      ? `Auto → ${effectiveLabel}`
      : (TEMPLATE_LABEL[String(templateId)] ?? String(templateId));
"""

if "const templateBadge" not in chat:
    chat = chat[:m_useproj.end()] + inject_block + chat[m_useproj.end():]

# Replace handleChooseTemplate with cleaned version (robust)
pattern = r"const handleChooseTemplate\s*=\s*\(\)\s*=>\s*\{[\s\S]*?\n\s*\};"
new_handle = r'''const handleChooseTemplate = () => {
    Alert.alert(
      "Template",
      "Standard ist Auto (Auto ⇒ Full). Manuell ist nur für Debug/Tests.",
      [
        { text: "Auto (Default: Full)", onPress: () => setTemplateId("auto") },
        { text: "Full", onPress: () => setTemplateId("full") },
        { text: "Navigation", onPress: () => setTemplateId("navigation") },
        { text: "CRUD", onPress: () => setTemplateId("crud") },
        { text: "Base", onPress: () => setTemplateId("base") },
        { text: "Abbrechen", style: "cancel" },
      ]
    );
  };'''
if re.search(pattern, chat):
    chat = re.sub(pattern, new_handle, chat, count=1)

# Insert template info row + advanced menu item after menu title
menu_title = '<Text style={styles.menuTitle}>Projekt / Chat</Text>'
if menu_title in chat and "menuInfoRow" not in chat:
    insert_ui = menu_title + """
          <View style={styles.menuInfoRow}>
            <Ionicons name="layers-outline" size={16} color="#9CA3AF" style={{ marginRight: 8 }} />
            <Text style={styles.menuInfoText}>Template: {templateBadge}</Text>
          </View>

          <TouchableOpacity style={styles.menuItem} onPress={handleChooseTemplate}>
            <Ionicons name="options-outline" size={18} color="#fff" style={styles.menuIcon} />
            <Text style={styles.menuItemText}>Template (Advanced)</Text>
          </TouchableOpacity>
"""
    chat = chat.replace(menu_title, insert_ui, 1)

# Add styles for menuInfoRow/menuInfoText (if missing)
if "menuInfoRow" not in chat or "menuInfoText" not in chat:
    # try to inject inside StyleSheet.create
    ms = re.search(r"StyleSheet\.create\(\{\n", chat)
    if not ms:
        die("Could not find StyleSheet.create({ in ChatHeaderActions.tsx")
    # place near menuTitle style if possible
    if "menuTitle:" in chat and "menuInfoRow:" not in chat:
        chat = chat.replace(
            "menuTitle: {",
            "menuTitle: {\n",
            1
        )
    # inject block before closing "});"
    if "menuInfoRow:" not in chat:
        chat = chat.replace(
            "menuTitle: {",
            "menuTitle: {\n",
            1
        )
    if "menuInfoRow:" not in chat:
        # fallback: inject before last "};" within styles object
        chat = chat.replace(
            "menuTitle: {",
            "menuTitle: {\n",
            1
        )

    # safer: inject right after menuTitle block end if present
    if "menuTitle:" in chat and "menuInfoRow:" not in chat:
        chat = re.sub(
            r"(menuTitle:\s*\{[\s\S]*?\n\s*\},\n)",
            r"""\1    menuInfoRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 16,
      paddingBottom: 10,
      marginTop: -6,
      opacity: 0.95,
    },
    menuInfoText: {
      color: "#9CA3AF",
      fontSize: 12,
      letterSpacing: 0.2,
    },
""",
            chat,
            count=1
        )

# Fix the weird "fü...zt" text if it still exists anywhere
chat = chat.replace("fü...zt", "für zukünftige Projekte gesetzt")

write(chat_path, chat)
print(f"✅ Patched {chat_path}")

# -----------------------------
# 2) Optional: screens/AppInfoScreen.tsx (only if it already mentions Auto template text)
# -----------------------------
appinfo_path = ROOT / "screens" / "AppInfoScreen.tsx"
if appinfo_path.exists():
    app = read(appinfo_path)
    backup(appinfo_path)

    # Only polish if file already contains any Auto-template wording
    if ("Auto (erkennt" in app) or ("Auto (Default" in app) or ("Effektiv" in app and "templateId" in app):
        app2 = app
        app2 = app2.replace("Auto (erkennt anhand deiner Dateien)", "Auto (Default: Full)")
        app2 = app2.replace("Auto (Empfohlen)", "Auto (Default: Full)")
        if app2 != app:
            write(appinfo_path, app2)
            print(f"✅ Polished {appinfo_path}")
        else:
            print(f"ℹ️ No AppInfoScreen template text changes needed")
    else:
        print("ℹ️ AppInfoScreen has no template section detected — skipping")

print("🎉 Done.")
PY

echo "🧪 Running checks..."
npm run typecheck
npm run lint:ci
npm run test:silent

echo "✅ All green. Show changed files:"
git status --porcelain
