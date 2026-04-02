# 03 — Screen Index

Stand: **2026-04-02 (Docs Konsolidierung)**

Kompakte Übersicht über die operativen Hauptscreens.

| Screen | Hauptzweck | Primäre Aktionen | Typische Ergebnisse |
|---|---|---|---|
| `GitHub Repos` | Repo/Branch-SoT + Repo-Operationen | Repo/Branch wählen, `EAS Projekt erstellen/verbinden`, `Secrets synchronisieren` | Konsistente Repo-/Branch-Basis für alle Folgeflows |
| `Verbindungen` | Verbindungszustand und Tokens | Tokens testen/speichern (GitHub/Expo/Supabase) | Verbindungen grün, klare Fehlerhinweise bei fehlenden Rechten |
| `Diagnose` | Check-Ausführung + Fix-Loop | `Scannen`, `Fixen`, `Auto-Fix anwenden`, `Patch Vorschau` | selection-scoped `diagnostic_last_ok::<repo>::<branch> = true` oder klarer Next Step |
| `Build` | Readiness-Gate + Buildstart | Profil wählen, `Build starten`, Retry/Cancel | Build startet nur mit erfüllten Voraussetzungen |
| `Credentials Wizard` | Signing-/Profil-Readiness | prüfen/wechseln/ergänzen | Production-Readiness für Signierung |
| `Terminal` | Laufzeit-Logs/Debug | Logs lesen/filtern | Schnelle Incident-Einordnung |

Siehe Detailfluss: `docs/13-screen-flow-map.md`.
