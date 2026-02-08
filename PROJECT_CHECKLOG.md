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


## Patch 05 (workflows: reusable build + YAML fixes)

This patch focuses on **CI correctness and maintainability**:

- **Fixed broken YAML** in `k1w1-triggered-build.yml` and `eas-build.yml` (they would fail to parse in GitHub Actions).
- **Reusable workflow refactor**: `k1w1-triggered-build.yml` is now a thin wrapper that forwards payload/inputs into `eas-build.yml` via `workflow_call`.
- **Secrets-safe keystore export**: moved inline Node heredoc into `scripts/ci/writeAndroidSigningFilesFromExport.js` to avoid YAML indentation foot-guns and to ensure secrets are never logged.
- Added composite action `.github/actions/setup-node-npm` (ready for broader workflow de-duplication; currently used as a building block for future patches).

Next suggested patch areas:
- Further de-dup in workflows (setup/install/test blocks).
- Optional: switch EAS build step to `--no-wait --json` and poll status to reduce CI minutes and improve resilience.


---

## Screen Deep Dive 01: EnhancedBuildScreen

**Files checked:**
- `screens/EnhancedBuildScreen/index.tsx`
- `screens/EnhancedBuildScreen/hooks/useEnhancedBuildScreen.ts`

### Was gut ist
- **UI ist sauber getrennt** (Header/Status/Repo/Profile/Logs/History als Sections).
- Hook ist **moderat groß (423 Zeilen)** und deutlich wartbarer als der große Diagnostic-Hook.
- **Race-Condition Schutz** bei `fetchRuns()` via `runsReqIdRef` (Request-ID Pattern) → verhindert “alte Antworten überschreiben neue”.
- **Logs werden nur geladen wenn nötig** (`shouldLoadLogs`) + Auto-Refresh toggelbar.
- `withTimeout()` begrenzt “hängende” Requests.

### Kritische Punkte / Risiken
- **Workflow-Dateiname hart kodiert:** `getWorkflowRuns(..., "k1w1-triggered-build.yml")`. Das ist ok solange wir den Wrapper-Workflow behalten (Patch 05), aber sollte als Konstante zentral sein.
- **Log Rendering:** `toLocaleTimeString()` pro Log-Line kann bei sehr vielen Logs zäh werden (Modal + lange Builds). Cap/Virtualization wäre sauberer.
- **Type Safety:** `preferredBuildProfile as any` → besser sauber validieren (ist klein, aber unnötig riskant).
- **Timeout vs. Abbruch:** `withTimeout()` bricht den Fetch nicht wirklich ab (kein AbortController). Ist ok, aber kann “hängende” Promises im Hintergrund lassen.

### Konkrete TODOs
- [ ] `WORKFLOW_FILE` als gemeinsame Konstante (z.B. `CONFIG.BUILD.WORKFLOW_FILE`).
- [ ] Log-UI: maximal N Zeilen anzeigen (z.B. 2000), “Load more” optional.
- [ ] `preferredBuildProfile` ohne `any` validieren.


## Screen Deep Dive 02: CodeScreen

**Files checked:**
- `screens/CodeScreen/index.tsx`
- `screens/CodeScreen/components/EditorBody.tsx`

### Was gut ist
- Explorer/Editor/ImageViewer sauber getrennt.
- **Dirty-Check** + Save/Discard Dialog beim Zurückgehen ist korrekt.
- Preview-Modus nutzt `SyntaxHighlighter` (Edit bleibt “raw”).

### Kritische Punkte / Risiken
- **TextInput als Code-Editor** (`EditorBody.tsx`) → bei großen Dateien (500+ Zeilen) schnell zäh, bei 2k+ Zeilen quasi unbrauchbar. Das ist genau der Kernpunkt aus SONETs Aussage.
- **Edit ohne Syntax Highlighting** (nur Preview). Das ist UX-okay, aber “CodeScreen” wirkt dann wie Notepad.
- Kein Undo/Redo, kein Autosave / Crash-Recovery.

### Konkrete TODOs
- [ ] Für große Dateien: entweder Editor-Library (z.B. Monaco-ähnlich) oder “Read-only ab X KB” + extern bearbeiten.
- [ ] Autosave debounce (z.B. 500ms) + manuelles Save bleibt.
- [ ] Optional: simple Undo/Redo Stack (limit 50 states).


## Patch 06
- Fix: `scripts/ci/writeAndroidSigningFilesFromExport.js` ESLint `no-undef` for `Buffer` by enabling Node env and importing Buffer from `buffer`.
- Notes: This unblocks pre-commit hooks (`lint:ci`) so Patch 05 can be committed and pushed cleanly.


## Patch 07 — ESLint Flat Config: Node globals for CI scripts

**Problem:** ESLint (Flat Config) warnt, dass `/* eslint-env */` Kommentare künftig als Fehler behandelt werden. In `scripts/ci/writeAndroidSigningFilesFromExport.js` führte das bereits zu Warnungen; vorher sogar zu `Buffer is not defined`.

