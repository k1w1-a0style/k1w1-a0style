# Patch 107 — Workflow/Template Korrekturen (2026-02-14)

## Ziel
- GitHub Actions Builds sollen beim manuellen Triggern standardmäßig den *aktuellen Branch* bauen, wenn kein `ref` angegeben ist.
- Templates (expo-sdk54 base/full) sollen die korrigierten Workflow-Dateien enthalten.
- PR-Template und Workflow-README sind konsistent zu den lokalen Checks (`typecheck`, `lint:ci`, `test:silent`).

## Änderungen
- Workflows: `eas-build.yml`, `release-build.yml`, `k1w1-triggered-build.yml`
  - `inputs.ref` default von `main` → leer
  - Fallback: `inputs.ref || github.ref_name`
  - `concurrency.group` nutzt ebenfalls den Fallback
- Templates: `templates/expo-sdk54-base.json`, `templates/expo-sdk54-full.json`
  - Eingebettete Workflows aktualisiert (entspricht Repo-Workflows)
- PR Template: `.github/PULL_REQUEST_TEMPLATE.md`
  - Aktualisiert auf lokale Checks und Build/Template Checkpoints
- Docs: Changelog + Build-Verification + TODO aktualisiert

## Nicht enthalten
- Keine Änderungen an `eas.json` (kein `withoutCredentials`).
- Keine Änderungen an `contexts/ProjectContext.tsx` (kein automatisches Secret-Overwrite vor Builds).

## Verifikation
- `npm run typecheck`
- `npm run lint:ci`
- `npm run test:silent`
- GitHub Actions:
  - Workflow manuell starten, `ref` leer lassen → baut `github.ref_name` Branch
