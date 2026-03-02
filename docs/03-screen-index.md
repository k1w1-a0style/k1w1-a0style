# 03 — Screen Index (Screen → Zweck → Primäraktionen)

Stand: 2026-03-02

> Hinweis: Normative Contracts liegen in `docs/01-state-contract.md` und `docs/02-build-pipeline.md`.

| Screen | Purpose | Primary Actions (Buttons/Flows) | Related Contracts/Docs | Diagnostics touched |
|---|---|---|---|---|
| `GitHubReposScreen` | Repo/Branch selection + Repo sync ops | Repo auswählen, Branch auswählen, `Secrets synchronisieren`, branch tools | `01-state-contract`, `13-screen-flow-map` | Indirekt (liefert Repo/Branch Kontext für Pipeline-Checks) |
| `ConnectionsScreen` | Tokens + Connection lights + EAS project link/create | Token speichern/testen, EAS Link/Create | `01-state-contract`, `06-build-readiness` | Pipeline prereqs (`local.githubToken`, `local.expoToken`) |
| `DiagnosticScreen` | Local+Pipeline checks und Fix-Loops | `Run diagnostics`, `Smart Fix`, `Auto-Fix anwenden`, `Patch Vorschau` | `07-diagnostics-fix-playbook`, `06-build-readiness` | Direkt: alle Preflight/Pipeline checks |
| `EnhancedBuildScreen` | Build gate + Build start + history/status | Profil wählen, `Start Build`, one-click deploy options | `02-build-pipeline`, `06-build-readiness` | Liest `diagnostic_last_ok`, Signing/Token flags |
| `CredentialsWizardScreen` | Signing key status/flow je Modus | Mode wählen, Status refresh/generate | `01-state-contract`, `06-build-readiness` | Schreibt `CRED_KEY_EXISTS_*` für Build gate |
| `AppStatusScreen` | Projekt-/Config-Überblick | Tabs/sections für overview/validation/files | `00-overview` | Keine direkten Fixes, nur Sichtbarkeit |
| `AppInfoScreen` | Backup/Export/Import + Projekt-Meta | Backup export/import, API key sections | `01-state-contract` | Indirekt (Import kann linked Repo/Branch ändern) |
| `PreviewScreen` | Laufzeit-Preview inkl. Statusbar | Device frame, toolbar actions, fullscreen | `10-product-and-flows` | Keine Build-Gate Checks |
| `TerminalScreen` | Operative Logs/Filter | Filter/Search/Clear | `runbooks/APP_RUNBOOK.md` | Diagnose-/Buildfehler sichtbar machen |

## Ergänzung
- Detail-Flow inkl. Mermaid: `docs/13-screen-flow-map.md`
