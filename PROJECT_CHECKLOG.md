# k1w1-a0style – Projekt-Diagnose Log (living doc)

Datum: 2026-02-08  
Ziel: **Vollständiger, kritischer Check** (Screens → Funktionen → Build/Infra).  
Dieses Dokument ist dafür gedacht, dass wir **nach jedem Check neue Erkenntnisse anhängen**, damit nichts verloren geht.

---

## Vorgehensvorschlag (so bleibt's sauber und schnell)

### Phase A – Baseline (1x)
- Inventar: Screens, Navigation, Contexts, wichtige Services (Supabase, GitHub, Build).
- Static Checks (bei dir lokal oder CI):
  - `npm run preflight` (lint + typecheck + tests + expo-doctor)
  - Android: `./gradlew :app:assembleRelease` (lokal) + EAS build (cloud)
- “Red-Flag Scan”: Secrets, unsichere APIs, debug signing, AAB/APK mismatch, WebView Security.

### Phase B – Screen Audit (systematisch, aber effizient)
Wir gehen **screenweise** vor, aber in **2 Durchläufen**:
1) **Schnellscan aller Screens** (Navigation erreichbar? Hauptfunktion? Error states? Abhängigkeiten?)  
2) **Deep Dive** pro Screen (Happy path + Edge cases + Nebenwirkungen + Performance)

### Phase C – Funktions-Audit (quer über alle Screens)
- Projekt-/File-Handling, Build-Trigger, Preview-System, Credentials, Storage, GitHub, Terminal/Commands.
- Datenflüsse: Contexts ↔ Supabase ↔ GitHub Actions ↔ App UI.

### Phase D – Fixes als kleine, saubere Patches
- Jede gefixte Sache: **Patch ZIP + Eintrag hier** (was/warum/was getestet).

---

## Sofortige Red Flags (aus Code-Scan)

- Android Gradle: **release** nutzt aktuell `signingConfig signingConfigs.debug` → bricht korrektes Release-Signing (EAS / Keystore Injection).
- `eas.json`: `production.android.buildType` ist **aab** (AAB), obwohl dein Build/Downloader-Flow offenbar auf **APK** ausgerichtet ist.
- GitHub Actions: Workflows enthalten noch **AAB**-Logik: `.github/workflows/release-build.yml`, `.github/workflows/eas-build.yml`, `.github/workflows/k1w1-triggered-build.yml`.

---

## Screen-Inventar & Status

| Screen | File | LOC | WebView | Network | Console | Hooks | Status | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| AppInfoScreen | screens/AppInfoScreen/index.tsx | 79 |  |  | 0 | useAppInfoScreen | not checked |  |
| AppStatusScreen | screens/AppStatusScreen/index.tsx | 102 |  |  | 0 | useAppStatusScreen | not checked |  |
| ChatScreen | screens/ChatScreen/index.tsx | 151 |  |  | 0 | useChatScreen | not checked |  |
| CodeScreen | screens/CodeScreen/index.tsx | 197 |  |  | 0 | useCodeScreen | not checked |  |
| ConnectionsScreen | screens/ConnectionsScreen/index.tsx | 243 |  | yes | 0 | useConnectionsScreen | not checked | network |
| CredentialsWizardScreen | screens/CredentialsWizardScreen/index.tsx | 111 |  | yes | 0 | useCredentialsWizardScreen | not checked | network |
| DiagnosticScreen | screens/DiagnosticScreen/index.tsx | 684 |  |  | 0 | useDiagnosticScreen, useNavigation, useProject | not checked |  |
| EnhancedBuildScreen | screens/EnhancedBuildScreen/index.tsx | 111 |  |  | 0 | useEnhancedBuildScreen | not checked |  |
| GitHubReposScreen | screens/GitHubReposScreen/index.tsx | 279 |  |  | 0 | useGitHubReposScreen | not checked |  |
| SettingsScreen | screens/SettingsScreen/index.tsx | 86 |  |  | 0 | useSettingsScreen | not checked |  |
| TerminalScreen | screens/TerminalScreen/index.tsx | 91 |  |  | 0 | useTerminalScreen | not checked |  |
| PreviewScreen.tsx | screens/PreviewScreen.tsx | 569 |  | yes | 0 | useNavigation, usePreview, useProject | not checked | network |
| PreviewFullscreenScreen.tsx | screens/PreviewFullscreenScreen.tsx | 520 | yes |  | 3 | useNavigation, useRoute | not checked | webview |


---

## Wie wir testen (praktisch)

### Pro Screen prüfen wir immer:
- **Navigation erreichbar?** (Drawer/Tab/Stack)
- **State-Initialisierung** (Context/AsyncStorage/Network)
- **Hauptaktionen** (Buttons, Submit, Trigger)
- **Fehlerfälle** (kein Internet, fehlende Credentials, Supabase down, GitHub API fail)
- **Android-Spezifika** (BackHandler, Permissions, WebView, File Picker)
- **Performance** (FlatList, Memoization, Re-renders, große JSONs)

### “All Screens auf einmal” vs “einzeln”
- **Automatisiert (lint/typecheck/tests)** → prüft *quer* alles auf einmal (Syntax/Types/Unit Tests).
- **UI/Flows** → müssen wir *screenweise* abarbeiten, sonst übersieht man Nebenwirkungen.

---

## Nächster Schritt (mein Vorschlag)
1) Wir starten mit **Screen-Audit Durchlauf 1 (Schnellscan)**: alle Screens, aber jeweils nur:
   - Zweck + Kernaktionen
   - Abhängigkeiten (Context/Network/WebView)
   - Offensichtliche Bugs/Crash-Risiken
2) Danach priorisieren wir: was zuerst fixen.

> Ich kann direkt mit **ChatScreen → PreviewScreen → EnhancedBuildScreen** anfangen, weil dort die meisten kritischen Flows zusammenlaufen.

---

## Changelog
- 2026-02-08: Dokument angelegt, Inventar erstellt, erste Red Flags notiert.


## Patch Bundle 01–04 (applied in this ZIP)

This patch bundle implements the highest-priority fixes identified in the checklist:

- **Android release signing**: Release builds no longer force debug signing (`android/app/build.gradle`).
- **EAS profiles**: `production.android.buildType` is now **apk** (artifact type consistent with the in-app flow).
- **GitHub Actions workflows hardening**:
  - `release-build.yml` rewritten (it was YAML-broken) and the keystore export step no longer dumps secrets in error paths.
  - `eas-build.yml` keystore export step hardened (no secret dumps, files written with restrictive permissions).
  - `k1w1-triggered-build.yml` now always produces APK and uses a composite action to de-duplicate the “determine checkout ref” logic.
- **Diagnostics preferences**: debounced writes to AsyncStorage (reduces “write spam” during rapid toggles).
- **Credentials wizard**: fixed busy-state / refreshAll concurrency edge case.

Pending items remain documented in the TODO sections (workflow refactor beyond determine-ref, DiagnosticScreen hook split, CodeScreen editor scalability, Preview WebView hardening, etc.).

## Patch 17 (CI)

- Fix: make CI failure actionable when `expo.extra.eas.projectId` is missing by printing diagnostics and pointing to `eas-link.yml` / `eas-project.json`.
- Reminder: `app.config.js` reads `./eas-project.json` to set `extra.eas.projectId` deterministically; ensure `eas-project.json` stays committed.

