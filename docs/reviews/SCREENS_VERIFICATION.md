# Screens & Modules – Verification Index

Stand: **2026-02-12**

Dieses Dokument ist die **gemeinsame Übersicht** über alle vorhandenen Verifikations-Dokumente unter `docs/reviews/`.
Einzelne Screen-Verifikationen bleiben bestehen – hier ist nur der **Index / Merge**.

## Status-Übersicht

| Bereich | Datei | Status | Hinweis |
|---|---|---|---|
| AppInfoScreen | `APP_INFO_SCREEN_VERIFICATION.md` | ✅ verified | Privacy/Backup hardening |
| AppStatusScreen | `APP_STATUS_SCREEN_VERIFICATION.md` | ✅ verified | status validation + tests |
| ChatScreen | `CHAT_SCREEN_VERIFICATION.md` | ✅ verified | timer cleanup (Jest open handles) |
| CodeScreen | `CODE_SCREEN_VERIFICATION.md` | ✅ verified | P1/P2 fixes aus Review umgesetzt |
| ConnectionsScreen | `CONNECTIONS_SCREEN_VERIFICATION.md` | ✅ verified | input masking + validation + sanitization |
| CredentialsWizardScreen | `CREDENTIALS_WIZARD_SCREEN_VERIFICATION.md` | ✅ verified | security tests passing |
| DiagnosticScreen | `DIAGNOSTIC_SCREEN_VERIFICATION.md` | ✅ verified | filter contract + throttle + tests |
| EnhancedBuildScreen | `BUILD_SCREEN_VERIFICATION.md` | ✅ verified | reentrancy/unmount guards + logs redaction |
| GitHubReposScreen | `GITHUB_REPOS_SCREEN_VERIFICATION.md` | ✅ verified | selection consistency + race guards |
| Preview Screens | `PREVIEW_SCREENS_VERIFICATION.md` | ✅ verified | navigation/url guards + fullscreen hardening |
| SettingsScreen | `SETTINGS_SCREEN_VERIFICATION.md` | ✅ verified | API key masking + validation |
| TerminalScreen | `TERMINAL_SCREEN_VERIFICATION.md` | ✅ verified | secret redaction + perf hardening |
| Supabase (Functions + Migration) | `SUPABASE_MIGRATION_VERIFICATION.md` | ✅ verified | RLS + Edge error sanitization |

## Regeln (damit wir nicht wieder doppelt führen)
- **Einzel-Dokumente** bleiben die Quelle der Details.
- Dieser Index wird bei neuen Screens/Modulen **mitgezogen** (damit nichts “verschwindet”).
