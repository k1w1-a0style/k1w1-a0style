# PATCH 63 — ChatScreen hardening + privacy + cancellation + parsing fixes

**Datum:** 2026-02-12

## Changes
- Chat/AI-Flow:
  - AbortController pro Request + Abort bei Unmount (keine Ghost-Updates)
  - AutoFix FIFO Queue (kein Überschreiben)
  - `handleSendWithMeta()` liefert boolean → Draft-Restore bei Fehlern
- Privacy:
  - Setting “Chat-Verlauf speichern” (AsyncStorage)
  - Retention-Cap (Default: 200) beim Persistieren
- Normalizer:
  - JSON-Fallback extrahiert jetzt **Object oder Array** (inkl. ```json fences)
- FileWriter:
  - `referenced` prüft incoming **und** existing
- Tests:
  - Normalizer: embedded object + fenced object

## Files
- `hooks/useChatAIFlow.ts`
- `screens/ChatScreen/hooks/useChatScreen.ts`
- `lib/orchestrator.ts`
- `lib/normalizer.ts`
- `lib/__tests__/normalizer.test.ts`
- `lib/fileWriter.ts`
- `lib/chatPrivacySettings.ts` (new)
- `contexts/projectStorage.ts`
- `screens/SettingsScreen/components/PrivacySection.tsx` (new)
- `screens/SettingsScreen/hooks/useSettingsScreen.ts`
- `screens/SettingsScreen/index.tsx`
- `screens/SettingsScreen/styles.ts`
- `docs/reviews/CHAT_SCREEN_VERIFICATION.md` (new)
- `docs/patches/PATCH_63_NOTES.md` (new)
- `docs/TODO.md`
- `PROJECT_CHECKLOG.md`

