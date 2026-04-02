# Patch 679 — Post-test-debt Deep Scan + SoT-Rebaseline

## Ziel

Nach den Test-/Mock-Wellen den Projektstand ehrlich neu bewerten, verbleibenden Debt sauber einordnen und die Kern-MDs wieder auf denselben Patchstand ziehen.

## Umgesetzt

- Deep Scan nach den letzten Test-/Fixture-Runden dokumentiert: ausserhalb von Tests/Docs/Historie sind keine `any`-Reste mehr bestaetigt.
- `docs/TODO.md` markiert Durchlauf 39 als abgeschlossen und priorisiert 40–42 jetzt nach echten Test-/Fixture-Clustern.
- `docs/04-risk-hotspots.md` fuehrt den Reststand jetzt explizit als Test-/Fixture-/Historien-Thema statt als Produktcode-Risiko.
- `docs/reviews/deep-scan-review-2026-03-30.md` erhielt ein weiteres Addendum zum Post-Test-Debt-Stand.
- `docs/INDEX.md`, `docs/TESTING_GUIDE.md` und `docs/FRESH_CHECKOUT_GREEN_PATH.md` wurden auf denselben Patchstand wie README/TODO/Checklog gezogen.
- README / Patchlog / Checklog auf Patch 679 synchronisiert.

## Validation

- `bash scripts/check_patch_docs_sync.sh`
- `node scripts/docsLint.js`
