# TODO

Stand: **2026-02-12**


## GitHubReposScreen
- [x] RS-001: Recent-Pills nutzen zentralen Repo-Select-Flow (kein inkonsistenter State).
- [x] RS-002: BranchSelector race-safe (stale requests ignorieren).
- [x] RS-003: Manage-Modal Busy-Lock (kein Double-Submit, Input/Button disabled während Request).
- [ ] RS-004: Refresh Unmount-Guard (setState-after-unmount verhindern).
- [ ] RS-005: splitFullName strikt validieren (genau owner/repo).
- [ ] RS-006: Repo-Liste virtualisieren (FlatList) falls viele Repos.
- [ ] RS-008: Tests für kritische Repo/Branch/Modal-Flows ergänzen.

## ✅ Done (CodeScreen)
- WebView-Editor (ohne gravierende UI-Änderung)
- RN↔WebView Bridge stabilisiert
- Focus-Tracking + Sync-Fix (inkl. Resync nach Blur, keine State-Drifts)
- Injection-Härtung beim Initialisieren des Editor-Inhalts
- WebCodeEditor CSS Textfarbe fix (kein [object Object])
- `isDirty` vereinheitlicht (Hook + UI, inkl. Preview)
- TXT-Export stabil (expo-file-system typings kompatibel)
- QoL:
  - Duplicate-Kollisionen verhindern
  - Dateiendung-Regeln (kein blindes `.tsx` für `Dockerfile`, `.env`, usw.)
  - Clipboard `await` + Fehlerhandling
  - SyntaxErrorBar stabile Keys (ohne fileName/column)
- Unsaved-Changes Flow hardened: "Speichern" navigiert nur weiter, wenn wirklich gespeichert wurde
- A11y: Undo/Redo im Editor mit Accessibility-Labels/Hints
- File-Actions: UI-Pre-Validation + Collision-Check (kein Ghost-Selection bei failed create/rename/move)
- Wartbarkeit/Perf:
  - `useCodeScreen` in kleinere Hooks gesplittet (Explorer/Editor/Actions)
  - Validation debounced + per `InteractionManager.runAfterInteractions` deferred
- Security:
  - Bridge Message-Schema strikter validiert + Unit-Tests
- Typing-Hygiene:
  - `gap` RN-Types per global `.d.ts` ergänzt (kein `as any` mehr nötig)
  - `expo-file-system` Typen lokal ergänzt (kein `any`-Cast)

## ✅ Done (Maintenance)
- Patch-Skripte/Docs bereinigt und Handoff-Prompt angelegt.

## ✅ Done (Preview)
- Guard: Scheme-Allowlist (nur sichere Schemes extern, dangerous schemes geblockt)
- Guard: Fail-closed wenn `mode="url"` und `baseOrigin=null`
- Fullscreen: `originWhitelist` mode-spezifisch verengt (Defense-in-Depth)
- Fullscreen: One-shot Auto-Recovery bei WebView Prozessabbruch (Loop-Schutz)
- Tests: `previewNavigationGuards` um kritische Negativfälle ergänzt
- Cleanup: unnötige `useCallback` Dependencies entfernt

## ✅ Done (Diagnostic)
- Batch-Fix Dedupe: content-sensitiver Fingerprint (kein false-dup)
- Preferences: Hydration-Gate gegen Load/Save Race
- Async Safety: Progress-Stage Guards (kein setState nach Unmount)
- Filter Contract Cleanup ("info" entfernt, UI/Hook konsistent)
- Performance: progressive Results throttled (300ms) + final flush
- Tests: patchFingerprint + Preferences Hydration

## ✅ Done (AppInfo)
- Privacy: API keys masked by default + short reveal action (auto-hide)
- Import correctness: API config import is **Replace** (not merge/append)
- Backup validation: stricter schema checks + sanitization
- Perf: memoized template resolution
- Tests: appInfo backup/privacy unit tests

## 🔧 Optional / Tech-Debt (CodeScreen)
- Performance (nur falls spürbar): Syntax-Validation/Quality-Checks weiter auslagern (Worker/Task) oder „progressive validation“.
- WebView/Bridge Paranoia: CSP / striktere WebView Settings (soweit Plattform zulässt).

## ⏭️ Next (CodeScreen)
- Nichts Kritisches offen.

## ➡️ Next: Preview
1) **PreviewScreen** komplett fertig machen (Funktionalität vor UI/Polish).
2) **PreviewFullscreen** danach.

### Preview – aktuelle Restpunkte (funktional first)
- UI/Polish bleibt offen (spacing, labels, nicer timestamps).
- Optional: strengere HTTPS-only Policy, wenn Preview nur für sichere Quellen gedacht ist.


## UI/UX Polish (ganz zum Schluss)
- Einheitliche Optik über alle Screens + kleine Grafik-/Spacing-Fixes.

- [x] ChatScreen: follow-up typecheck fixes after patch 63 (patch 64)
- [x] ChatScreen: hotfix orchestrator parse error after patch 64 (patch 65)
- [x] Patch 65: fix orchestrator parse error after patch 64 (patch 65)

- [x] ChatScreen: hotfix orchestrator TS scope errors after patch 65 (patch 66)

- [x] AppStatusScreen: config/entry correctness + perf caps (patch 67)
- [x] AppStatusScreen: styles keys fix (patch 68)
- [x] AppInfoScreen: backup import/schema alignment + stricter validation (patch 70)
- [x] CredentialsWizardScreen: hardening + privacy redaction + validation + tests (patch 71)
- [x] CredentialsWizardScreen: hotfix typings + apiKey redaction + truncation marker (patch 72)
- [x] CredentialsWizardScreen: hotfix WizardHttpDebug.ms typing (patch 73)
- [x] CredentialsWizardScreen: hotfix WizardHttpDebug optional status/statusText for sanitizer tests (patch 74)

- [x] TerminalScreen: privacy redaction + log caps + safer batching + docs/tests (patch 75)

- [x] Patch 76: TerminalScreen hotfix (LogRow imports + redaction markers + truncation test alignment)

- [x] Patch 77: TerminalScreen hotfix (LogRow typing/palette + preserve "Bearer" scheme)
