# Patch 530 — Runtime-Import→Dependency-Diagnose vor CI Lite

## Ziel
Offensichtliche Runtime-Importe aus Expo-/React-Native-Paketen sollen bereits im lokalen Diagnose-/AutoFix-Pfad auffallen, statt erst als roter CI-Lite-Run sichtbar zu werden.

## Änderungen
- Neuer Preflight-Check `runtime-import-dependency-mismatches` scannt relevante Runtime-Quelldateien auf externe Imports aus:
  - `expo-*`
  - `@expo/*`
  - `react-native-*`
  - `@react-native-*`
  - Kernpakete `expo` / `react-native`
- Relative/lokale Imports sowie Test-/Build-/Workflow-/Docs-Pfade werden ignoriert.
- Treffer liefern strukturierte `findings` mit:
  - `packageName`
  - `importingFiles`
  - `severity`
  - `category`
  - `fixability`
  - `suggestedInstallMethod`
  - optionaler `versionSuggestion`
- Sicherer AutoFix fuer Expo-SDK-54-Faelle:
  - `expo-linear-gradient` → `~15.0.8`
  - `expo-blur` → `~15.0.7`
- Unsichere Faelle bleiben bewusst diagnose-only und geben klare Install-Hinweise statt halbgarer Schreiboperationen.

## Tests
- Neue fokussierte Jest-Datei fuer:
  - Erkennung von `expo-linear-gradient`
  - Erkennung von `expo-blur`
  - Ignorieren lokaler Imports
  - Nicht-Meldung bereits vorhandener Dependencies
  - AutoFix fuer sichere Expo-Faelle
  - diagnose-only fuer nicht sicher auto-fixbare Runtime-Pakete
