# Patch 638 - Deep-Scan SoT-/Debt-Rebaseline

## Ziel
- Vollstaendigen kritischen Deep-Scan auf aktuellem Branchstand dokumentieren.
- Reale Doku-/SoT-Drifts korrigieren, ohne Runtime-/Contract-Aenderungen.

## Umgesetzt
- Stand-Header der Kern-MDs auf denselben Patchstand gebracht:
  - `docs/INDEX.md`
  - `docs/TESTING_GUIDE.md`
  - `docs/FRESH_CHECKOUT_GREEN_PATH.md`
- `docs/TODO.md` auf denselben Stand gezogen und Deep-Scan-Rebaseline als erledigten Punkt aufgenommen.
- `docs/04-risk-hotspots.md` um frische Inventarzahlen erweitert:
  - `as any`: 331 gesamt / 150 codefokussiert
  - `: any`: 170 gesamt / 152 codefokussiert
  - klare Runtime-vs-Test/Historie-Einordnung.
- `docs/reviews/deep-scan-review-2026-03-30.md` um `Addendum II` mit bestaetigten Drifts, Korrektur und Non-Issues ergaenzt.
- `README.md`, `docs/patches/PATCHLOG_ROOT.md` und `PROJECT_CHECKLOG.md` auf denselben Stand synchronisiert.

## Verifikation
```bash
node scripts/docsLint.js
bash scripts/check_patch_docs_sync.sh
bash scripts/check_workflow_template_drift.sh
bash scripts/check_managed_workflows.sh
bash scripts/check_workflow_edge_contracts.sh
bash scripts/check_legacy_disabled_edges.sh
git diff --check
npm run typecheck
npm run lint:ci
npm run test:silent
```

## Ergebnis
- Keine Runtime-/Contract-Aenderung.
- SoT-/Header-/Review-/Patchlog-Drift beseitigt.