**Fix:**
- Entfernt `/* eslint-env node */` Kommentar aus dem Script.
- `eslint.config.js` bekommt ein Override für `scripts/ci/**`, das Node-Globals (`Buffer`, `process`, `require`, `module`, `__dirname`) explizit setzt.

**Ergebnis:** `npm run lint:ci` bleibt sauber (ohne Zukunfts-Footgun).



## Patch 08 — DiagnosticScreen Hook Split (Phase 1: Prefs + Upload)

**Ziel:** `useDiagnosticScreen.ts` war ein Hook-Monolith (~2000 Zeilen). Phase 1 extrahiert die **zwei riskantesten Side-Effect Blöcke** (AsyncStorage Prefs + Upload/Cooldown) in eigene Hooks, ohne Verhalten zu ändern.

**Änderungen:**
- Neu: `screens/DiagnosticScreen/hooks/useDiagnosticPreferences.ts`
  - Lädt + speichert Diagnostics-Prefs pro Projekt (AsyncStorage `multiGet/multiSet`)
  - Enthält den Debounce (500ms) gegen AsyncStorage-Spam
  - Synchronisiert optional `preferredBuildProfile` (nur wenn nicht Advanced/All)
- Neu: `screens/DiagnosticScreen/hooks/useDiagnosticUpload.ts`
  - Cooldown Persistenz + Countdown Tick
  - Upload + Copy-to-Clipboard mit sanitized Payload
  - ClientRequestId Handling + DeviceId via SecureStore
- `useDiagnosticScreen.ts`
  - Entfernt AsyncStorage/UUID/Clipboard/Crypto/SecureStore aus dem Monolith
  - Composed die neuen Hooks und returned dieselben Props weiter (Backwards kompatibel)

**Risiko-Check:**
- Keine Logikänderung beabsichtigt: nur Extraktion/Komposition.
- Upload-/Prefs-Keys bleiben identisch.
- Wenn irgendwas schief läuft, betrifft es zuerst Diagnostics UX (nicht App-Core) → kontrolliertes Risiko.

**Next:** Phase 2 Split: Fix-Runner + AutoFix + Patch-Sync als eigene Hooks (macht die verbleibenden ~1500 Zeilen deutlich kleiner).


## Patch 09 — DiagnosticScreen Hook Split (Phase 2: Fix Runner)

**Ziel:** Den verbleibenden größten Side-Effect Block aus `useDiagnosticScreen.ts` auslagern: **Apply Patch / Undo / AutoFix / Fix Selected / Fix Modal / Preview**.

**Änderungen:**
- Neu: `screens/DiagnosticScreen/hooks/useDiagnosticFixRunner.ts`
  - Ownt `history` (Undo-Snapshots), Preview-State (PreviewModal), FixRunModal-State
  - Implementiert: `applyPatch`, `undoLast`, `undoAll`, `applySingle`, `applyIssueFix`, `applyFixList`, `smartFix`, `autoFix`, `applySelected`
  - GitHub-Sync bleibt bewusst *best-effort* (nur wenn `syncFixesToGitHub` aktiv und Repo gültig).
  - Optionales `clearHistoryRef`: erlaubt `runDiagnostics()` weiterhin, die Undo-History bei einem Fresh-Run zu resetten, ohne zirkuläre Abhängigkeit.
- `useDiagnosticScreen.ts`
  - Stark verkleinert: läuft jetzt als Orchestrator (Prefs + Upload + Run + FixRunner Komposition)
  - Return-API bleibt kompatibel (Screens/Sections brauchen keine Änderungen)

**Risiko-Check:**
- Behavior soll gleich bleiben (reiner Split + minimale Plumbing).
- Kritischster Punkt ist History-Reset: ist über `clearHistoryRef` weiterhin an `runDiagnostics()` gekoppelt.
- Wenn hier etwas schief läuft, betrifft es Diagnostics-Fixes/UX → schnell sichtbar, aber nicht App-Core.

**Next (Patch 10):** DiagnosticScreen Phase 3: Runner/Preflight Orchestrator weiter splitten (Pipeline/local checks), plus gezieltes Cleanup von ungenutzten States.


## Patch 10 — TypeScript Fixes nach Patch 09

**Ziel:** Build wieder grün machen (Typecheck + Husky), ohne Verhalten zu ändern.

**Fixes:**
- `useDiagnosticFixRunner.ts`: TS-Narrowing über Closure war weg → Patch wird jetzt einmal in `const patch = ...` gecached und dann in allen Callbacks verwendet.
- `useDiagnosticScreen.ts`: Dependency Array hat `target.profile` direkt referenziert (Union-Typ) → dependency ist jetzt `target.mode === "eas" ? target.profile : undefined`.

**Risiko-Check:**
- Reiner Typ-/Refactor-Fix. Keine Logikänderung beabsichtigt.
