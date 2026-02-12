# Screen & Backend Verification – Übersicht (Single Source of Truth)

Stand: **2026-02-12**

Diese Datei ist die **gemeinsame Übersicht** über alle Screen-/Backend-Verifikationen.

- Einzelne Verifikationen bleiben als Detail-Dokumente bestehen.
- Diese Übersicht ist das „Index-Dokument“ und soll **immer aktuell** bleiben.

---

## 1) Abdeckung: Sind alle Screens vorhanden?

Aus `/screens` ergeben sich aktuell folgende Haupt-Screens:

| Bereich | Screen/Scope | Status | Detail-Doku |
|---|---|---:|---|
| App | AppInfoScreen | ✅ verified | `docs/reviews/APP_INFO_SCREEN_VERIFICATION.md` |
| App | AppStatusScreen | ✅ verified | `docs/reviews/APP_STATUS_SCREEN_VERIFICATION.md` |
| App | ChatScreen | ✅ verified | `docs/reviews/CHAT_SCREEN_VERIFICATION.md` |
| App | CredentialsWizardScreen | ✅ verified | `docs/reviews/CREDENTIALS_WIZARD_SCREEN_VERIFICATION.md` |
| App | DiagnosticScreen | ✅ verified | `docs/reviews/DIAGNOSTIC_SCREEN_VERIFICATION.md` |
| App | EnhancedBuildScreen | ✅ verified | `docs/reviews/BUILD_SCREEN_VERIFICATION.md` |
| App | GitHubReposScreen | ✅ verified | `docs/reviews/GITHUB_REPOS_SCREEN_VERIFICATION.md` |
| App | SettingsScreen | ✅ verified | `docs/reviews/SETTINGS_SCREEN_VERIFICATION.md` |
| App | TerminalScreen | ✅ verified | `docs/reviews/TERMINAL_SCREEN_VERIFICATION.md` |
| App | PreviewScreen + PreviewFullscreenScreen | ✅ verified | `docs/reviews/PREVIEW_SCREENS_VERIFICATION.md` |
| App | CodeScreen | ⏳ pending | `docs/reviews/CODE_SCREEN_VERIFICATION.md` |

**Ergebnis:**
- ✅ Alle *bekannten* Screens sind in der Übersicht erfasst.
- ⚠️ **CodeScreen** ist als einziger Screen noch **nicht** formal verifiziert (pending).

---

## 2) Backend / Supabase (auch Teil der Abnahme)

| Bereich | Scope | Status | Detail-Doku |
|---|---|---:|---|
| Supabase | Functions + Migrations (RLS/Policies) | ✅ verified | `docs/reviews/SUPABASE_MIGRATION_VERIFICATION.md` |

---

## 3) Regeln

### Optik / UI
- Jede Verification muss explizit sagen: **„Ändert sich was an der Optik?“**
- Wenn ja: genau benennen **wo** und **wie** (z.B. Eye-Icons, Disabled Buttons, Masking).

### Privacy/Security
- Secrets dürfen nicht in UI/Alerts/Logs auftauchen.
- Error-Messages: **sanitize + truncate**.
- Clipboard/Export: **redact + cap** (defense-in-depth).

### Konsistenz
- Fixes sollen Single-Source-of-Truth nutzen (kein „zweiter Codepfad“ für denselben Flow).
- Async Flows: **unmount + stale guards**.
