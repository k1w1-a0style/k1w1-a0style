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
| CodeScreen | screens/CodeScreen/index.tsx | 197 | WebView editor + bridge hardened | isDirty unified, focus sync, injection hardening, txt export, QoL fixes | 0 | useCodeScreen | done | Deep-dive patches 27-34 |
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


---

## Merged Append-Logs (Patches 18/20/21)

_Diese Sektion wurde aus den `PROJECT_CHECKLOG_APPEND_PATCH_*.md` Dateien zusammengeführt. Nach Commit kann man die Append-Dateien löschen, damit es nur noch **eine** Checklog-Datei gibt._

### Patch 18

#### Patch 18 – Notes / Manual Append for PROJECT_CHECKLOG.md

Date: 2026-02-09

##### What was fixed
- CI failure: `expo.extra.eas.projectId` was `undefined` in `npx expo config --json` (GitHub Actions).
  - Root cause: `app.config.js` relied on `process.cwd()`; Expo CLI can evaluate config with a different cwd.
  - Fix: read `eas-project.json` via `__dirname` first (fallback to `process.cwd()`).
- Workflow Lint (actionlint/shellcheck) failures:
  - `k1w1-diagnostics.yml`: fixed SC2129 by grouping writes to `$GITHUB_STEP_SUMMARY` and `$GITHUB_OUTPUT`.
  - `release-build.yml`: fixed SC2259 by removing `echo "$RESP" | node - <<'NODE'` (pipe + heredoc conflict). Pass JSON via env instead.
  - Also cleaned up quoting and output appends for robustness.

##### How to verify
- Local:
  - `npx expo config --json | node -e 'const c=require("fs").readFileSync(0,"utf8"); const j=JSON.parse(c); console.log(j?.expo?.extra?.eas?.projectId)'`
    → should print a UUID.
- CI:
  - `CI / ci / ci` should pass the “Expo config smoke test (projectId present)” step.
  - `Workflow Lint (dry)` should pass actionlint.

##### Commit message suggestion
fix(ci): make expo projectId deterministic; fix workflow-lint shellcheck warnings

### Patch 20

##### Patch 20 — Fix expo.extra.eas.projectId locally + in CI

**Problem:** `npx expo config --json` returned `expo.extra.eas.projectId = undefined` even though `eas-project.json` existed.

**Root cause:** `app.config.js` was not reliably setting `extra.eas.projectId` (CWD differences / merge logic).

**Fix:** `app.config.js` now:
- reads `./eas-project.json` using `__dirname` (repo root)
- merges `config.extra` safely
- falls back to `EAS_PROJECT_ID` / `EXPO_PUBLIC_EAS_PROJECT_ID` in CI

**Verification (Soll-Ziel):**
- `npx expo config --json | ...` sollte eine UUID liefern
- GitHub CI Step “Expo config smoke test (projectId present)” sollte grün sein

**Ist-Stand (laut aktuellem Log):**
- `npx expo config --json | ...` liefert derzeit noch `undefined` → Follow-up nötig

### Patch 21

##### Patch 21
- **Fix (CI/local):** Make `expo.extra.eas.projectId` deterministic by:
  - Reading `eas-project.json` via absolute path (`__dirname`)
  - Supporting env overrides (`EAS_PROJECT_ID` / `EXPO_PUBLIC_EAS_PROJECT_ID`)
  - Throwing a clear error when missing (instead of silently returning undefined)
- **CI improvement:** Export `EAS_PROJECT_ID` from `eas-project.json` before running `expo config` to avoid CWD quirks.
- **New helper:** `scripts/getEasProjectId.js` for debugging/CI.


---

## SONET Screen-Reviews (kritisch gegengeprüft)

Quelle: SONET PDFs (ChatScreen / Preview Screens / Repos Screen). Ich habe die Punkte nicht 1:1 übernommen, sondern nach **Impact**, **Reproduzierbarkeit** und **Fix-Aufwand** eingeordnet.

### ChatScreen

- **Hoch:** `useChatAIFlow` ist sehr groß (Hook-Monolith) → erhöht Risiko für State-Chaos, doppelte Requests und schwer testbaren Code.
- **Hoch:** mögliche **Race-Conditions** (gleichzeitige Requests / Stream + UI-Events) → Bedarf an `requestId`/Abort + zentralem Gate.
- **Mittel:** „Memory Leak“ ist meist **State-Update-nach-Unmount** (Warnungen/Side-Effects), kein echter Leak – trotzdem sauber mit `AbortController` + Cleanup lösen.
- **Mittel:** Performance bei langen Chats: Parsing/Regex/Mapping in Render-Pfaden → memoization, derived state vorrechnen, MessageItem stärker `memo`isieren.

