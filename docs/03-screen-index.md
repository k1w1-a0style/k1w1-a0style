# 03 — Screen Index (Screen → Zweck → Primäraktionen)

Stand: 2026-03-12

> Normative Contracts: `docs/01-state-contract.md` und `docs/02-build-pipeline.md`.

| Screen | Purpose | Primäraktionen | Relevante Docs |
|---|---|---|---|
| `GitHubReposScreen` | Repo/Branch-SoT setzen, Repo-Operationen | Repo/Branch wählen, `Secrets synchronisieren`, EAS link/create | `01-state-contract`, `13-screen-flow-map` |
| `ConnectionsScreen` | Tokens + Connection-Status | Token speichern/testen, EAS link/create | `01-state-contract`, `06-build-readiness` |
| `DiagnosticScreen` | Checks + Fix-Loop | `Run diagnostics`, `Smart Fix`, `Auto-Fix anwenden`, `Patch Vorschau` | `07-diagnostics-fix-playbook`, `06-build-readiness` |
| `EnhancedBuildScreen` | Build-Gate + Start + Verlauf | Profil wählen, `Start Build`, One-click Deploy | `02-build-pipeline`, `06-build-readiness` |
| `CredentialsWizardScreen` | Signing/Profil-Readiness | Modus wählen, Status refresh/generate | `01-state-contract`, `06-build-readiness` |
| `AppStatusScreen` | Projekt-/Config-Überblick | Tabs/Sektionen prüfen | `00-overview` |
| `AppInfoScreen` | Backup/Export/Import + Projekt-Meta | Backup export/import, Key-Bereiche | `01-state-contract` |
| `PreviewScreen` | Runtime-Preview | Toolbar/Device/Fullscreen | `10-product-and-flows` |
| `TerminalScreen` | Operative Logs | Filtern/Suchen/Löschen | `runbooks/APP_RUNBOOK.md` |

## Ergänzung
- Detailfluss mit Mermaid: `docs/13-screen-flow-map.md`
