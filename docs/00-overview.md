# 00 — Overview

Stand: **2026-03-12**

## Zielbild (operativ)

k1w1-a0style führt Operatoren durch eine stabile Kette:

1. `GitHub Repos` — Repo + Branch explizit setzen
2. `Verbindungen` — Tokens/Connectivity prüfen
3. `Diagnose` — Checks ausführen und Fix-Loop schließen
4. `Build` — nur bei grüner Readiness starten
5. `Status/History` — Verlauf und Laufzeitstatus verfolgen

## Source-of-Truth (SoT)

- **Repo/Branch:** `projectData.linked*` ist die führende Auswahl; kein stilles Erraten.
- **Workflow-Ref:** produktive Deploy-/Build-Pfade sind explizit ref-gesteuert.
- **CI-Lite-Ausnahme:** branch-basierte Chain ist bewusst dokumentiert und begrenzt.
- **Build-Job-ID:** positive numerische `jobId` (bigint-backed).
- **Diagnostics-Upload-ID:** im Client opaque string; Backend bleibt bigint-backed.

## Sicherheits- und Governance-Leitplanken

- Keine Service-Role-Key-Nutzung mehr in Client-Pfaden.
- Workflow-/Edge-Verträge bleiben über Guard-Skripte + Invariants gegen Drift abgesichert.
- Legacy-/Retired-Edge-Funktionen bleiben explizit als deaktiviert dokumentiert.

## Was dieses Dokument bewusst **nicht** ist

- Kein vollständiges Incident-Runbook.
- Keine Patch-Historie im Detail.

Für diese Bereiche:
- Runbook: `docs/runbooks/APP_RUNBOOK.md`
- Patch-Historie: `docs/patches/PATCHLOG_ROOT.md`

## Operator-Kurzchecks

Vor jedem Build:
- Repo/Branch gesetzt
- Diagnostics zuletzt grün (`diagnostic_last_ok = true`)
- notwendige Secrets/Tokens vorhanden
- Profil korrekt (z. B. `production`)

## Nächste Pflegepunkte

- Kern-MDs weiterhin synchron halten (`README.md`, `docs/INDEX.md`, diese Übersicht, Screen-/Flow-Dokus).
- Historienballast aus Kernflächen fernhalten; Details in Patchnotizen belassen.
