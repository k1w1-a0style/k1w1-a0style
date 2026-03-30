# Patch 637 — PR-506 Doku-/SoT-Konsolidierung + AGENTS-Nachschärfung

## Ziel

Den bestehenden PR-Branch dokumentarisch/organisatorisch sauber geradeziehen, ohne neue Feature- oder Refactor-Arbeit.

## Änderungen

1. **Kern-MD-Stand harmonisiert**
   - `docs/INDEX.md`
   - `docs/TESTING_GUIDE.md`
   - `docs/FRESH_CHECKOUT_GREEN_PATH.md`
   - Stand-/Patch-Header auf aktuellen Branchstand gezogen.

2. **Deep-Scan-Review konsolidiert**
   - `docs/reviews/deep-scan-review-2026-03-30.md`
   - Überholte Aussagen im Hauptteil korrigiert (z. B. Trust-Follow-up / CS-REST-001 nicht mehr als offen geführt).
   - Hauptteil und Addendum wieder auf denselben Wahrheitsstand gebracht.

3. **Prozess-Härtung in `AGENTS.md` (minimal, verbindlich)**
   - Verbindlicher Doku-/SoT-Abgleich vor Abschluss ergänzt.
   - Pflicht-Kern-MDs explizit gelistet.
   - Pflichtangaben für Abschlussbericht ergänzt:
     - geprüft/geändert/unverändert + Begründung.

4. **Doku-/Patch-Sync nachgezogen**
   - `README.md`
   - `docs/TODO.md`
   - `PROJECT_CHECKLOG.md`
   - `docs/patches/PATCHLOG_ROOT.md`

## Verifikation

- `bash scripts/check_patch_docs_sync.sh`
- `git diff --check`
- `node scripts/docsLint.js`
- `bash scripts/check_workflow_template_drift.sh`
- `bash scripts/check_managed_workflows.sh`
- `bash scripts/check_workflow_edge_contracts.sh`
- `bash scripts/check_legacy_disabled_edges.sh`
