#!/bin/bash
output="selected_source_files.txt"
> "$output"

echo "### ==== ROOT ====" >> "$output"
cat App.tsx app.config.js babel.config.js config.ts eas.json metro.config.js package.json tsconfig.json theme.ts >> "$output" 2>/dev/null
echo -e "\n\n" >> "$output"

echo "### ==== .github/workflows ====" >> "$output"
cat .github/workflows/eas-build.yml .github/workflows/deploy-supabase-functions.yml >> "$output" 2>/dev/null
echo -e "\n\n" >> "$output"

echo "### ==== components ====" >> "$output"
cat components/Breadcrumb.tsx components/CreationDialog.tsx components/CustomDrawer.tsx components/CustomHeader.tsx components/FileItem.tsx components/FileTree.ts components/MessageItem.tsx components/SyntaxHighlighter.tsx >> "$output" 2>/dev/null
echo -e "\n\n" >> "$output"

echo "### ==== contexts ====" >> "$output"
cat contexts/AIContext.tsx contexts/githubService.ts contexts/ProjectContext.tsx contexts/projectStorage.ts contexts/TerminalContext.tsx contexts/types.ts >> "$output" 2>/dev/null
echo -e "\n\n" >> "$output"

echo "### ==== hooks ====" >> "$output"
cat hooks/useChatHandlers.ts >> "$output" 2>/dev/null
echo -e "\n\n" >> "$output"

echo "### ==== lib ====" >> "$output"
cat lib/ConversationHistory.ts lib/prompts.ts lib/supabase.ts >> "$output" 2>/dev/null
echo -e "\n\n" >> "$output"

echo "### ==== screens ====" >> "$output"
cat screens/AppInfoScreen.tsx screens/ChatScreen.tsx screens/CodeScreen.tsx screens/ConnectionsScreen.tsx screens/SettingsScreen.tsx screens/TerminalScreen.tsx >> "$output" 2>/dev/null
echo -e "\n\n" >> "$output"

echo "### ==== supabase/functions ====" >> "$output"
cat supabase/functions/check-eas-build/index.ts supabase/functions/k1w1-handler/index.ts supabase/functions/trigger-eas-build/index.ts >> "$output" 2>/dev/null
echo -e "\n\n" >> "$output"

echo "### ==== utils ====" >> "$output"
cat utils/chatUtils.ts >> "$output" 2>/dev/null
echo -e "\n\n### ✅ Fertig! Alle Inhalte in: $output" >> "$output"

echo "✅ Fertig! Alles gespeichert in: $output"
