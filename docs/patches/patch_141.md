# Patch 141 — CI Lite Chain-Run + Header Neon Polish

## Änderungen

### GitHub Actions
- **Chain-Run:** Nach erfolgreichem `k1w1-ci-lite-autofix.yml` wird automatisch `k1w1-ci-lite.yml` auf derselben Branch dispatcht.
- Korrelation bleibt über dieselbe `job_id` im `run-name` (damit die App die Runs sauber findet).

### In-App UI
- Nach einem **erfolgreichen Autofix** folgt das Modal automatisch dem **CI Lite Chain-Run** (gleiche `job_id`).
- Globaler Header-Button **✅**: dunkler Look + neon-grüner Akzent.
- Status-Lämpchen:
  - grau = waiting/unknown
  - grün = success
  - rot = failure
  - pulsierend = running

## Verifikation

1. App öffnen → globaler **✅** Button → `CI: Lint + Typecheck` laufen lassen
2. Bei ESLint-Funden: `Autofix ESLint` starten
3. Wenn Autofix erfolgreich war:
   - Modal wechselt automatisch auf den **CI Lite Chain-Run**
   - Header-Lämpchen zeigt den Status (pulsierend → grün/rot)
4. Optional: Run in GitHub öffnen (Button `Open Run`) und Artifact-Logs prüfen
