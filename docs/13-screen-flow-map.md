# 13 — Screen / Flow Map

Stand: **2026-03-17 (Patch 477)**

## Screen-Matrix (Quick Nav)

| Screen | Zweck | Primäraktionen | Kritische Abhängigkeiten |
|---|---|---|---|
| `GitHub Repos` | Repo/Branch-SoT + Repo-Setup | Branch/Repo wählen, EAS-Link, Secret-Sync | Basis für `repo.*` Checks |
| `Verbindungen` | Token-/Connectivity-Status | Tokens testen/speichern | `local.*` Checks |
| `Diagnose` | Checklauf + Fix-Loop | `Scannen`, `Fixen`, `Auto-Fix` | Gate für Build-Freigabe |
| `Build` | Readiness + Build-Ausführung | `Build starten`, Retry/Cancel | `diagnostic_last_ok`, Branch gesetzt |
| `Credentials Wizard` | Signing/Profil-Readiness | prüfen/ergänzen | Production Build |
| `Terminal` | Laufzeitbeobachtung | Logs lesen | Incident-/Debug-Pfad |

## End-to-End Flow

```mermaid
flowchart LR
  A[GitHub Repos\nRepo + Branch setzen] --> B[Verbindungen\nTokens prüfen]
  B --> C[Diagnose\nScannen]
  C --> D{FAIL/WARN offen?}
  D -- Ja --> E[Fix-Loop\nAuto-Fix / Manuell]
  E --> C
  D -- Nein --> F[Build\nProfil wählen + Start]
  F --> G[Status / History\nPolling + Verlauf]
```

## Routing-Hinweise

- **`repo.*` / `local.*` rot:** zuerst Repo-/Token-Basis in `GitHub Repos`/`Verbindungen` korrigieren.
- **Preflight-Dateichecks rot:** in `Diagnose` über Issue-Details + Patch-Vorschau bearbeiten.
- **Build-Gate blockiert:** branch/diagnostic state prüfen, dann gezielt zurück in den passenden Screen.
