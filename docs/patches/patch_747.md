# Patch 747 — Docs-Honesty + Preview-Legacy-Risiko-Doku + Writeback-Scope-Tightening

## Ziel

Restpunkte nach den Persistenz-/Recovery-Fixes sauber abschliessen, ohne diese Bereiche erneut breit anzufassen:
- ehrliche Abschlussdoku (DocsHonesty)
- Preview-Legacy-Block transparent begrenzen/dokumentieren
- Writeback-Scope weiter verengen, ohne legitime Kernflows zu brechen

## Umsetzung

1. **DocsHonesty**
   - `docs/reviews/Review.md` und `docs/TODO.md` auf sachliche Formulierungen nachgezogen.
   - Keine pauschalen Siegerformulierungen; verbleibende Risiken/Kompatibilitaetsgrenzen explizit benannt.
2. **PreviewLegacyCleanup (minimal-invasiv)**
   - Legacy-`?secret=` bleibt als begrenzter Brueckenpfad fuer Altlinks erhalten.
   - Guardrails (bereits im Code): Token-Format-Validation, Query->Fragment-Handoff, Header-fetch.
   - Risiko/Begruendung explizit dokumentiert statt still geduldet.
3. **WritebackScopeTightening**
   - `.github/workflows/eas-build.yml`: Writeback nur noch `work|codex|dev|develop`.
   - `.github/workflows/eas-link.yml`: Writeback nur noch `work|codex|main|dev|develop`.
   - Zugehoerige Managed-/Template-Dateien synchronisiert.
4. **FinalCleanPass**
   - Re-Scan auf Drift/Folgefehler + relevante Checks gruen.

## Tests / Checks

- `npm run -s typecheck`
- `npm run -s lint:ci`
- `npm run -s test:silent -- --runInBand __tests__/easBuildWritebackRefGuard.invariants.test.ts __tests__/previewEdgeErrorContract.test.ts`
- `bash scripts/check_managed_workflows.sh`
- `bash scripts/check_workflow_template_drift.sh`
- `npm run -s docs:lint`
- `npm run -s docs:check:contracts`
- `bash scripts/check_patch_docs_sync.sh`

## Nicht-Ziele

- kein erneuter Umbau der frisch stabilisierten Persistenz-/Recovery-Implementierung
- keine harte Entfernung der Preview-Legacy-Bruecke ohne Migrationsfenster fuer Altlinks