**Empfohlene Fix-Reihenfolge:** Hook splitten (Messages/Streaming/Attachments/Persistence) → Request-Abbruch → Render-Optimierung (Virtualisierung/Memoization) → Tests für Race-Cases.

### Preview Screens (PreviewScreen + PreviewFullscreen)

- **Hoch:** fehlende **Error Boundary** / harte Crash-Pfade bei Preview-Generation.
- **Hoch:** **Race Condition** in `createPreview` möglich (parallel triggerbar) → Singleflight/Mutex + Abort auf Screen-Leave.
- **Mittel:** veraltetes „mounted guard“ Pattern – funktioniert, aber besser: Abort/Cancellation + zentraler Helper.
- **Mittel:** Performance bei großen Projekten (Preview build/scan) → chunking, progressive UI, cancellation.
- **Niedrig/Mittel:** string-basierte Import-Replacement Logik ist fragil → mind. Unit-Tests + defensive parsing.

### Repos Screen

- **Hoch:** Hook-Komplexität + fehlende klare Trennung zwischen: Auth, Repo-Listing, Branch/Tree, File-Pull.
- **Hoch:** Rate-Limit / Fehlerbehandlung (GitHub API) → Backoff + Retry + klare UI-States.
- **Mittel:** ineffizientes File-Pull (viele Einzelrequests) → Tree-Endpoints nutzen, batching, caching/ETag.
- **Mittel:** UI-Performance (lange Listen) → Virtualisierung + stabile Keys + memo.


---

## Offene Punkte / Status

- **CI (Expo config smoke test):** `expo.extra.eas.projectId` ist in CI weiterhin manchmal `undefined`. Die lokale Repro (`npx expo config --json`) zeigt ebenfalls `undefined` → deutet darauf hin, dass Expo CLI den `app.config.js` nicht wie erwartet auswertet oder ein anderes Config-File Vorrang hat. **Nächster Schritt:** CI sollte `scripts/getEasProjectId.js` direkt auslesen und/oder `app.json` als Fallback mit `extra.eas.projectId` versehen.
- **Workflow Lint (actionlint/shellcheck):** wurde in Patch 18 adressiert; bitte in Actions prüfen ob noch Findings offen sind.

---

## Screen-Audit (SONET PDFs) – kritisch eingeordnet

Quelle: die drei PDFs von SONET (ChatScreen, PreviewScreens, ReposScreen).  
Wichtig: Das ist **kein Ersatz** für einen Code-/Runtime-Check, aber ein guter “Red-Flag”-Scanner.  
Ich habe die Aussagen **kritisch** bewertet (was plausibel ist, was nachweis/Code-Check braucht, was evtl. übertrieben ist).

### 1) ChatScreen (SONET: 33 Seiten)

**Kernaussage (plausibel):** Der Hook `useChatAIFlow` ist zu groß/zu “allwissend” (≈695 Zeilen) und mischt viele Verantwortlichkeiten → schwer testbar, hoher Bug-Surface.  
**Meine Bewertung:** **Sehr plausibel**. Das Muster (“God Hook”) ist ein Klassiker und erzeugt genau die Probleme, die SONET beschreibt.

**Haupt-Risiken laut SONET (mit meiner Einstufung):**
- 🔴 **Architektur/Komplexität:** Splitting in mehrere Hooks/Services empfohlen. → **Ja, höchste Priorität**, weil Wartbarkeit/Testbarkeit.
- 🔴 **Rendering-Performance:** MessageParts/Code-Blöcke werden oft teuer gerendert; fehlende Virtualization für große Code-Blöcke. → **Sehr plausibel**, besonders bei langen Chats/Code.
- 🟡 **Parsing-Performance:** Regex/Parsing im Render-Loop. → **Plausibel**, muss aber im Code verifiziert werden.
- 🟡 **Keyboard Offset Workarounds:** “Nudges” sind fragil. → **Plausibel**, aber manchmal pragmatisch ok.

