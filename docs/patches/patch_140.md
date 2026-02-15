# Patch 140 — CI Lite: separater Autofix-Workflow + In-App Trigger

## Änderungen

- GitHub Actions:
  - **Neuer Workflow** `k1w1-ci-lite-autofix.yml` (ESLint `--fix` + guarded commit/push + Verify via Lint+Typecheck).
  - `k1w1-ci-lite.yml` ist wieder **read-only checks** (Lint+Typecheck + Logs/Artifacts), ohne Writeback.
- In-App:
  - Der Button **Autofix ESLint** im CI Lite Modal triggert jetzt den **separaten Autofix-Workflow**.
  - Run-Korrelation weiterhin über `job_id` im `run-name`.

## Verifikation

1. App öffnen → globaler ✅ Button → **CI: Lint + Typecheck** laufen lassen
2. Bei ESLint-Funden: **Autofix ESLint** drücken → Workflow schreibt (falls erlaubt) einen Commit zurück
3. Danach CI Lite erneut laufen lassen (oder Logs im Autofix-Run prüfen)
