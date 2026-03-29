# Patch 617: Supabase-/Operator-Runbook-Restpunkt operativ geschlossen

## Problem

In `docs/TODO.md` war der Supabase-/Operator-Restpunkt noch als offene Sammelaufgabe markiert. Dadurch war die Betriebsreihenfolge fuer Setup, Claims, Secrets, DB-/Storage-Voraussetzungen, Preview/Signing und Workflow-Edges nicht als ein klarer Live-Test-Vertrag sichtbar.

## Aenderung

1. **TODO aufgeloest und sauber getrennt**
   - Der offene Supabase-/Operator-Runbook-Punkt ist als **geschlossen** markiert.
   - Externe Restaufgaben (Claim-Provisioning, Secret-Rotation, produktive Dashboard-/Ops-Themen) sind explizit als **ausserhalb Repo-Code** gekennzeichnet.

2. **Verbindliche Reihenfolge in Build-Readiness dokumentiert**
   - `docs/06-build-readiness.md` enthaelt jetzt einen klaren Ablauf fuer:
     - Operator-Claim (`build_admin`)
     - lokale scoped Keys
     - Supabase-/Preview-/Signing-Secrets
     - DB-/Storage-/Function-Preconditions
     - Repair-/Dispatch-Reihenfolge
     - Live-Test-Start
   - Dazu eine Troubleshooting-Matrix (Symptom -> Ursache -> naechster Schritt).

3. **Runbook-Contract ueber Status-/Risk-/State-Doku synchronisiert**
   - `docs/EDGE_FUNCTIONS_STATUS.md`: operative Kurzreihenfolge ergaenzt.
   - `docs/04-risk-hotspots.md`: Verweis, dass der offene Runbook-Restpunkt jetzt vertraglich geschlossen ist.
   - `docs/01-state-contract.md`: externer `build_admin`-Claim als Betriebsvertrag explizit verankert.

4. **Repo-seitige Guardrail fuer Doku-Vertrag**
   - `scripts/check_workflow_edge_contracts.sh` prueft jetzt zusaetzliche Runbook-Kernanker in der Doku (`docs/06-build-readiness.md`, `docs/TODO.md`, `docs/EDGE_FUNCTIONS_STATUS.md`), damit der operative Vertrag nicht still verschwindet.

## Ergebnis / Vertrag ab Patch 617

- Kein unklarer Supabase-/Operator-Restpunkt mehr in `docs/TODO.md`.
- Setup-Luecken werden operativ als Setup-Luecken erkennbar (statt „kaputt wirkender“ Codepfad).
- Reihenfolge und Verantwortungen fuer Preview/Signing/Workflow-Operatorpfade sind repo-weit konsistent dokumentiert.