**Konkrete ToDos (geordnet):**
1. Split `useChatAIFlow` in klar getrennte Units:
   - state/store (chat state)
   - orchestrator/streaming
   - file ops / patch apply
   - parsing/normalization
2. Message Rendering härten:
   - heavy parts memoizen
   - Code-Blocks: lazy render / virtualization / collapsible
   - Parsing cachen (z.B. memoized per message id)
3. Tests: Smoke + 2–3 targeted unit tests für Parser/Reducer/Orchestrator.

### 2) PreviewScreen + PreviewFullscreenScreen (SONET: 23 Seiten)

**Kernaussage:** Insgesamt solide, aber ein paar typische Stabilitäts-/Perf-Lücken.
**Meine Bewertung:** Klingt **realistisch** (nicht “Drama”), gute Trefferquote.

**Auffälligkeiten laut SONET:**
- 🟡 **Keine lokale ErrorBoundary** für PreviewScreen. → **Sinnvoll** (Preview ist anfällig).
- 🟡 **Fehlende Retry-Logik** für Preview-Erstellung. → **Nice-to-have**, abhängig von UX.
- 🟡 **useEffect/Async Cleanup**: potentieller Memory Leak / veraltete Mounted-Guards. → **Sehr plausibel**.
- 🟡 **Race Condition** beim `createPreview`. → **Plausibel**, sollte mit AbortController/Request-Id fixbar sein.
- 🟡 **String/Regex Import Replacement** (RN → RN-Web) kann falsch matchen. → **Echte Gefahr**, wenn es breit eingesetzt wird.

**Konkrete ToDos:**
1. PreviewScreen: lokale ErrorBoundary + “Reset preview” CTA.
2. createPreview: Abort/Request-Id + “disable while running”.
3. Import-Rewrite: entweder AST-basiert (Babel) oder engere/safer Regex + Tests gegen Edge-Cases.
4. Große Projekte: Profiling (Dateianzahl, Preview build time), ggf. chunking.

### 3) GitHubReposScreen (SONET: 32 Seiten)

**Kernaussage:** Hook/Screen zu groß (≈630 Zeilen, 50+ states), Re-render/Async-Race/Ineffiziente Pull-Logik.
**Meine Bewertung:** **Sehr plausibel**. “Viele States + viele Effects” → Re-render Storms & Race Conditions sind fast garantiert.

**Auffälligkeiten laut SONET:**
- 🔴 **Komplexität:** “God Hook” (`useGitHubReposScreen`). → **Priorität hoch** (wie Chat).
- 🟡 **Race conditions / Abort fehlend** (refresh mehrfach, unmount). → **Wichtig**, aber meist schnell fixbar.
- 🔴 **Ineffizientes Pulling**: pro Datei viele API calls (Rate limits). → **Sehr wichtig**, wenn real.
- 🟡 **Input Validation** (Repo/Branch). → **Schneller Win**.
- 🟡 **Hardcoded Template Loading**. → Kontextabhängig, aber besser konfigurierbar.

**Konkrete ToDos:**
1. Split Hook:
   - token/session
   - repo list + pagination
   - pull/download strategy
   - create repo + validation
2. Pull Strategy prüfen:
   - wenn möglich “archive/tarball” statt 1 API call pro file
   - Cache / ETag / conditional requests
3. Concurrency/Race: AbortController oder requestId, disable refresh while pending.
4. Validation + user feedback.

### Fazit zu SONET
- SONET trifft bei **“God Hook” + Performance + Async-Races** sehr wahrscheinlich ins Schwarze.
- Was ich **nicht blind übernehmen** würde: konkrete Zeit-Schätzungen (“2 Tage”) und pauschale Library-Empfehlungen ohne Kontext.
- Nächster Schritt: **Code-Check gegen diese Hypothesen** (1 Screen nach dem anderen) + ggf. Profiling auf echten Worst-Case Daten.

---
## Patch 26 — TODO#1 save_preview access clarification + client-side guard

**Files**
- `hooks/usePreview.ts`
- `docs/TODO.md`

**Changes**
- Skip calling `supabase/functions/v1/save_preview` when no Edge Admin Key is configured (avoids unnecessary 401s; local preview still works).
- Update TODO to reflect that `save_preview` is admin-key protected (not public) and document the behavior.

**Checks**
- `npm run typecheck`
- `npm run lint:ci`
- `npm run test:silent`
