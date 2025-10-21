#!/bin/bash

# Backup
cp screens/ChatScreen.tsx screens/ChatScreen.tsx.backup

# 1. Füge Debug-Log nach apiKey-Laden ein
sed -i '/const apiKey = await AsyncStorage.getItem(apiKeyStorageKey);/a\    console.log("🔑 DEBUG API-Key Check:", { provider: selectedProvider, model: selectedMode, hasKey: !!apiKey, keyLength: apiKey?.length || 0, keyPreview: apiKey ? apiKey.substring(0, 4) + "..." : "KEIN KEY!" });' screens/ChatScreen.tsx

# 2. Ändere "prompt:" zu "message:"
sed -i 's/prompt: prompt,/message: prompt,/' screens/ChatScreen.tsx

echo "✅ ChatScreen.tsx wurde gepatcht!"
echo "📦 Backup: screens/ChatScreen.tsx.backup"
