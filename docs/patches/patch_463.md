# Patch 463 — SettingsScreen + AIContext Restpunkte (Quality/Retention/Typing)

## Ziel
Bestätigte Restprobleme in SettingsScreen/AIContext minimal-konservativ schließen, ohne Broad-Refactor: echter Quality-Mode-Effekt, ehrliche Retention-Bedienbarkeit, weniger `any`-Hotspots, gezielte Validation-/Test-Nachzüge.

## Änderungen
- `contexts/AIContext/index.tsx`
  - `setQualityMode(...)` stellt jetzt zusätzlich `selectedChatMode` und `selectedAgentMode` passend zur gewählten Quality-Persona um.
  - Unbenutzten deprecated Helper `rotateApiKeyOnError` entfernt.
- `contexts/AIContext/helpers.ts`
  - Kleine Helper für Quality-Mode→Provider-Default-Mapping ergänzt (`getModeKeyForQualityMode`, `resolveProviderModeForQualityMode`).
- `screens/SettingsScreen/hooks/useSettingsScreen.ts`
  - Quality-Mode-Handler setzt effektive Chat-/Agent-Modelle explizit mit.
  - Retention-Limit-Editing ergänzt (`retentionInput`, Save-Handler, Persistenz via `setChatHistoryRetentionLimit`).
  - Save-Pfad wirkt jetzt sofort in der aktiven Session, weil der Settings-Hook die Runtime-Retention direkt im `ProjectContext` aktualisiert.
  - Provider-Status-Normalisierung auf getypten Helper umgestellt (statt `any`-basierter Inline-Logik).
  - Letzter-Key-Hinweis im Remove-Dialog ergänzt.
- `screens/SettingsScreen/hooks/settingsHelpers.ts`
  - Tote/irrelevante Imports entfernt.
  - `getProviderStatusSnapshot(...)` als getypte Normalisierung für Record/Array-Statusformen ergänzt.
  - Gemini-Key-Prefix-Validation (`AIza`) ergänzt.
- `screens/SettingsScreen/components/PrivacySection.tsx`
  - Retention-Limit-Feld + Speichern-Button ergänzt; Read-only-Halbfertig-Status beseitigt.
- `screens/SettingsScreen/index.tsx`, `screens/SettingsScreen/styles.ts`
  - Privacy-Retention-Props/Styles ergänzt.
- `screens/SettingsScreen/components/{QualitySection,ModeList,GeneratorSection,AgentSection,ProviderTiles}.tsx`
  - Flow-nahe Typing-Nachzüge; unnötige `as any` reduziert.
- Tests:
  - `__tests__/aiContext.qualityMode.test.ts`
  - `__tests__/settingsScreen.helpers.test.ts`
  - `__tests__/projectContext.retentionLimitSanitizer.test.ts`

## Offen / bewusst nicht Teil von Patch 463
- Kein Ausbau einer neuen Provider-/Config-Architektur.
- Kein Broad-Refactor des gesamten Settings-/AIContext-Blocks.
- Retention-UI bleibt bewusst minimal (numerisches Feld + Save), ohne zusätzliche UX-Komplexität wie Slider/Presets.
